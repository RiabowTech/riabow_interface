/**
 * Trading page state context.
 *
 * Holds the currently-selected chart symbol for the /trade route and exposes
 * a stable `isTradeMode` flag so components outside of React can check whether
 * the user is on the API-backed trading page.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type TradeProduct = "futures" | "spot";

interface TradeStateContextValue {
  isTradeMode: boolean;
  product: TradeProduct;
  selectedSymbol: string | null;
  setSelectedSymbol: (symbol: string) => void;
}

const TradeStateContext = createContext<TradeStateContextValue>({
  isTradeMode: false,
  product: "futures",
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

export function useTradeProduct(): TradeProduct {
  return useContext(TradeStateContext).product;
}

let activeTradeProduct: TradeProduct = "futures";

export function getActiveTradeProduct(): TradeProduct {
  return activeTradeProduct;
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
  product?: TradeProduct;
}

const TRADE_MODE_STORAGE_KEY = "trade_mode";
export const SELECTED_SYMBOL_STORAGE_KEY = "trade_selected_symbol";
export function getSelectedSymbolStorageKey(product: TradeProduct): string {
  return `${SELECTED_SYMBOL_STORAGE_KEY}_${product}`;
}
// Default symbol matches backend API format (e.g., "BTC-USD")
const DEFAULT_SYMBOL = "BTC-USD";

/**
 * Provider that marks the subtree as running in API-backed trading mode and
 * owns the currently-selected chart symbol.
 */
export function TradeStateProvider({ children, product = "futures" }: TradeStateProviderProps) {
  // Initialize selected symbol from localStorage or default
  const [selectedSymbol, setSelectedSymbolState] = useState<string | null>(() => {
    if (typeof window === "undefined") return DEFAULT_SYMBOL;
    return localStorage.getItem(getSelectedSymbolStorageKey(product)) || DEFAULT_SYMBOL;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    setSelectedSymbolState(localStorage.getItem(getSelectedSymbolStorageKey(product)) || DEFAULT_SYMBOL);
  }, [product]);

  const setSelectedSymbol = useCallback(
    (symbol: string) => {
      setSelectedSymbolState(symbol);
      if (typeof window !== "undefined") {
        localStorage.setItem(getSelectedSymbolStorageKey(product), symbol);
      }
    },
    [product]
  );

  // Set the API trading mode flag on mount, clear it on unmount.
  useEffect(() => {
    activeTradeProduct = product;
    enableTradeMode();
    return () => {
      disableTradeMode();
      activeTradeProduct = "futures";
    };
  }, [product]);

  const value = useMemo<TradeStateContextValue>(
    () => ({
      isTradeMode: true,
      product,
      selectedSymbol,
      setSelectedSymbol,
    }),
    [product, selectedSymbol, setSelectedSymbol]
  );

  return <TradeStateContext.Provider value={value}>{children}</TradeStateContext.Provider>;
}
