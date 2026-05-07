/**
 * useWebSocket - React hooks for WebSocket integration
 * Provides real-time updates for positions, orders, and market data
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useAccount } from "wagmi";

import { isAuthenticated } from "./client";
import {
  getWebSocketService,
  WebSocketService,
  WsPositionUpdate,
  WsOrderUpdate,
  WsBalanceUpdate,
  WsPriceUpdate,
  WsOrderbookUpdate,
  WsTickerUpdate,
  WsTradeUpdate,
  normalizeMarketSymbolToApiFormat,
} from "./websocket";

// Connection status
export type WsConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

/**
 * Core WebSocket hook - manages connection lifecycle
 */
export function useWebSocketConnection(chainId: number | undefined) {
  const { address } = useAccount();
  const [status, setStatus] = useState<WsConnectionStatus>("disconnected");
  const wsRef = useRef<WebSocketService | null>(null);

  useEffect(() => {
    if (!chainId) {
      setStatus("disconnected");
      return;
    }

    const ws = getWebSocketService(chainId);
    wsRef.current = ws;

    const unsubConnect = ws.onConnect(() => {
      setStatus("connected");
      // Auto-authenticate if logged in
      if (isAuthenticated(address, chainId)) {
        ws.authenticate(address);
      }
    });

    const unsubDisconnect = ws.onDisconnect(() => {
      setStatus("disconnected");
    });

    const unsubError = ws.onError(() => {
      setStatus("error");
    });

    // Connect
    setStatus("connecting");
    ws.connect();

    return () => {
      unsubConnect();
      unsubDisconnect();
      unsubError();
    };
  }, [chainId, address]);

  return { status, ws: wsRef.current };
}

/**
 * Hook for subscribing to private position updates
 */
export function usePositionUpdates(
  chainId: number | undefined,
  onUpdate?: (update: WsPositionUpdate) => void
) {
  const { address } = useAccount();
  const authenticated = isAuthenticated(address, chainId);
  const [lastUpdate, setLastUpdate] = useState<WsPositionUpdate | null>(null);

  useEffect(() => {
    if (!chainId || !authenticated || !address) return;

    const ws = getWebSocketService(chainId);

    // Subscribe to positions
    ws.subscribePositions(address);

    // Handle updates
    const unsub = ws.onPositionUpdate((update) => {
      setLastUpdate(update);
      onUpdate?.(update);
    });

    return () => {
      unsub();
      ws.unsubscribePositions();
    };
  }, [chainId, authenticated, address, onUpdate]);

  return { lastUpdate };
}

/**
 * Hook for subscribing to private order updates
 */
export function useOrderUpdates(
  chainId: number | undefined,
  onUpdate?: (update: WsOrderUpdate) => void
) {
  const { address } = useAccount();
  const authenticated = isAuthenticated(address, chainId);
  const [lastUpdate, setLastUpdate] = useState<WsOrderUpdate | null>(null);

  useEffect(() => {
    if (!chainId || !authenticated || !address) return;

    const ws = getWebSocketService(chainId);

    // Subscribe to orders
    ws.subscribeOrders(address);

    // Handle updates
    const unsub = ws.onOrderUpdate((update) => {
      setLastUpdate(update);
      onUpdate?.(update);
    });

    return () => {
      unsub();
      ws.unsubscribeOrders();
    };
  }, [chainId, authenticated, address, onUpdate]);

  return { lastUpdate };
}

/**
 * Hook for subscribing to private balance updates
 */
export function useBalanceUpdates(
  chainId: number | undefined,
  onUpdate?: (update: WsBalanceUpdate) => void
) {
  const { address } = useAccount();
  const authenticated = isAuthenticated(address, chainId);
  const [lastUpdate, setLastUpdate] = useState<WsBalanceUpdate | null>(null);

  useEffect(() => {
    if (!chainId || !authenticated || !address) return;

    const ws = getWebSocketService(chainId);

    // Subscribe to balances
    ws.subscribeBalances(address);

    // Handle updates
    const unsub = ws.onBalanceUpdate((update) => {
      setLastUpdate(update);
      onUpdate?.(update);
    });

    return () => {
      unsub();
      ws.unsubscribeBalances();
    };
  }, [chainId, authenticated, address, onUpdate]);

  return { lastUpdate };
}

/**
 * Hook for subscribing to price updates
 */
export function usePriceUpdates(
  chainId: number | undefined,
  symbols: string[],
  onUpdate?: (update: WsPriceUpdate) => void
) {
  const [prices, setPrices] = useState<Record<string, WsPriceUpdate>>({});

  useEffect(() => {
    if (!chainId || symbols.length === 0) return;

    const ws = getWebSocketService(chainId);

    // Subscribe to prices
    ws.subscribePrices(symbols);

    // Handle updates
    const unsub = ws.onPriceUpdate((update) => {
      setPrices((prev) => ({
        ...prev,
        [update.symbol]: update,
      }));
      onUpdate?.(update);
    });

    return () => {
      unsub();
      ws.unsubscribePrices(symbols);
    };
  }, [chainId, symbols.join(","), onUpdate]);

  return { prices };
}

