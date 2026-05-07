import { describe, expect, it } from "vitest";

import { mapUnifiedAccountToPanelModel } from "./unifiedAccountMapping";

describe("mapUnifiedAccountToPanelModel", () => {
  it("maps unified account response fields and calculates cross leverage", () => {
    const model = mapUnifiedAccountToPanelModel({
      margin_mode: "unified",
      wallet_balance: "1000.00",
      total_equity: "1250.50",
      available_balance: "800.00",
      total_initial_margin: "250.00",
      total_maintenance_margin: "50.00",
      total_unrealized_pnl: "15.25",
      uni_mmr: "0.05",
      account_status: "normal",
    });

    expect(model.perpetualsEquity).toBe(1250.5);
    expect(model.spotEquity).toBe(1000);
    expect(model.unrealizedPnl).toBe(15.25);
    expect(model.crossMarginUsage).toBe(250);
    expect(model.maintenanceMargin).toBe(50);
    expect(model.crossMarginRatio).toBe(0.05);
    expect(model.crossLeverage).toBe(0.25);
  });

  it("returns null cross leverage when wallet balance is zero", () => {
    const model = mapUnifiedAccountToPanelModel({
      margin_mode: "unified",
      wallet_balance: "0",
      total_equity: "1250.50",
      available_balance: "800.00",
      total_initial_margin: "250.00",
      total_maintenance_margin: "50.00",
      total_unrealized_pnl: "15.25",
      uni_mmr: "0.05",
      account_status: "normal",
    });

    expect(model.crossLeverage).toBeNull();
  });
});
