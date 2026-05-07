import { describe, expect, it } from "vitest";

import { aggregateOrderBookLevels, computeOrderBookGroupOptions, parseOrderBookGroupTick } from "./orderBookAggregation";

describe("useOrderBookAdapter helpers", () => {
  it("parses grouped tick values with commas", () => {
    expect(parseOrderBookGroupTick("0.1")).toBe(0.1);
    expect(parseOrderBookGroupTick("100")).toBe(100);
    expect(parseOrderBookGroupTick("1,000")).toBe(1000);
  });

  it("aggregates asks upward by selected tick size", () => {
    const asks = aggregateOrderBookLevels(
      [
        ["73834.5", "0.1"],
        ["73860.0", "0.2"],
        ["73920.0", "0.3"],
      ],
      "ask",
      100
    );

    expect(asks).toEqual([
      {
        price: 73900,
        size: 0.30000000000000004,
        total: 0.30000000000000004,
        quoteSize: 22170.000000000004,
        quoteTotal: 22170.000000000004,
      },
      {
        price: 74000,
        size: 0.3,
        total: 0.6000000000000001,
        quoteSize: 22200,
        quoteTotal: 44370,
      },
    ]);
  });

  it("aggregates bids downward by selected tick size", () => {
    const bids = aggregateOrderBookLevels(
      [
        ["73834.5", "0.1"],
        ["73799.9", "0.2"],
        ["73710.0", "0.3"],
      ],
      "bid",
      100
    );

    expect(bids).toEqual([
      { price: 73800, size: 0.1, total: 0.1, quoteSize: 7380, quoteTotal: 7380 },
      { price: 73700, size: 0.5, total: 0.6, quoteSize: 36850, quoteTotal: 44230 },
    ]);
  });

  it("computes dynamic group options from current orderbook", () => {
    const options = computeOrderBookGroupOptions({
      asks: [
        ["73834.5", "0.1"],
        ["73835.0", "0.2"],
        ["73836.0", "0.3"],
        ["73837.0", "0.4"],
      ],
      bids: [
        ["73834.0", "0.1"],
        ["73833.0", "0.2"],
        ["73832.0", "0.3"],
        ["73831.0", "0.4"],
      ],
    });

    expect(options).toEqual(["1", "10", "100", "1000"]);
  });
});
