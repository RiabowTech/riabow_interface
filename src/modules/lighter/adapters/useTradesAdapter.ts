import { useEffect, useMemo, useState } from "react";

import { useChainId } from "lib/chains";
import { useApiTrades, useTradesUpdates } from "modules/lighter/api";
import { useTradeState } from "modules/lighter/store/TradeStateContext";

export type TradeSide = "buy" | "sell";
export type Trade = {
  time: string; // HH:MM:SS
  size: number;
  price: number;
  side: TradeSide;
};

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

function formatTime(ts: number | string): string {
  const ms = typeof ts === "number" ? ts * (ts < 1e12 ? 1000 : 1) : Date.parse(ts);
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "--:--:--";
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function normalizeTimestamp(ts: number | string): number {
  if (typeof ts === "number") {
    return ts < 1e12 ? ts * 1000 : ts;
  }

  const parsed = Date.parse(ts);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function useTradesAdapter(): Trade[] {
  const { chainId } = useChainId();
  const { selectedSymbol } = useTradeState();
  const { trades } = useApiTrades(chainId, selectedSymbol ?? undefined, {
    refreshInterval: 0,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });
  const { lastTrade } = useTradesUpdates(chainId, selectedSymbol ?? undefined);
  const [liveTrades, setLiveTrades] = useState<
    Array<{ id: string; price: string; amount: string; side: TradeSide; timestamp: number | string }>
  >([]);

  useEffect(() => {
    setLiveTrades(trades?.trades ?? []);
  }, [selectedSymbol, trades?.trades]);

  useEffect(() => {
    if (!lastTrade) return;

    const id =
      lastTrade.id ??
      `${selectedSymbol ?? "UNKNOWN"}:${lastTrade.timestamp}:${lastTrade.price}:${lastTrade.amount}:${lastTrade.side}`;

    setLiveTrades((prev) => {
      if (prev.some((trade) => trade.id === id)) {
        return prev;
      }

      return [{ ...lastTrade, id }, ...prev].slice(0, 50);
    });
  }, [lastTrade, selectedSymbol]);

  return useMemo(() => {
    const list = liveTrades;
    if (!list || !list.length) return [];

    return list
      .map((t) => ({
        time: formatTime(t.timestamp),
        size: Number(t.amount) || 0,
        price: Number(t.price) || 0,
        timestamp: normalizeTimestamp(t.timestamp),
        side: (t.side === "buy" ? "buy" : "sell") as TradeSide,
      }))
      .sort((a, b) => b.timestamp - a.timestamp)
      .filter((t) => t.size > 0 && t.price > 0);
  }, [liveTrades]).map(({ timestamp: _timestamp, ...trade }) => trade);
}
