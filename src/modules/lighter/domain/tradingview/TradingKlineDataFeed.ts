/**
 * Trading K-line DataFeed for TradingView
 *
 * This datafeed fetches candle data from the trading backend API
 * and subscribes to real-time K-line updates via WebSocket.
 */

import { getCandles, type Candle, type KlinePeriod } from "@/modules/lighter/api/custom/client";
import {
  getWebSocketService,
  normalizeMarketSymbolToApiFormat,
  type WsKlineUpdate,
  type WsTickerUpdate,
} from "@/modules/lighter/api/custom/websocket";
import { getActiveTradeProduct, type TradeProduct } from "@/modules/lighter/store/TradeStateContext";
import {
  DatafeedErrorCallback,
  HistoryCallback,
  IBasicDataFeed,
  LibrarySymbolInfo,
  OnReadyCallback,
  PeriodParams,
  ResolutionString,
  ResolveCallback,
  SubscribeBarsCallback,
  type VisiblePlotsSet,
} from "charting_library";
import { getServerBaseUrl } from "config/backend";
import { SUPPORTED_RESOLUTIONS_V2 } from "config/tradingview";
import { Bar, FromOldToNewArray } from "domain/tradingview/types";
import { formatTimeInBarToMs } from "domain/tradingview/utils";

// Resolution string to backend period mapping
// Note: Backend only supports "1m" | "5m" | "15m" | "1h" | "4h" | "1d"
// For weekly and monthly, we use "1d" as fallback
const RESOLUTION_TO_PERIOD: Record<string, KlinePeriod> = {
  "1": "1m",
  "5": "5m",
  "15": "15m",
  "60": "1h",
  "240": "4h",
  "1D": "1d",
  "1W": "1d", // Fallback to daily for weekly (backend doesn't support weekly)
  "1M": "1d", // Fallback to daily for monthly (backend doesn't support monthly)
};

// Resolution to seconds for time calculations
const RESOLUTION_TO_SECONDS: Record<string, number> = {
  "1": 60,
  "5": 60 * 5,
  "15": 60 * 15,
  "60": 60 * 60,
  "240": 60 * 60 * 4,
  "1D": 60 * 60 * 24,
  "1W": 60 * 60 * 24 * 7,
  "1M": 60 * 60 * 24 * 30,
};

/**
 * Parse symbol that may have multiplier prefix (e.g., "1@BTC" -> "BTC")
 */
function parseSymbolWithMultiplier(symbolName: string): string {
  if (symbolName.includes("@")) {
    const parts = symbolName.split("@");
    return parts[1] || symbolName;
  }
  return symbolName;
}

/**
 * Convert frontend symbol to backend symbol (BTC-USD)
 * Handles multiple formats: BTC, BTC/USD, BTCUSD, BTCUSDT, 1@BTC -> BTC-USD
 */
function convertSymbolToBackend(frontendSymbol: string): string {
  // First, remove multiplier prefix if present (e.g., "1@BTC" -> "BTC")
  let symbol = parseSymbolWithMultiplier(frontendSymbol);

  // Remove any USD/USDT suffix (with optional separator) first, then add -USD
  // Handles: BTC, BTC/USD, BTC-USD, BTCUSD, BTCUSDT
  const base = symbol
    .replace(/[-/]?USD[T]?$/i, "") // Remove -USD, /USD, USD, USDT suffix
    .replace(/[-/]$/, "") // Remove trailing - or /
    .toUpperCase();

  return `${base}-USD`;
}

/**
 * Convert Candle from API to TradingView Bar
 */
type VolumeMetric = "base" | "quote";

function getVolumeValue(
  source: Pick<Candle, "close" | "volume" | "quote_volume"> | Pick<WsKlineUpdate, "close" | "volume" | "quote_volume">,
  volumeMetric: VolumeMetric
): number {
  const baseVolume = parseFloat(source.volume);
  if (volumeMetric === "base") return baseVolume;

  const quoteVolume = parseFloat(source.quote_volume ?? "0");
  if (Number.isFinite(quoteVolume) && quoteVolume > 0) return quoteVolume;

  const close = parseFloat(source.close);
  return baseVolume * close;
}

function candleToBar(candle: Candle, volumeMetric: VolumeMetric): Bar {
  return {
    time: candle.time, // Keep as seconds, will be converted to ms later
    open: parseFloat(candle.open),
    high: parseFloat(candle.high),
    low: parseFloat(candle.low),
    close: parseFloat(candle.close),
    volume: getVolumeValue(candle, volumeMetric),
  };
}

