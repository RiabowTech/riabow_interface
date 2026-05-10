/**
 * Zanbara WebSocket Service
 * 
 * 中心化的 Zanbara WebSocket 服务
 * 使用配置的 WebSocket URL
 */

import { getStoredToken } from "./client";

// WebSocket message types (re-export from main websocket for type compatibility)
export interface WsMessage {
  type: string;
  channel?: string;
  symbol?: string;
  data?: unknown;
}

export interface WsPositionUpdate {
  id: string;
  position_id?: string;
  symbol: string;
  side: "long" | "short";
  size: string;
  entry_price: string;
  mark_price: string;
  liquidation_price?: string;
  unrealized_pnl: string;
  leverage: number;
  margin?: string;
  updated_at?: number;
  event?: "opened" | "updated" | "closed" | "liquidated";
}

export interface WsOrderUpdate {
  id: string;
  order_id?: string;
  symbol: string;
  side: "long" | "short";
  order_type: string;
  price?: string;
  amount: string;
  size?: string;
  filled_amount?: string;
  filled_size?: string;
  status: string;
  updated_at?: number;
  event?: "created" | "filled" | "partially_filled" | "cancelled" | "rejected";
}

export interface WsBalanceUpdate {
  token: string;
  symbol: string;
  available: string;
  frozen: string;
  total: string;
  updated_at?: number;
}

export interface WsPriceUpdate {
  symbol: string;
  price: string;
  timestamp: number;
}

export interface WsOrderbookUpdate {
  symbol: string;
  bids: Array<{ price: string; size: string }>;
  asks: Array<{ price: string; size: string }>;
  timestamp: number;
}

export interface WsTradeUpdate {
  symbol: string;
  id: string;
  price: string;
  amount: string;
  size?: string;
  side: "buy" | "sell";
  timestamp: number;
}

export interface WsTickerUpdate {
  symbol: string;
  last_price: string;
  price_change_24h: string;
  price_change_percent_24h: string;
  high_24h: string;
  low_24h: string;
  volume_24h: string;
  bid?: string;
  ask?: string;
  change_24h?: string;
  timestamp?: number;
}

export interface WsKlineUpdate {
  time: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  quote_volume?: string;
  trade_count?: number;
  is_final?: boolean;
}

/**
 * Normalize market symbol to API format
 * Converts various symbol formats (BTC-USD, BTC/USD, BTCUSD) to BTCUSDT
 */
export function normalizeMarketSymbolToApiFormat(symbol: string): string {
  const upper = symbol.toUpperCase();

  // Already in BTCUSDT format
  if (upper.includes("USDT")) return upper;

  // Convert BTC-USD / BTC/USD / BTCUSD to BTCUSDT
  if (upper.includes("-USD")) return upper.replace("-USD", "USDT");

  const cleaned = upper.replace("/", "").replace("-", "");
  if (cleaned.endsWith("USD")) return cleaned.replace(/USD$/, "USDT");

  // If just BTC, append USDT
  return `${cleaned}USDT`;
}

type MessageHandler = (message: WsMessage) => void;
type ErrorHandler = (error: Event) => void;
type ConnectionHandler = () => void;

import { DEFAULT_TRADE_PRODUCT, tradeProductChannel, tradeProductWsUrl, type TradeProduct } from "./productRouting";

