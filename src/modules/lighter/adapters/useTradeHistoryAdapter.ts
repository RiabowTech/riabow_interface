import { useCallback, useMemo } from "react";

import { useUserAccountTrades } from "modules/lighter/api";

export type LighterTradeHistoryRow = {
  id: string;
  market: string;
  side: string;
  date: number;
  tradeValue: number | null;
  size: number | null;
  price: number | null;
  closedPnl: number | null;
  fee: number | null;
  role: string;
  type: string;
};

export type UseTradeHistoryAdapterResult = {
  rows: LighterTradeHistoryRow[];
  refreshTradeHistory: () => void;
};

function toNumber(value: string | number | null | undefined) {
  if (value == null) return null;
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function toLower(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function pickTimestamp(trade: Record<string, unknown>) {
  const candidates = [trade.executed_at, trade.created_at, trade.timestamp];

  for (const candidate of candidates) {
    if (typeof candidate === "number" && Number.isFinite(candidate)) return candidate;
    if (typeof candidate === "string") {
      const ms = new Date(candidate).getTime();
      if (!Number.isNaN(ms)) return ms;
      const numeric = Number(candidate);
      if (Number.isFinite(numeric)) return numeric;
    }
  }

  return 0;
}

function deriveSide(trade: Record<string, unknown>) {
  const side = toLower(trade.side);
  const positionSide = toLower(trade.position_side);

  if (positionSide === "long") return "Long";
  if (positionSide === "short") return "Short";
  if (side === "buy") return "Long";
  if (side === "sell") return "Short";
  return "--";
}

function deriveRole(trade: Record<string, unknown>) {
  const explicitRole = toLower(trade.role || trade.liquidity);
  if (explicitRole === "maker") return "Maker";
  if (explicitRole === "taker") return "Taker";
  if (trade.is_maker === true) return "Maker";
  if (trade.is_maker === false) return "Taker";
  return "Taker";
}

function deriveType(trade: Record<string, unknown>) {
  const rawType = toLower(trade.trade_type || trade.execution_type || trade.type);
  if (!rawType) return "Trade";
  if (rawType.includes("liquid")) return "Liquidation";
  if (rawType.includes("deleverage") || rawType.includes("adl")) return "Deleverage";
  if (rawType.includes("settlement")) return "Market Settlement";
  return "Trade";
}

export function useTradeHistoryAdapterState(): UseTradeHistoryAdapterResult {
  const { trades, mutate } = useUserAccountTrades();

  const rows = useMemo(() => {
    return (trades ?? [])
      .map((trade) => {
        const rawTrade = trade as Record<string, unknown>;
        const price = toNumber(trade.price);
        const size = toNumber((rawTrade.size as string | number | null | undefined) ?? trade.amount);
        const tradeValue = price != null && size != null ? price * size : null;
        const marketSymbol = (rawTrade.market_symbol as string | undefined) ?? trade.symbol ?? "--";

        return {
          id: trade.id,
          market: marketSymbol.replace(/USDT$/i, "") || "--",
          side: deriveSide(rawTrade),
          date: pickTimestamp(rawTrade),
          tradeValue,
          size,
          price,
          closedPnl: toNumber((rawTrade.pnl as string | number | null | undefined) ?? trade.realized_pnl),
          fee: toNumber(trade.fee),
          role: deriveRole(rawTrade),
          type: deriveType(rawTrade),
        };
      })
      .sort((a, b) => b.date - a.date);
  }, [trades]);

  const refreshTradeHistory = useCallback(() => {
    void mutate();
  }, [mutate]);

  return {
    rows,
    refreshTradeHistory,
  };
}

export function useTradeHistoryAdapter(): LighterTradeHistoryRow[] {
  return useTradeHistoryAdapterState().rows;
}