/**
 * Convert WsKlineUpdate to TradingView Bar
 */
function wsKlineToBar(kline: WsKlineUpdate, volumeMetric: VolumeMetric): Bar {
  return {
    time: kline.time,
    open: parseFloat(kline.open),
    high: parseFloat(kline.high),
    low: parseFloat(kline.low),
    close: parseFloat(kline.close),
    volume: getVolumeValue(kline, volumeMetric),
  };
}

function getTickerPrice(ticker: WsTickerUpdate & { mark_price?: string }): number | null {
  const raw = ticker.mark_price || ticker.last_price;
  if (!raw) return null;

  const value = parseFloat(raw);
  return Number.isFinite(value) ? value : null;
}

function buildRealtimeBarFromTicker(lastBar: Bar, price: number, barTimeSeconds: number): Bar {
  if (lastBar.time === barTimeSeconds) {
    return {
      ...lastBar,
      close: price,
      high: Math.max(lastBar.high, price),
      low: Math.min(lastBar.low, price),
    };
  }

  if (barTimeSeconds > lastBar.time) {
    return {
      time: barTimeSeconds,
      open: lastBar.close,
      high: Math.max(lastBar.close, price),
      low: Math.min(lastBar.close, price),
      close: price,
      volume: 0,
    };
  }

  return lastBar;
}

interface Subscription {
  symbol: string;
  backendSymbol: string;
  resolution: ResolutionString;
  period: KlinePeriod;
  callback: SubscribeBarsCallback;
  lastBar: Bar | null;
  unsubscribeWs: (() => void) | null;
}

export class TradingKlineDataFeed extends EventTarget implements IBasicDataFeed {
  private chainId: number;
  private product: TradeProduct;
  private subscriptions: Map<string, Subscription> = new Map();
  private wsConnected = false;

  constructor(
    chainId: number,
    private brandName = "Zanbara",
    private visiblePlotsSet: VisiblePlotsSet = "ohlcv",
    private volumeMetric: VolumeMetric = "base",
    product: TradeProduct = getActiveTradeProduct()
  ) {
    super();
    this.chainId = chainId;
    this.product = product;
    this.initWebSocket();
  }

  private initWebSocket(): void {
    const ws = getWebSocketService(this.chainId, this.product);

    // Connect if not already connected
    if (!ws.isConnected()) {
      ws.connect();
    }

    ws.onConnect(() => {
      this.wsConnected = true;
      // Resubscribe all active subscriptions
      this.subscriptions.forEach((sub) => {
        ws.subscribeKline(sub.backendSymbol, sub.period);
      });
    });

    ws.onDisconnect(() => {
      this.wsConnected = false;
    });

    // Listen for kline updates
    ws.onKlineUpdate((channel, data) => {
      this.handleKlineUpdate(channel, data);
    });

    ws.onTickerUpdate((data) => {
      this.handleTickerUpdate(data as WsTickerUpdate & { mark_price?: string });
    });
  }

