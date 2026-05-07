import { describe, expect, it } from "vitest";

import type { Trade } from "../../adapters/useTradesAdapter";
import { filterTrades, parseTradeSizeThreshold } from "./tradeFilters";

const SAMPLE_TRADES: Trade[] = [
  { time: "12:00:00", size: 0.0008, price: 1, side: "buy" },
  { time: "12:00:01", size: 0.0015, price: 1, side: "sell" },
  { time: "12:00:02", size: 0.2, price: 1, side: "buy" },
];

describe("tradeFilters", () => {
  it("parses size thresholds from menu labels", () => {
    expect(parseTradeSizeThreshold("All")).toBe(0);
    expect(parseTradeSizeThreshold("> 0.00100")).toBe(0.001);
    expect(parseTradeSizeThreshold("> 10.00000")).toBe(10);
  });

  it("filters trades by side", () => {
    expect(filterTrades(SAMPLE_TRADES, "all", "Buys", "All")).toHaveLength(2);
    expect(filterTrades(SAMPLE_TRADES, "all", "Sells", "All")).toHaveLength(1);
  });

  it("filters trades by strict greater-than size threshold", () => {
    const filtered = filterTrades(SAMPLE_TRADES, "all", "All", "> 0.00100");

    expect(filtered).toEqual([
      { time: "12:00:01", size: 0.0015, price: 1, side: "sell" },
      { time: "12:00:02", size: 0.2, price: 1, side: "buy" },
    ]);
  });

  it("combines side and size filters", () => {
    const filtered = filterTrades(SAMPLE_TRADES, "all", "Buys", "> 0.00100");

    expect(filtered).toEqual([{ time: "12:00:02", size: 0.2, price: 1, side: "buy" }]);
  });

  it("applies color mode filter before trade filters", () => {
    expect(filterTrades(SAMPLE_TRADES, "asks", "All", "All")).toEqual([
      { time: "12:00:01", size: 0.0015, price: 1, side: "sell" },
    ]);
    expect(filterTrades(SAMPLE_TRADES, "bids", "All", "All")).toEqual([
      { time: "12:00:00", size: 0.0008, price: 1, side: "buy" },
      { time: "12:00:02", size: 0.2, price: 1, side: "buy" },
    ]);
  });
});
