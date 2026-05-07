import { useMemo } from "react";

import { usePrimitUserPositions } from "modules/lighter/api/hooks";
import type { Position } from "modules/lighter/api/types";

export type LighterPosition = {
  positionId: string;
  market: string;
  leverage: string;
  side: "long" | "short";
  size: number;
  sizeTokenAmount: number;
  positionValue: number;
  entryPrice: number;
  markPrice: number;
  liqPrice: number | null;
  unrealizedPnl: number;
  unrealizedPnlPct: number | null;
  margin: number;
  funding: number | null;
  takeProfit: number | null;
  stopLoss: number | null;
};

function parseNumber(value: string | number | null | undefined): number {
  if (value == null) return 0;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toMarket(symbol: string): string {
  if (!symbol) return "?";
  return symbol.endsWith("USDT") ? symbol.slice(0, -4) : symbol;
}

function toPosition(position: Position): LighterPosition {
  const pnlPercent = parseNumber(position.unrealized_pnl_percent);

  return {
    positionId: position.position_id || position.id || "",
    market: toMarket(position.symbol),
    leverage: position.leverage > 0 ? `${position.leverage}x` : "--",
    side: position.side,
    size: parseNumber(position.size),
    sizeTokenAmount: parseNumber(position.amount),
    positionValue: parseNumber(position.size),
    entryPrice: parseNumber(position.entry_price),
    markPrice: parseNumber(position.mark_price),
    liqPrice: position.liquidation_price ? parseNumber(position.liquidation_price) : null,
    unrealizedPnl: parseNumber(position.unrealized_pnl),
    unrealizedPnlPct: Number.isFinite(pnlPercent) ? pnlPercent * 100 : null,
    margin: parseNumber(position.collateral_amount || position.margin),
    funding: null,
    takeProfit: position.take_profit_price ? parseNumber(position.take_profit_price) : null,
    stopLoss: position.stop_loss_price ? parseNumber(position.stop_loss_price) : null,
  };
}

export function usePositionsAdapter(): LighterPosition[] {
  const { data } = usePrimitUserPositions();

  return useMemo(() => {
    return (data?.positions ?? []).map(toPosition);
  }, [data?.positions]);
}