export class WebSocketService {
  private ws: WebSocket | null = null;
  private chainId: number;
  private product: TradeProduct;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  // channel → 当前活跃消费者数量。
  // 之前是 Set<string>,多个组件订阅同一 channel 时,第一个卸载的人就会 wire 级 unsubscribe,
  // 把仍然挂着的其它消费者一起害死(比如 trades:BTCUSDT 同时被 OrderBookPanel /
  // useTradesAdapter / OrderBook 三处订阅,切 symbol 时任何一个先 unmount 都会断流)。
  // 改 refcount 后,只在 count 0→1 时真发 subscribe,1→0 时才真发 unsubscribe。
  private subscriptions: Map<string, number> = new Map();
  // 私有 channel 需要带 auth token 重订阅,记录首次订阅时使用的 address。
  // 重连时 onopen 需要这份信息把 token 再挂上去。
  private privateSubscriptions: Map<string, string | null | undefined> = new Map();
  private messageHandlers: Map<string, Set<MessageHandler>> = new Map();
  private errorHandlers: Set<ErrorHandler> = new Set();
  private connectHandlers: Set<ConnectionHandler> = new Set();
  private disconnectHandlers: Set<ConnectionHandler> = new Set();
  private isConnecting = false;
  private heartbeatInterval: number | null = null;
  private heartbeatIntervalMs = 30000;
  private pongTimeout: number | null = null;
  private pongTimeoutMs = 10000;

  // Subscribe send throttling.
  // 后端 WS 在 onopen 后短时间内只能消化 ~7 条 subscribe;一次性灌 50+ 条会让排在后面的(尤其
  // kline:SYMBOL:period)被静默丢弃,顺带把 ping/pong 一起阻死 → reconnect 循环,K 线/盘口/Trades
  // 看起来全部停摆。这里把 wire 级 subscribe 走一个 FIFO 队列,定速发出。
  private subscribeQueue: Array<{ channel: string; requireAuth: boolean; address?: string | null }> = [];
  private subscribeFlushTimer: number | null = null;
  private static readonly SUBSCRIBE_BATCH_SIZE = 5;
  private static readonly SUBSCRIBE_BATCH_INTERVAL_MS = 250;

  // Per-symbol depth state for spot. Spot pushes a snapshot once on subscribe
  // then streams diffs (only changed levels; qty="0" means level removed).
  // Perp pushes full snapshots every 500 ms so it doesn't need this.
  private spotDepthState: Map<string, { bids: Map<string, string>; asks: Map<string, string>; lastUpdateId: number }> = new Map();

  constructor(chainId: number, product: TradeProduct = DEFAULT_TRADE_PRODUCT) {
    this.chainId = chainId;
    this.product = product;
  }

  // private getWsUrl(): string {
  //   // In development, use relative path /ws/external which will be proxied by Vite
  //   if (import.meta.env.DEV) {
  //     const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  //     const host = window.location.host;
  //     return `${protocol}//${host}/ws/external`;
  //   }
    
  //   // In production, use configured URL based on chainId (根据链 ID 自动切换)
  //   const baseWsUrl = getTradingWsUrl(this.chainId);
  //   if (baseWsUrl) {
  //     // Ensure the URL ends with /ws/external
  //     if (baseWsUrl.endsWith("/ws/external")) {
  //       return baseWsUrl;
  //     } else if (baseWsUrl.endsWith("/ws")) {
  //       return baseWsUrl.replace("/ws", "/ws/external");
  //     } else {
  //       return `${baseWsUrl}/ws/external`;
  //     }
  //   }
    
  //   // Default fallback
  //   const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  //   const host = window.location.host;
  //   return `${protocol}//${host}/ws/external`;
  // }

  // remove external
  private getWsUrl(): string {
    // In development, use relative path /ws/external which will be proxied by Vite
    if (import.meta.env.DEV) {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      return `${protocol}//${host}/ws`;
    }
    
    // In production, use configured URL based on chainId (根据链 ID 自动切换)
    const baseWsUrl = tradeProductWsUrl(this.chainId, this.product);
    if (baseWsUrl) {
      // Ensure the URL ends with /ws/external
      if (baseWsUrl.endsWith("/ws")) {
        return baseWsUrl;
      } else {
        return `${baseWsUrl}/ws`;
      }
    }
    
    // Default fallback
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    return `${protocol}//${host}/ws`;
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) {
      return;
    }

    this.isConnecting = true;

