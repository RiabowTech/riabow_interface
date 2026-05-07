import { useMemo } from "react";

import { useUserApiOrders } from "modules/lighter/api";

type LighterOrderHistoryStatus = "filled" | "cancelled" | "rejected" | "expired" | "--";

export type LighterOrderHistoryRow = {
  id: string;
  market: string;
  side: "long" | "short" | "--";
  date: number;
  type: string;
  amount: number | null;
  filled: number | null;
  price: number | null;
  average: number | null;
  reduceOnly: boolean | null;
  status: LighterOrderHistoryStatus;
};

const CLOSED_STATUSES = new Set(["filled", "cancelled", "rejected", "expired"]);

function toNumber(value: string | number | null | undefined) {
  if (value == null) return null;
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export function useOrderHistoryAdapter(): LighterOrderHistoryRow[] {
  const { apiOrders } = useUserApiOrders();

  return useMemo(() => {
    const rows = (apiOrders ?? [])
      .filter((order) => CLOSED_STATUSES.has(order.status))
      .map((order) => ({
        id: order.id,
        market: order.symbol?.replace(/USDT$/i, "") || "--",
        side: order.side === "buy" ? "long" : order.side === "sell" ? "short" : "--",
        date: order.updated_at || order.created_at || 0,
        type: order.order_type === "market" ? "Market" : "Limit",
        amount: toNumber(order.size),
        filled: toNumber(order.filled_amount ?? order.filled_size),
        price: toNumber(order.price),
        average: toNumber(order.average_price),
        reduceOnly: order.reduce_only ?? null,
        status:
          order.status === "filled" ||
          order.status === "cancelled" ||
          order.status === "rejected" ||
          order.status === "expired"
            ? order.status
            : "--",
      }))
      .sort((a, b) => b.date - a.date);

    return rows;
  }, [apiOrders]);
}
