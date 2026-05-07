import { describe, expect, it } from "vitest";

import { formatFundingFeeHistoryRows } from "./fundingFeeHistory";

describe("formatFundingFeeHistoryRows", () => {
  it("formats funding fee records for table output", () => {
    const rows = formatFundingFeeHistoryRows([
      {
        symbol: "BTCUSDT",
        fundingRate: "0.0001",
        positionSize: "60000.00",
        fundingFee: "-6.00",
        positionSide: "LONG",
        asset: "USDT",
        time: 1776060000000,
        tranId: "abc",
      },
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0].market).toBe("BTC/USDT");
    expect(rows[0].rate).toBe("0.0100%");
    expect(rows[0].payment).toBe("-6.00 USDT");
    expect(rows[0].position).toBe("LONG");
    expect(rows[0].size).toBe("$60,000.00");
  });
});