    try {
      this.ws = new WebSocket(this.getWsUrl());

      this.ws.onopen = () => {
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.connectHandlers.forEach((handler) => handler());
        // Try to get token (will use last address if available)
        const token = getStoredToken(null, this.chainId);
        if (token) {
          this.authenticate();
        }
        setTimeout(() => {
          // 重连后把现存订阅重新挂上去。refcount >= 1 的 channel 都是还有人要数据的。
          // 私有 channel 取记录在 privateSubscriptions 里的 address(首次订阅时的 caller 传进来的)。
          this.subscriptions.forEach((_count, channel) => {
            if (this.privateSubscriptions.has(channel)) {
              this.sendSubscribe(channel, true, this.privateSubscriptions.get(channel));
            } else {
              this.sendSubscribe(channel);
            }
          });
        }, 100);
        this.startHeartbeat();
      };

      this.ws.onmessage = (event) => {
        try {
          const message: WsMessage = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error(" Failed to parse WebSocket message:", event.data);
        }
      };

      this.ws.onerror = (error) => {
        this.isConnecting = false;
        this.errorHandlers.forEach((handler) => handler(error));
      };

      this.ws.onclose = () => {
        this.isConnecting = false;
        this.stopHeartbeat();
        this.disconnectHandlers.forEach((handler) => handler());
        this.attemptReconnect();
      };
    } catch (error) {
      this.isConnecting = false;
      console.error(" WebSocket connection error:", error);
    }
  }

  disconnect(): void {
    this.stopHeartbeat();
    if (this.subscribeFlushTimer !== null) {
      clearTimeout(this.subscribeFlushTimer);
      this.subscribeFlushTimer = null;
    }
    this.subscribeQueue = [];
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.subscriptions.clear();
    this.privateSubscriptions.clear();
    this.reconnectAttempts = this.maxReconnectAttempts;
  }

  /**
   * 引用计数的"加一":count 0→1 时才真正发 wire 级 subscribe。
   * 同一 channel 多个组件分别 subscribe 不会重复发 wire 消息,也不会被第一个 unmount 的人带走。
   */
  private addSubscription(channel: string, requireAuth = false, address?: string | null): void {
    const routedChannel = this.channel(channel);
    const prev = this.subscriptions.get(routedChannel) ?? 0;
    this.subscriptions.set(routedChannel, prev + 1);
    if (requireAuth) {
      // 记录 auth 上下文,重连时 onopen 照此重订阅
      this.privateSubscriptions.set(routedChannel, address);
    }
    if (prev === 0) {
      this.sendSubscribe(routedChannel, requireAuth, address);
    }
  }

  /**
   * 引用计数的"减一":count 1→0 才真正发 wire 级 unsubscribe。
   * 若 ws 此刻未开,`sendUnsubscribe` 内部会 noop;但 subscriptions map 已经清掉,
   * 下次 reconnect 的 `onopen` 自然不会把这个 channel 重订回来 —— 语义一致。
   */
  private removeSubscription(channel: string): void {
    const routedChannel = this.channel(channel);
    const prev = this.subscriptions.get(routedChannel) ?? 0;
    if (prev <= 1) {
      this.subscriptions.delete(routedChannel);
      this.privateSubscriptions.delete(routedChannel);
      if (prev === 1) {
        this.sendUnsubscribe(routedChannel);
      }
      return;
    }
    this.subscriptions.set(routedChannel, prev - 1);
  }

  private channel(channel: string): string {
    return tradeProductChannel(this.product, channel);
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    setTimeout(() => {
      this.connect();
    }, delay);
  }

  private sendSubscribe(channel: string, requireAuth = false, address?: string | null): void {
    // 入队 + 触发节流刷新。第一批走 setTimeout(0),保持单条订阅的反应速度。
    this.subscribeQueue.push({ channel, requireAuth, address });
    this.scheduleSubscribeFlush(0);
  }

  private sendUnsubscribe(channel: string): void {
    // 若 subscribe 还没真正发出去,直接从队列里摘掉;不要发一个对应不上的 unsubscribe 给 server。
    const pendingIdx = this.subscribeQueue.findIndex((q) => q.channel === channel);
    if (pendingIdx >= 0) {
      this.subscribeQueue.splice(pendingIdx, 1);
      return;
    }
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "unsubscribe", channel }));
    }
  }

  private scheduleSubscribeFlush(delayMs: number): void {
    if (this.subscribeFlushTimer !== null) return;
    this.subscribeFlushTimer = window.setTimeout(() => {
      this.subscribeFlushTimer = null;
      this.flushSubscribeBatch();
    }, delayMs);
  }

  private flushSubscribeBatch(): void {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      // 连接还没开/已经断了 — 把队列丢掉。reconnect 后 onopen 会用 subscriptions(refcount map)
      // 重新调 sendSubscribe 把仍然活跃的 channel 重新入队。
      this.subscribeQueue = [];
      return;
    }
    const batch = this.subscribeQueue.splice(0, WebSocketService.SUBSCRIBE_BATCH_SIZE);
    for (const item of batch) {
      const token = getStoredToken(item.address, this.chainId);
      try {
        if (item.requireAuth && token) {
          this.ws.send(JSON.stringify({ type: "subscribe", channel: item.channel, token }));
        } else {
          this.ws.send(JSON.stringify({ type: "subscribe", channel: item.channel }));
        }
      } catch (err) {
        console.error(" Failed to send subscribe:", item.channel, err);
      }
    }
    if (this.subscribeQueue.length > 0) {
      this.scheduleSubscribeFlush(WebSocketService.SUBSCRIBE_BATCH_INTERVAL_MS);
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.sendPing();
    this.heartbeatInterval = window.setInterval(() => {
      this.sendPing();
    }, this.heartbeatIntervalMs);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval !== null) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.pongTimeout !== null) {
      clearTimeout(this.pongTimeout);
      this.pongTimeout = null;
    }
  }

  private sendPing(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({ type: "ping" }));
        this.schedulePongTimeout();
      } catch (error) {
        console.error(" Failed to send ping:", error);
      }
    }
  }

  private schedulePongTimeout(): void {
    if (this.pongTimeout !== null) {
      clearTimeout(this.pongTimeout);
    }
    this.pongTimeout = window.setTimeout(() => {
      console.warn(" No pong received, connection may be dead. Reconnecting...");
      if (this.ws) {
        this.ws.close();
      }
    }, this.pongTimeoutMs);
  }

  private handlePong(): void {
    if (this.pongTimeout !== null) {
      clearTimeout(this.pongTimeout);
      this.pongTimeout = null;
    }
  }

  private handleMessage(message: WsMessage): void {
    const { type, channel } = message;

    if (type === "pong") {
      this.handlePong();
      return;
    }

    const typeHandlers = this.messageHandlers.get(type);
    if (typeHandlers) {
      typeHandlers.forEach((handler) => handler(message));
    }

    if (channel) {
      const channelHandlers = this.messageHandlers.get(channel);
      if (channelHandlers) {
        channelHandlers.forEach((handler) => handler(message));
      }
    }

    const globalHandlers = this.messageHandlers.get("*");
    if (globalHandlers) {
      globalHandlers.forEach((handler) => handler(message));
    }
  }

  subscribePrices(symbols: string[]): void {
    symbols.forEach((symbol) => {
      this.addSubscription(`price:${symbol}`);
    });
  }

  // Channel naming differs between perp and spot on the backend:
  //   perp:  orderbook:{sym}    trades:{sym}    ticker:{sym}    kline:{sym}:{period}
  //   spot:  spot:depth:{sym}   spot:trade:{sym} spot:ticker:{sym} spot:kline:{sym}:{period}
  // Note "trades" → "trade" (singular) and "orderbook" → "depth" — not just a prefix swap.
  private orderbookChannelName(apiSymbol: string): string {
    return this.product === "spot" ? `spot:depth:${apiSymbol}` : `orderbook:${apiSymbol}`;
  }
  private tradeChannelName(apiSymbol: string): string {
    return this.product === "spot" ? `spot:trade:${apiSymbol}` : `trades:${apiSymbol}`;
  }
  private tickerChannelName(apiSymbol: string): string {
    return this.product === "spot" ? `spot:ticker:${apiSymbol}` : `ticker:${apiSymbol}`;
  }
  private klineChannelName(apiSymbol: string, period: string): string {
    return this.product === "spot" ? `spot:kline:${apiSymbol}:${period}` : `kline:${apiSymbol}:${period}`;
  }

  subscribeOrderbook(symbol: string): void {
    const apiSymbol = normalizeMarketSymbolToApiFormat(symbol);
    this.addSubscription(this.orderbookChannelName(apiSymbol));
  }

  subscribeTrades(symbol: string): void {
    const apiSymbol = normalizeMarketSymbolToApiFormat(symbol);
    this.addSubscription(this.tradeChannelName(apiSymbol));
  }

  subscribeTicker(symbol: string): void {
    const apiSymbol = normalizeMarketSymbolToApiFormat(symbol);
    this.addSubscription(this.tickerChannelName(apiSymbol));
  }

  subscribeAllTrades(): void {
    this.addSubscription("trades:*");
  }

  unsubscribePrices(symbols: string[]): void {
    symbols.forEach((symbol) => {
      this.removeSubscription(`price:${symbol}`);
    });
  }

  unsubscribeOrderbook(symbol: string): void {
    const apiSymbol = normalizeMarketSymbolToApiFormat(symbol);
    this.removeSubscription(this.orderbookChannelName(apiSymbol));
  }

  unsubscribeTrades(symbol: string): void {
    const apiSymbol = normalizeMarketSymbolToApiFormat(symbol);
    this.removeSubscription(this.tradeChannelName(apiSymbol));
  }

  unsubscribeTicker(symbol: string): void {
    const apiSymbol = normalizeMarketSymbolToApiFormat(symbol);
    this.removeSubscription(this.tickerChannelName(apiSymbol));
  }

  subscribeKline(symbol: string, period: string): void {
    // Normalize symbol to API format (ETH-USD -> ETHUSDT)
    const apiSymbol = normalizeMarketSymbolToApiFormat(symbol);
    this.addSubscription(this.klineChannelName(apiSymbol, period));
  }

  unsubscribeKline(symbol: string, period: string): void {
    // Normalize symbol to API format (ETH-USD -> ETHUSDT)
    const apiSymbol = normalizeMarketSymbolToApiFormat(symbol);
    this.removeSubscription(this.klineChannelName(apiSymbol, period));
  }

  authenticate(address?: string | null): void {
    const token = getStoredToken(address, this.chainId);
    if (token && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "auth", token }));
    }
  }

  authenticateWithSignature(address: string, signature: string, timestamp: number): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: "auth",
          address,
          signature,
          timestamp,
        })
      );
    }
  }

  subscribePositions(address?: string | null): void {
    this.addSubscription("positions", true, address);
  }

  subscribeOrders(address?: string | null): void {
    this.addSubscription("orders", true, address);
  }

  subscribeBalances(address?: string | null): void {
    this.addSubscription("balance", true, address);
  }

  unsubscribePositions(): void {
    this.removeSubscription("positions");
  }

  unsubscribeOrders(): void {
    this.removeSubscription("orders");
  }

  unsubscribeBalances(): void {
    this.removeSubscription("balance");
  }

  unsubscribeAllTrades(): void {
    this.removeSubscription("trades:*");
  }

  onMessage(typeOrChannel: string, handler: MessageHandler): () => void {
    if (!this.messageHandlers.has(typeOrChannel)) {
      this.messageHandlers.set(typeOrChannel, new Set());
    }
    this.messageHandlers.get(typeOrChannel)!.add(handler);

    return () => {
      this.messageHandlers.get(typeOrChannel)?.delete(handler);
    };
  }

  onPriceUpdate(handler: (data: WsPriceUpdate) => void): () => void {
    return this.onMessage("price", (msg) => {
      if (msg.data) {
        handler(msg.data as WsPriceUpdate);
      }
    });
  }

  onOrderbookUpdate(handler: (data: WsOrderbookUpdate) => void): () => void {
    // Perp pushes full snapshots tagged "orderbook"; spot pushes "spot_depth_snapshot"
    // (replace state) followed by "spot_depth_diff" (incremental). Subscribe to all
    // three; for spot we maintain per-symbol price→qty maps and emit the full
    // merged snapshot on every push so the consumer doesn't need to know the
    // difference.
    const perpUnsub = this.onMessage("orderbook", (msg) => {
      const orderbookData = (msg.data || msg) as WsOrderbookUpdate;
      if (!orderbookData?.symbol) return;
      handler(this.normalizeOrderbookPayload(orderbookData));
    });
    const spotSnapUnsub = this.onMessage("spot_depth_snapshot", (msg) => {
      const data = (msg.data || msg) as { symbol?: string; last_update_id?: number; bids?: [string, string][]; asks?: [string, string][] };
      if (!data?.symbol) return;
      this.applySpotDepthSnapshot(data.symbol, data.bids ?? [], data.asks ?? [], data.last_update_id ?? 0);
      handler(this.snapshotSpotDepthFor(data.symbol));
    });
    const spotDiffUnsub = this.onMessage("spot_depth_diff", (msg) => {
      const data = (msg.data || msg) as { symbol?: string; update_id_last?: number; bids?: [string, string][]; asks?: [string, string][] };
      if (!data?.symbol) return;
      this.applySpotDepthDiff(data.symbol, data.bids ?? [], data.asks ?? [], data.update_id_last ?? 0);
      handler(this.snapshotSpotDepthFor(data.symbol));
    });
    return () => { perpUnsub(); spotSnapUnsub(); spotDiffUnsub(); };
  }

  private normalizeOrderbookPayload(data: WsOrderbookUpdate): WsOrderbookUpdate {
    return {
      symbol: data.symbol,
      timestamp: data.timestamp,
      bids: Array.isArray(data.bids) && data.bids.length > 0
        ? Array.isArray(data.bids[0])
          ? (data.bids as unknown as [string, string][]).map(([price, size]) => ({ price, size }))
          : data.bids
        : [],
      asks: Array.isArray(data.asks) && data.asks.length > 0
        ? Array.isArray(data.asks[0])
          ? (data.asks as unknown as [string, string][]).map(([price, size]) => ({ price, size }))
          : data.asks
        : [],
    };
  }

  private applySpotDepthSnapshot(symbol: string, bids: [string, string][], asks: [string, string][], lastUpdateId: number): void {
    const bidsMap = new Map<string, string>();
    const asksMap = new Map<string, string>();
    for (const [p, q] of bids) bidsMap.set(p, q);
    for (const [p, q] of asks) asksMap.set(p, q);
    this.spotDepthState.set(symbol, { bids: bidsMap, asks: asksMap, lastUpdateId });
  }

  private applySpotDepthDiff(symbol: string, bids: [string, string][], asks: [string, string][], updateIdLast: number): void {
    let state = this.spotDepthState.get(symbol);
    if (!state) {
      // Diff before snapshot — initialize from this diff (degraded but non-fatal).
      state = { bids: new Map(), asks: new Map(), lastUpdateId: 0 };
      this.spotDepthState.set(symbol, state);
    }
    const apply = (m: Map<string, string>, levels: [string, string][]) => {
      for (const [p, q] of levels) {
        if (q === "0" || Number(q) === 0) m.delete(p); else m.set(p, q);
      }
    };
    apply(state.bids, bids);
    apply(state.asks, asks);
    state.lastUpdateId = updateIdLast;
  }

  private snapshotSpotDepthFor(symbol: string): WsOrderbookUpdate {
    const state = this.spotDepthState.get(symbol);
    if (!state) return { symbol, timestamp: Date.now(), bids: [], asks: [] };
    // Bids: descending by price (best bid first); asks: ascending (best ask first).
    const bids = Array.from(state.bids.entries())
      .sort((a, b) => Number(b[0]) - Number(a[0]))
      .map(([price, size]) => ({ price, size }));
    const asks = Array.from(state.asks.entries())
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([price, size]) => ({ price, size }));
    return { symbol, timestamp: Date.now(), bids, asks };
  }

  onTradeUpdate(handler: (data: WsTradeUpdate) => void): () => void {
    const handlePerp = (msg: WsMessage) => {
      const tradeData = (msg.data || msg) as WsTradeUpdate;
      if (!tradeData?.symbol) return;
      if (!tradeData.id) {
        tradeData.id = `${tradeData.symbol}:${tradeData.timestamp}:${tradeData.price}:${tradeData.amount}:${tradeData.side}`;
      }
      if (tradeData.amount && !tradeData.size) tradeData.size = tradeData.amount;
      handler(tradeData);
    };
    const handleSpot = (msg: WsMessage) => {
      // Spot wire fields: trade_id (uuid), symbol, side (taker), price, quantity, ts (ms).
      const d = (msg.data || msg) as { trade_id?: string; symbol?: string; side?: string; price?: string; quantity?: string; ts?: number };
      if (!d?.symbol) return;
      const trade: WsTradeUpdate = {
        id: d.trade_id ?? `${d.symbol}:${d.ts}:${d.price}:${d.quantity}:${d.side}`,
        symbol: d.symbol,
        side: d.side as "buy" | "sell",
        price: d.price ?? "0",
        amount: d.quantity ?? "0",
        size: d.quantity ?? "0",
        timestamp: d.ts ?? Date.now(),
      };
      handler(trade);
    };
    const perpUnsub = this.onMessage("trade", handlePerp);
    const spotUnsub = this.onMessage("spot_trade", handleSpot);
    return () => { perpUnsub(); spotUnsub(); };
  }

  onTickerUpdate(handler: (data: WsTickerUpdate) => void): () => void {
    const handle = (msg: WsMessage) => {
      const tickerData = (msg.data || msg) as WsTickerUpdate;
      if (tickerData && tickerData.symbol) handler(tickerData);
    };
    const perpUnsub = this.onMessage("ticker", handle);
    const spotUnsub = this.onMessage("spot_ticker", handle);
    return () => { perpUnsub(); spotUnsub(); };
  }

  onKlineUpdate(handler: (channel: string, data: WsKlineUpdate) => void): () => void {
    // 后端 serde(tag="type", rename_all="snake_case") 把 KlineSnapshot 序列化为 "kline_snapshot",
    // 且 data 是单个 KlineData(不是数组)。早期实现监听 "klinesnapshot" + Array.isArray,两处都对不上,
    // 订阅后首个快照被静默丢掉,TVChart 只剩 REST 历史 → 看起来不动。
    const klineHandler = (msg: WsMessage) => {
      if (!msg.channel || !msg.data) return;
      if (msg.type === "kline_snapshot" || msg.type === "kline") {
        if (Array.isArray(msg.data)) {
          const candles = (msg.data as WsKlineUpdate[]).slice().sort((a, b) => {
            const timeA = a.time < 1e10 ? a.time : a.time / 1000;
            const timeB = b.time < 1e10 ? b.time : b.time / 1000;
            return timeA - timeB;
          });
          candles.forEach((candle) => handler(msg.channel!, candle));
        } else {
          handler(msg.channel, msg.data as WsKlineUpdate);
        }
      }
    };

    // Spot kline payload uses `open_time` instead of `time`, and `open / high
    // / low / close` instead of `o / h / l / c`. Normalize to the perp shape
    // before forwarding so downstream consumers stay symmetric.
    const spotKlineHandler = (msg: WsMessage) => {
      if (!msg.channel || !msg.data) return;
      const d = msg.data as Record<string, unknown>;
      const candle: WsKlineUpdate = {
        time: typeof d.open_time === "number" ? (d.open_time as number) : Number(d.open_time ?? 0),
        open: String(d.open ?? "0"),
        high: String(d.high ?? "0"),
        low: String(d.low ?? "0"),
        close: String(d.close ?? "0"),
        volume: String(d.volume ?? "0"),
        quote_volume: d.quote_volume != null ? String(d.quote_volume) : undefined,
        trade_count: typeof d.trade_count === "number" ? (d.trade_count as number) : undefined,
        is_final: typeof d.is_closed === "boolean" ? (d.is_closed as boolean) : undefined,
      };
      handler(msg.channel, candle);
    };

    const unsubKline = this.onMessage("kline", klineHandler);
    const unsubKlineSnapshot = this.onMessage("kline_snapshot", klineHandler);
    const unsubSpotKline = this.onMessage("spot_kline_update", spotKlineHandler);
    const unsubSpotKlineSnapshot = this.onMessage("spot_kline_snapshot", spotKlineHandler);

    return () => {
      unsubKline();
      unsubKlineSnapshot();
      unsubSpotKline();
      unsubSpotKlineSnapshot();
    };
  }

  onPositionUpdate(handler: (data: WsPositionUpdate) => void): () => void {
    return this.onMessage("position", (msg) => {
      if (msg.data) {
        const data = msg.data as WsPositionUpdate;
        if (data.id && !data.position_id) {
          data.position_id = data.id;
        }
        handler(data);
      }
    });
  }

  onOrderUpdate(handler: (data: WsOrderUpdate) => void): () => void {
    return this.onMessage("order", (msg) => {
      if (msg.data) {
        const data = msg.data as WsOrderUpdate;
        if (data.id && !data.order_id) {
          data.order_id = data.id;
        }
        if (data.amount && !data.size) {
          data.size = data.amount;
        }
        if (data.filled_amount && !data.filled_size) {
          data.filled_size = data.filled_amount;
        }
        handler(data);
      }
    });
  }

  onBalanceUpdate(handler: (data: WsBalanceUpdate) => void): () => void {
    return this.onMessage("balance", (msg) => {
      if (msg.data) {
        handler(msg.data as WsBalanceUpdate);
      }
    });
  }

  onError(handler: ErrorHandler): () => void {
    this.errorHandlers.add(handler);
    return () => {
      this.errorHandlers.delete(handler);
    };
  }

  onConnect(handler: ConnectionHandler): () => void {
    this.connectHandlers.add(handler);
    return () => {
      this.connectHandlers.delete(handler);
    };
  }

  onDisconnect(handler: ConnectionHandler): () => void {
    this.disconnectHandlers.add(handler);
    return () => {
      this.disconnectHandlers.delete(handler);
    };
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  getSubscriptions(): string[] {
    return Array.from(this.subscriptions.keys());
  }
}

// Singleton instances per chain
const wsInstances: Map<string, WebSocketService> = new Map();

export function getWebSocketService(chainId: number, product: TradeProduct = DEFAULT_TRADE_PRODUCT): WebSocketService {
  const key = `${chainId}:${product}`;
  if (!wsInstances.has(key)) {
    wsInstances.set(key, new WebSocketService(chainId, product));
  }
  return wsInstances.get(key)!;
}

export function disconnectAllWebSockets(): void {
  wsInstances.forEach((ws) => ws.disconnect());
  wsInstances.clear();
}