  private handleKlineUpdate(channel: string, data: WsKlineUpdate): void {
    // Channel formats:
    //   perp: kline:ETHUSDT:5m              → 3 parts
    //   spot: spot:kline:DFUSDT:15m         → 4 parts
    // Period is always last, symbol second-to-last. The earlier `parts.length !== 3`
    // guard silently dropped every spot kline message → chart appeared frozen.
    const parts = channel.split(":");
    if (parts.length < 3) return;

    const period = parts[parts.length - 1];
    const apiSymbol = parts[parts.length - 2]; // ETHUSDT / DFUSDT format

    // Find matching subscription
    // Note: sub.backendSymbol is in ETH-USD format, but channel uses ETHUSDT format
    // So we need to normalize sub.backendSymbol to match
    this.subscriptions.forEach((sub) => {
      const normalizedBackendSymbol = normalizeMarketSymbolToApiFormat(sub.backendSymbol);
      if (normalizedBackendSymbol === apiSymbol && sub.period === period) {
        const bar = wsKlineToBar(data, this.volumeMetric);

        // TradingView 的 SubscribeBarsCallback 要求时间单调不减:
        //   - time > lastBar.time → 新 bar
        //   - time === lastBar.time → 同 bar 内 OHLCV 更新
        //   - time < lastBar.time → 违规,TV 报
        //     "time violation, previous bar time X should be less or equal to new time Y"
        //
        // 触发场景:WS (重)订阅后,backend 会推 klinesnapshot(历史 bars 数组),
        // websocket.ts:onKlineUpdate 把 snapshot 排序后逐条回放到本 handler。
        // 若 sub.lastBar 已经是某条 live bar(例如 11:15),snapshot 里的 11:00/11:05/11:10
        // 被逐个喂给 TV 就会倒退时间触发报错。WS 断连重连、上游 RST、refcount onopen 重订阅
        // 都会踩到这条路径。
        //
        // 单位一致性:kline.time、sub.lastBar.time 以及 handleTickerUpdate 里的
        // barTimeSeconds 都是秒(formatTimeInBarToMs 才乘到 ms),直接 < 比较即可。
        if (sub.lastBar && bar.time < sub.lastBar.time) {
          return;
        }

        // Debug: log the volume from the WebSocket update.
        // console.log(`[TradingKlineDataFeed] K-line update for ${apiSymbol} ${period}:`, {
        //   rawVolume: data.volume,
        //   parsedVolume: bar.volume,
        //   time: bar.time,
        //   open: bar.open,
        //   high: bar.high,
        //   low: bar.low,
        //   close: bar.close,
        // });

        // Update last bar
        sub.lastBar = bar;

        // Notify TradingView (convert time to ms).
        // formatTimeInBarToMs uses the spread operator, so volume should be preserved.
        const barWithMs = formatTimeInBarToMs(bar);

        // Ensure volume is explicitly included and is a valid number.
        // TradingView requires volume to be numeric (not undefined/null).
        const volumeValue = typeof bar.volume === "number" && !isNaN(bar.volume) ? bar.volume : 0;
        const barToSend: Bar = {
          time: barWithMs.time,
          open: barWithMs.open,
          high: barWithMs.high,
          low: barWithMs.low,
          close: barWithMs.close,
          volume: volumeValue, // Explicitly include volume, ensure it's a valid number
        };

        // Debug: log the bar object being sent to TradingView.
        // console.log(`[TradingKlineDataFeed] Sending bar to TradingView:`, barToSend);

        sub.callback(barToSend);
      }
    });
  }

  private handleTickerUpdate(data: WsTickerUpdate & { mark_price?: string }): void {
    const tickerSymbol = normalizeMarketSymbolToApiFormat(data.symbol);
    const tickerPrice = getTickerPrice(data);

    if (tickerPrice === null) return;

    this.subscriptions.forEach((sub) => {
      const normalizedBackendSymbol = normalizeMarketSymbolToApiFormat(sub.backendSymbol);
      if (normalizedBackendSymbol !== tickerSymbol || !sub.lastBar) return;

      const resolutionSeconds = RESOLUTION_TO_SECONDS[sub.resolution] || 60;
      const barTimeSeconds = Math.floor(Date.now() / 1000 / resolutionSeconds) * resolutionSeconds;
      const nextBar = buildRealtimeBarFromTicker(sub.lastBar, tickerPrice, barTimeSeconds);

      if (
        nextBar.time === sub.lastBar.time &&
        nextBar.open === sub.lastBar.open &&
        nextBar.high === sub.lastBar.high &&
        nextBar.low === sub.lastBar.low &&
        nextBar.close === sub.lastBar.close
      ) {
        return;
      }

      sub.lastBar = nextBar;
      sub.callback(formatTimeInBarToMs(nextBar));
    });
  }

  searchSymbols(): void {
    // Not implemented for the trading runtime.
  }

  resolveSymbol(symbolName: string, onResolve: ResolveCallback): void {
    // In the trading runtime, symbolName may be "BTC", "1@BTC", etc.
    // Parse out the actual symbol.
    const parsedSymbol = parseSymbolWithMultiplier(symbolName);
    const priceDecimals = 2; // Default price decimals

    const symbolInfo: LibrarySymbolInfo = {
      name: parsedSymbol, // Use parsed symbol without multiplier
      type: "crypto",
      description: `${parsedSymbol}/USD`,
      ticker: parsedSymbol,
      session: "24x7",
      minmov: 1,
      timezone: "Etc/UTC",
      has_intraday: true,
      has_daily: true,
      currency_code: "USD",
      data_status: "streaming",
      visible_plots_set: this.visiblePlotsSet,
      exchange: this.brandName,
      listed_exchange: this.brandName,
      format: "price",
      pricescale: Math.max(1, 10 ** priceDecimals),
    };

    setTimeout(() => {
      onResolve(symbolInfo);
    }, 0);
  }

