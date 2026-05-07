import type { UnifiedAccountResponse } from "modules/lighter/api/custom/client";

export type LighterUnifiedAccountPanelModel = {
  perpetualsEquity: number | null;
  spotEquity: number | null;
  unrealizedPnl: number | null;
  crossMarginUsage: number | null;
  maintenanceMargin: number | null;
  crossMarginRatio: number | null;
  crossLeverage: number | null;
};

function parseNumber(value: string | number | null | undefined): number | null {
  if (value == null) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function mapUnifiedAccountToPanelModel(
  account: UnifiedAccountResponse | null | undefined
): LighterUnifiedAccountPanelModel {
  const spotEquity = parseNumber(account?.wallet_balance);
  const crossMarginUsage = parseNumber(account?.total_initial_margin);

  return {
    perpetualsEquity: parseNumber(account?.total_equity),
    spotEquity,
    unrealizedPnl: parseNumber(account?.total_unrealized_pnl),
    crossMarginUsage,
    maintenanceMargin: parseNumber(account?.total_maintenance_margin),
    crossMarginRatio: parseNumber(account?.uni_mmr),
    crossLeverage:
      spotEquity && spotEquity > 0 && crossMarginUsage != null ? crossMarginUsage / spotEquity : null,
  };
}
