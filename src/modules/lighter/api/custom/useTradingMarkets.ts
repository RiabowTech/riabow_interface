/**
 * useTradingMarkets - Hook for fetching market data from backend API
 *
 * This hook fetches markets and tickers from the Primit backend and
 * provides the data in a format suitable for the trading page UI.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import useSWR, { SWRConfiguration } from "swr";

import { getMarkets } from "./client";
import { getWebSocketService, normalizeMarketSymbolToApiFormat } from "./websocket";
import type { Market, Ticker } from "../types";
import type { WsTickerUpdate } from "./websocket";

// Default SWR configuration for markets
const defaultConfig: SWRConfiguration = {
  revalidateOnFocus: false,
  dedupingInterval: 5000,
  refreshInterval: 10000, // Refresh every 10 seconds
};

// Helper to convert Market.symbol (e.g., "BTC-USD") to WebSocket format (e.g., "BTCUSDT")
function convertSymbolToApiFormat(symbol: string): string {
  // If already in BTCUSDT format, return as is
  if (symbol.includes("USDT")) {
    return symbol.toUpperCase();
  }
  // Convert BTC-USD to BTCUSDT
  if (symbol.includes("-USD")) {
    return symbol.replace("-USD", "USDT").toUpperCase();
  }
  // If just BTC, append USDT
  return `${symbol}USDT`.toUpperCase();
}

// Helper to convert WebSocket symbol (e.g., "BTCUSDT") back to Market.symbol (e.g., "BTC-USD")
function convertApiSymbolToMarketFormat(apiSymbol: string): string {
  return apiSymbol.replace("USDT", "-USD");
}

export interface TradingMarket extends Market {
  ticker?: Ticker;
  priceChangePercent?: number;
  volume24h?: string;
  lastPrice?: string;
}

export interface UseTradingMarketsResult {
  markets: TradingMarket[];
  isLoading: boolean;
  error?: Error;
  mutate: () => void;
}

// Helper to extract markets array from API response
// API might return Market[] directly or { markets: Market[] }
function extractMarketsArray(data: unknown): Market[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (typeof data === "object" && data !== null && "markets" in data) {
    const markets = (data as { markets: unknown }).markets;
    if (Array.isArray(markets)) return markets;
  }
  return [];
}

/**
 * Fetch all markets from API
 */
export function useTradingMarkets(chainId: number | undefined, config?: SWRConfiguration): UseTradingMarketsResult {
  const {
    data: marketsData,
    error: marketsError,
    isLoading: marketsLoading,
    mutate,
  } = useSWR<{ markets: Market[]; total: number }>(
    chainId ? [`trade-markets`, chainId] : null,
    () => getMarkets(chainId!),
    { ...defaultConfig, ...config }
  );

  const markets = useMemo(() => {
    if (!marketsData) return [];
    return marketsData.markets.map((market) => ({
      ...market,
      lastPrice: market.last_price?.toString(),
      volume24h: market.volume_24h?.toString(),
      priceChangePercent:
        market.price_change_percent_24h != null ? parseFloat(market.price_change_percent_24h.toString()) : undefined,
    }));
  }, [marketsData]);

  return {
    markets,
    isLoading: marketsLoading,
    error: marketsError as Error | undefined,
    mutate,
  };
}

/**
 * Fetch markets with tickers (includes price data)
 */