  async getBars(
    symbolInfo: LibrarySymbolInfo,
    resolution: ResolutionString,
    periodParams: PeriodParams,
    onResult: HistoryCallback,
    onError: DatafeedErrorCallback
  ): Promise<void> {
    const period = RESOLUTION_TO_PERIOD[resolution];
    if (!period) {
      onError(`Unsupported resolution: ${resolution}`);
      return;
    }

    const backendSymbol = convertSymbolToBackend(symbolInfo.name);
    const to = periodParams.to;
    const resolutionSeconds = RESOLUTION_TO_SECONDS[resolution] || 60;
    const offset = Math.trunc(Math.max((Date.now() / 1000 - to) / resolutionSeconds, 0));
    const countBack = Math.min(
      periodParams.firstDataRequest ? periodParams.countBack : Math.max(periodParams.countBack * 2, 500),
      10_000
    );
    const requestLimit = Math.min(countBack + offset, 10_000);

    try {
      const response = await getCandles(this.chainId, backendSymbol, {
        period,
        limit: requestLimit,
      }, this.product);

      if (!response.candles || response.candles.length === 0) {
        const isRequestingPastData = to < Date.now() / 1000;
        onResult([], { noData: isRequestingPastData });
        return;
      }

      const allBars: FromOldToNewArray<Bar> = response.candles.map((candle) => {
        const bar = candleToBar(candle, this.volumeMetric);
        const barWithMs = formatTimeInBarToMs(bar);

        const barToReturn: Bar = {
          time: barWithMs.time,
          open: barWithMs.open,
          high: barWithMs.high,
          low: barWithMs.low,
          close: barWithMs.close,
          volume: bar.volume ?? 0, // Explicitly include volume
        };

        return barToReturn;
      });

      const barsToReturn: FromOldToNewArray<Bar> = [];
      for (const bar of allBars) {
        const barTimeSeconds = bar.time / 1000;
        if (barTimeSeconds <= to) {
          barsToReturn.push(bar);
        } else {
          break;
        }
      }

      const isRequestingPastData = to < Date.now() / 1000;
      const hasReachedLimit = offset + countBack >= 10_000;
      const hasInsufficientData = barsToReturn.length < countBack && isRequestingPastData;
      const noData = hasReachedLimit || hasInsufficientData;

      onResult(barsToReturn, {
        noData,
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`[TradingKlineDataFeed] Error fetching candles:`, error);
      onError(String(error));
    }
  }

  subscribeBars(
    symbolInfo: LibrarySymbolInfo,
    resolution: ResolutionString,
    onTick: SubscribeBarsCallback,
    listenerGuid: string
  ): void {
    const period = RESOLUTION_TO_PERIOD[resolution];
    if (!period) {
      // eslint-disable-next-line no-console
      console.error(`[TradingKlineDataFeed] Unsupported resolution: ${resolution}`);
      return;
    }

    const backendSymbol = convertSymbolToBackend(symbolInfo.name);

    // Store subscription
    const subscription: Subscription = {
      symbol: symbolInfo.name,
      backendSymbol,
      resolution,
      period,
      callback: onTick,
      lastBar: null,
      unsubscribeWs: null,
    };

    this.subscriptions.set(listenerGuid, subscription);

    // Subscribe to WebSocket if connected
    const ws = getWebSocketService(this.chainId, this.product);
    if (ws.isConnected()) {
      ws.subscribeKline(backendSymbol, period);
      ws.subscribeTicker(backendSymbol);
    }
  }

  unsubscribeBars(listenerGuid: string): void {
    const subscription = this.subscriptions.get(listenerGuid);
    if (!subscription) return;

    // Unsubscribe from WebSocket
    const ws = getWebSocketService(this.chainId, this.product);
    ws.unsubscribeKline(subscription.backendSymbol, subscription.period);
    ws.unsubscribeTicker(subscription.backendSymbol);

    // Clean up WebSocket handler
    if (subscription.unsubscribeWs) {
      subscription.unsubscribeWs();
    }

    this.subscriptions.delete(listenerGuid);
  }

  onReady(callback: OnReadyCallback): void {
    setTimeout(() => {
      callback({
        supported_resolutions: Object.keys(SUPPORTED_RESOLUTIONS_V2) as ResolutionString[],
        supports_marks: false,
        supports_timescale_marks: false,
        supports_time: true,
      });
    }, 0);
  }

  destroy(): void {
    // Unsubscribe all
    this.subscriptions.forEach((_, guid) => {
      this.unsubscribeBars(guid);
    });
    this.subscriptions.clear();
  }

  // Utility method to get backend URL (for debugging)
  getBackendUrl(): string {
    return getServerBaseUrl(this.chainId);
  }
}
