/**
 * Trading page state context.
 *
 * Holds the currently-selected chart symbol for the /trade route and exposes
 * a stable `isTradeMode` flag so components outside of React can check whether
 * the user is on the API-backed trading page.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

interface TradeStateContextValue {
  isTradeMode: boolean;
  selectedSymbol: string | null;
  setSelectedSymbol: (symbol: string) => void;
}

const TradeStateContext = createContext<TradeStateContextValue>({
  isTradeMode: false,
  selectedSymbol: null,
  setSelectedSymbol: (_symbol: string) => undefined,
});

export function useTradeState() {
  return useContext(TradeStateContext);
}

/**
 * Check whether API-backed trading mode is active (React hook variant).
 */
export function useIsTradeMode(): boolean {
  const context = useContext(TradeStateContext);
  return context.isTradeMode;
}

/**
 * Check whether API-backed trading mode is active outside React.
 *
 * The trading page always runs in API-backed mode once the provider mounts,
 * so this is effectively a static `true` at the moment — retained as a hook
 * point in case the mode ever becomes conditional again.
 */
export function isTradeModeActive(): boolean {
  return true;
}

/**
 * Flip the persisted trade-mode flag on.
 * Preserved for code that reads the raw localStorage key from outside React.
 */
export function enableTradeMode(): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(TRADE_MODE_STORAGE_KEY, "true");
  }
}

/**
 * Flip the persisted trade-mode flag off.
 */
export function disableTradeMode(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(TRADE_MODE_STORAGE_KEY);
  }
}

interface TradeStateProviderProps {
  children: ReactNode;
}

const TRADE_MODE_STORAGE_KEY = "trade_mode";
export const SELECTED_SYMBOL_STORAGE_KEY = "trade_selected_symbol";
// Default symbol matches backend API format (e.g., "BTC-USD")
const DEFAULT_SYMBOL = "BTC-USD";

/**
 * Provider that marks the subtree as running in API-backed trading mode and
 * owns the currently-selected chart symbol.
 */
export function TradeStateProvider({ children }: TradeStateProviderProps) {
  // Initialize selected symbol from localStorage or default
  const [selectedSymbol, setSelectedSymbolState] = useState<string | null>(() => {
    if (typeof window === "undefined") return DEFAULT_SYMBOL;
    return localStorage.getItem(SELECTED_SYMBOL_STORAGE_KEY) || DEFAULT_SYMBOL;
  });

  const setSelectedSymbol = useCallback((symbol: string) => {
    setSelectedSymbolState(symbol);
    if (typeof window !== "undefined") {
      localStorage.setItem(SELECTED_SYMBOL_STORAGE_KEY, symbol);
    }
  }, []);

  // Set the API trading mode flag on mount, clear it on unmount.
  useEffect(() => {
    enableTradeMode();
    return () => {
      disableTradeMode();
    };
  }, []);

  const value = useMemo<TradeStateContextValue>(
    () => ({
      isTradeMode: true,
      selectedSymbol,
      setSelectedSymbol,
    }),
    [selectedSymbol, setSelectedSymbol]
  );

  return <TradeStateContext.Provider value={value}>{children}</TradeStateContext.Provider>;
}