export function useTradingMarketsWithTickers(
  chainId: number | undefined,
  config?: SWRConfiguration
): UseTradingMarketsResult {
  // First fetch markets
  const {
    data: marketsData,
    error: marketsError,
    isLoading: marketsLoading,
    mutate: mutateMarkets,
  } = useSWR<{ markets: Market[]; total: number }>(
    chainId ? [`trade-markets`, chainId] : null,
    () => getMarkets(chainId!),
    { ...defaultConfig, ...config }
  );

  // Extract markets array from response
  const marketsArray = useMemo(() => marketsData?.markets || [], [marketsData]);

  // Get all market symbols
  const symbols = useMemo(() => {
    return marketsArray.map((m) => m.symbol);
  }, [marketsArray]);

  // Use WebSocket for ticker updates instead of REST API polling
  const [tickersData, setTickersData] = useState<Record<string, Ticker>>({});
  const [tickersError, setTickersError] = useState<Error | undefined>();
  const [tickersLoading, setTickersLoading] = useState(true);
  const subscriptionsRef = useRef<Array<() => void>>([]);

  useEffect(() => {
    if (!chainId || symbols.length === 0) {
      setTickersData({});
      setTickersLoading(false);
      return;
    }

    const wsService = getWebSocketService(chainId);
    const unsubscribers: Array<() => void> = [];
    const tickerMap: Record<string, Ticker> = {};

    // Create a map of apiSymbol -> marketSymbol for quick lookup
    const symbolMap = new Map<string, string>();
    symbols.forEach((symbol) => {
      const apiSymbol = convertSymbolToApiFormat(symbol);
      symbolMap.set(apiSymbol.toUpperCase(), symbol);
    });

    // Subscribe to all tickers
    symbols.forEach((symbol) => {
      const apiSymbol = convertSymbolToApiFormat(symbol);

      // Subscribe to WebSocket ticker updates
      wsService.subscribeTicker(apiSymbol);
    });

    // Single handler for all ticker updates
    const unsubscribe = wsService.onTickerUpdate((update: WsTickerUpdate) => {
      // Normalize update symbol to API format for consistent matching
      const normalizedUpdateSymbol = normalizeMarketSymbolToApiFormat(update.symbol).toUpperCase();
      let marketSymbol: string | undefined;

      // Try to find matching market symbol using normalized API format
      if (symbolMap.has(normalizedUpdateSymbol)) {
        marketSymbol = symbolMap.get(normalizedUpdateSymbol)!;
      } else {
        // Fallback: try reverse conversion if direct match fails
        const possibleMarketSymbol = convertApiSymbolToMarketFormat(normalizedUpdateSymbol);
        if (symbols.includes(possibleMarketSymbol)) {
          marketSymbol = possibleMarketSymbol;
        }
      }

      if (!marketSymbol) {
        // Skip if we don't recognize this symbol
        return;
      }

      // Convert WebSocket update to Ticker format
      const ticker: Ticker = {
        symbol: marketSymbol,
        last_price: update.last_price,
        price_change_24h: update.price_change_24h,
        price_change_percent_24h: update.price_change_percent_24h,
        high_24h: update.high_24h,
        low_24h: update.low_24h,
        volume_24h: update.volume_24h,
        open_interest: "0", // WebSocket update doesn't include this
        funding_rate: "0", // WebSocket update doesn't include this
        next_funding_time: 0, // WebSocket update doesn't include this
      };

      setTickersData((prev) => ({
        ...prev,
        [marketSymbol]: ticker,
      }));
    });

    // Unsubscribe from all tickers on cleanup
    const cleanup = () => {
      unsubscribe();
      symbols.forEach((symbol) => {
        const apiSymbol = convertSymbolToApiFormat(symbol);
        wsService.unsubscribeTicker(apiSymbol);
      });
    };

    subscriptionsRef.current = [cleanup];
    setTickersLoading(false);

    return cleanup;
  }, [chainId, symbols.join(",")]); // Use symbols.join(",") as dependency to avoid array reference issues

  // Combine markets with tickers — use REST API data as fallback when WebSocket
  // hasn't delivered ticker updates yet
  const markets = useMemo(() => {
    return marketsArray.map((market) => {
      const ticker = tickersData?.[market.symbol];
      return {
        ...market,
        ticker,
        lastPrice: ticker?.last_price || market.last_price?.toString(),
        volume24h: ticker?.volume_24h || market.volume_24h?.toString(),
        priceChangePercent: ticker?.price_change_percent_24h
          ? parseFloat(ticker.price_change_percent_24h)
          : market.price_change_percent_24h != null
            ? parseFloat(market.price_change_percent_24h.toString())
            : undefined,
      };
    });
  }, [marketsArray, tickersData]);

  const mutate = () => {
    mutateMarkets();
    // For WebSocket, we can't manually mutate, but we can trigger a re-subscription
    // by clearing and re-setting the tickers data
    setTickersData({});
  };

  return {
    markets,
    isLoading: marketsLoading || tickersLoading,
    error: (marketsError || tickersError) as Error | undefined,
    mutate,
  };
}

/**
 * Get single market ticker (using WebSocket)
 */
export function useTradingTicker(chainId: number | undefined, symbol: string | undefined) {
  const [ticker, setTicker] = useState<Ticker | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | undefined>();

  useEffect(() => {
    if (!chainId || !symbol) {
      setTicker(undefined);
      setIsLoading(false);
      return;
    }

    const wsService = getWebSocketService(chainId);
    const apiSymbol = convertSymbolToApiFormat(symbol);

    // Ensure WebSocket is connected
    if (!wsService.isConnected()) {
      wsService.connect();
    }

    setIsLoading(true);
    wsService.subscribeTicker(apiSymbol);

    const unsubscribe = wsService.onTickerUpdate((update: WsTickerUpdate) => {
      // Normalize update symbol for matching
      const normalizedUpdateSymbol = normalizeMarketSymbolToApiFormat(update.symbol);
      const normalizedTargetSymbol = normalizeMarketSymbolToApiFormat(symbol);

      // Only process updates for the target symbol
      if (normalizedUpdateSymbol.toUpperCase() !== normalizedTargetSymbol.toUpperCase()) {
        return;
      }

      // Convert WebSocket update to Ticker format with all available fields
      const tickerData: Ticker = {
        symbol: convertApiSymbolToMarketFormat(update.symbol),
        last_price: update.last_price,
        price_change_24h: update.price_change_24h,
        price_change_percent_24h: update.price_change_percent_24h,
        high_24h: update.high_24h,
        low_24h: update.low_24h,
        volume_24h: update.volume_24h,
        // Use update fields if available, otherwise default to "0"
        open_interest: (update as any).open_interest || "0",
        funding_rate: (update as any).funding_rate || "0",
        next_funding_time: (update as any).next_funding_time || 0,
        // Add extended fields for detailed OI and liquidity
        ...(update as any),
      };

      setTicker(tickerData);
      setIsLoading(false);
      setError(undefined);
    });

    return () => {
      unsubscribe();
      wsService.unsubscribeTicker(apiSymbol);
    };
  }, [chainId, symbol]);

  return {
    data: ticker,
    isLoading,
    error,
    mutate: () => {
      // WebSocket updates are automatic, no manual mutation needed
    },
  };
}

/**
 * Get selected market with ticker data
 */
export function useSelectedTradingMarket(
  chainId: number | undefined,
  selectedSymbol: string | null | undefined
): TradingMarket | null {
  const { markets } = useTradingMarketsWithTickers(chainId);

  return useMemo(() => {
    if (!selectedSymbol || !markets.length) return null;
    return markets.find((m) => m.symbol === selectedSymbol) || null;
  }, [markets, selectedSymbol]);
}
