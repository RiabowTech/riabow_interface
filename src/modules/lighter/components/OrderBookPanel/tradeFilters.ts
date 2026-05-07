import type { Trade } from "../../adapters/useTradesAdapter";

export type TradeModeFilter = "all" | "asks" | "bids";
export type TradeSideFilter = "All" | "Buys" | "Sells";
export type TradeSizeFilter =
  | "All"
  | "> 0.00100"
  | "> 0.00200"
  | "> 0.00500"
  | "> 0.01000"
  | "> 0.10000"
  | "> 1.00000"
  | "> 10.00000";

export const TRADE_SIDE_FILTERS: readonly TradeSideFilter[] = ["All", "Buys", "Sells"];
export const TRADE_SIZE_FILTERS: readonly TradeSizeFilter[] = [
  "All",
  "> 0.00100",
  "> 0.00200",
  "> 0.00500",
  "> 0.01000",
  "> 0.10000",
  "> 1.00000",
  "> 10.00000",
];

export function parseTradeSizeThreshold(filter: TradeSizeFilter): number {
  if (filter === "All") return 0;
  return Number(filter.replace(/[>\s,]/g, ""));
}

export function filterTrades(
  trades: Trade[],
  modeFilter: TradeModeFilter,
  sideFilter: TradeSideFilter,
  sizeFilter: TradeSizeFilter
): Trade[] {
  const threshold = parseTradeSizeThreshold(sizeFilter);

  return trades.filter((trade) => {
    if (modeFilter === "asks" && trade.side !== "sell") return false;
    if (modeFilter === "bids" && trade.side !== "buy") return false;
    if (sideFilter === "Buys" && trade.side !== "buy") return false;
    if (sideFilter === "Sells" && trade.side !== "sell") return false;
    if (threshold > 0 && !(trade.size > threshold)) return false;
    return true;
  });
}