/**
 * Hook for subscribing to orderbook updates
 */
export function useOrderbookUpdates(
  chainId: number | undefined,
  symbol: string | undefined,
  onUpdate?: (update: WsOrderbookUpdate) => void
) {
  const [orderbook, setOrderbook] = useState<WsOrderbookUpdate | null>(null);

  useEffect(() => {
    if (!chainId || !symbol) return;

    const ws = getWebSocketService(chainId);

    // Ensure WebSocket is connected
    if (!ws.isConnected()) {
      ws.connect();
    }

    // Subscribe to orderbook
    ws.subscribeOrderbook(symbol);

    // Handle updates - normalize symbols for comparison
    const targetSymbol = normalizeMarketSymbolToApiFormat(symbol);
    const unsub = ws.onOrderbookUpdate((update) => {
      const updateSymbol = update.symbol ? normalizeMarketSymbolToApiFormat(update.symbol) : undefined;

      if (updateSymbol === targetSymbol) {
        setOrderbook(update);
        onUpdate?.(update);
      }
    });

    return () => {
      unsub();
      ws.unsubscribeOrderbook(symbol);
    };
  }, [chainId, symbol, onUpdate]);

  return { orderbook };
}

/**
 * Hook for subscribing to ticker updates
 */
export function useTickerUpdates(
  chainId: number | undefined,
  symbol: string | undefined,
  onUpdate?: (update: WsTickerUpdate) => void
) {
  const [ticker, setTicker] = useState<WsTickerUpdate | null>(null);

  useEffect(() => {
    if (!chainId || !symbol) return;

    const ws = getWebSocketService(chainId);

    // Ensure WebSocket is connected
    if (!ws.isConnected()) {
      ws.connect();
    }

    // Subscribe to ticker
    ws.subscribeTicker(symbol);

    // Handle updates - normalize symbols for comparison
    const targetSymbol = normalizeMarketSymbolToApiFormat(symbol);
    const unsub = ws.onTickerUpdate((update) => {
      const updateSymbol = normalizeMarketSymbolToApiFormat(update.symbol);

      if (updateSymbol === targetSymbol) {
        setTicker(update);
        onUpdate?.(update);
      }
    });

    return () => {
      unsub();
      ws.unsubscribeTicker(symbol);
    };
  }, [chainId, symbol, onUpdate]);

  return { ticker };
}

/**
 * Hook for subscribing to trade updates
 */
export function useTradesUpdates(
  chainId: number | undefined,
  symbol: string | undefined,
  onUpdate?: (update: WsTradeUpdate) => void
) {
  const [lastTrade, setLastTrade] = useState<WsTradeUpdate | null>(null);

  useEffect(() => {
    if (!chainId || !symbol) return;

    const ws = getWebSocketService(chainId);

    // Ensure WebSocket is connected
    if (!ws.isConnected()) {
      ws.connect();
    }

    // Subscribe to trades
    ws.subscribeTrades(symbol);

    // Handle updates - normalize symbols for comparison
    const targetSymbol = normalizeMarketSymbolToApiFormat(symbol);
    const unsub = ws.onTradeUpdate((update) => {
      const updateSymbol = normalizeMarketSymbolToApiFormat(update.symbol);

      if (updateSymbol === targetSymbol) {
        setLastTrade(update);
        onUpdate?.(update);
      }
    });

    return () => {
      unsub();
      ws.unsubscribeTrades(symbol);
    };
  }, [chainId, symbol, onUpdate]);

  return { lastTrade };
}

/**
 * Combined hook for all private channel subscriptions
 */
export function usePrivateChannels(chainId: number | undefined) {
  const { address } = useAccount();
  const authenticated = isAuthenticated(address, chainId);

  const [positionUpdates, setPositionUpdates] = useState<WsPositionUpdate[]>([]);
  const [orderUpdates, setOrderUpdates] = useState<WsOrderUpdate[]>([]);
  const [balanceUpdates, setBalanceUpdates] = useState<WsBalanceUpdate[]>([]);

  const handlePositionUpdate = useCallback((update: WsPositionUpdate) => {
    setPositionUpdates((prev) => [...prev.slice(-99), update]);
  }, []);

  const handleOrderUpdate = useCallback((update: WsOrderUpdate) => {
    setOrderUpdates((prev) => [...prev.slice(-99), update]);
  }, []);

  const handleBalanceUpdate = useCallback((update: WsBalanceUpdate) => {
    setBalanceUpdates((prev) => [...prev.slice(-99), update]);
  }, []);

  usePositionUpdates(chainId, handlePositionUpdate);
  useOrderUpdates(chainId, handleOrderUpdate);
  useBalanceUpdates(chainId, handleBalanceUpdate);

  const clearUpdates = useCallback(() => {
    setPositionUpdates([]);
    setOrderUpdates([]);
    setBalanceUpdates([]);
  }, []);

  return {
    positionUpdates,
    orderUpdates,
    balanceUpdates,
    clearUpdates,
    isSubscribed: authenticated && !!address,
  };
}
