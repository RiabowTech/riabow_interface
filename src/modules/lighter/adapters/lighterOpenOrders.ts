import type { Order as ApiOrder, TriggerType } from "@/modules/lighter/api/types";

export type LighterOpenOrder = {
  id: string;
  market: string;
  side: "long" | "short";
  type: "market" | "limit";
  triggerType: TriggerType | null;
  amount: number;
  filled: number | null;
  price: number;
  markPrice: number | null;
  reduceOnly: boolean | null;
  margin: number | null;
  triggerConditions: string | null;
  expiresIn: string | null;
  takeProfit: number | null;
  stopLoss: number | null;
  status: string;
  createdAt: number;
};

export function safeNumber(v: string | number | null | undefined): number {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function normalizeTimestamp(ts: number | string | null | undefined): number {
  if (ts == null) return 0;
  if (typeof ts === "number") return ts < 1e12 ? ts * 1000 : ts;

  const asNum = Number(ts);
  if (Number.isFinite(asNum)) return asNum < 1e12 ? asNum * 1000 : asNum;

  const parsed = Date.parse(ts);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function symbolToMarket(symbol: string): string {
  return symbol.replace(/USDT?$/i, "");
}

export function formatExpiry(at: number | string): string {
  const ms = normalizeTimestamp(at);
  if (!ms) return "--";

  const diffMs = ms - Date.now();
  if (diffMs <= 0) return "Expired";

  const days = Math.floor(diffMs / 86_400_000);
  const hours = Math.floor((diffMs % 86_400_000) / 3_600_000);

  if (days > 0) return `${days}d`;
  return `${hours}h`;
}

export function mapApiOrderToLighterOpenOrder(apiOrder: ApiOrder): LighterOpenOrder {
  const orderType = (apiOrder.order_type || "").toLowerCase();
  const sideRaw = (apiOrder.side || "").toLowerCase();
  const side: "long" | "short" = sideRaw === "buy" || sideRaw === "long" ? "long" : "short";
  const amount = safeNumber(apiOrder.size);
  const filled = safeNumber(apiOrder.filled_size ?? apiOrder.filled_amount);

  return {
    id: String(apiOrder.id ?? apiOrder.client_order_id ?? `${apiOrder.symbol}-${apiOrder.created_at}`),
    market: symbolToMarket(apiOrder.symbol || ""),
    side,
    type: orderType === "market" ? "market" : "limit",
    triggerType: apiOrder.trigger_type ?? null,
    amount,
    filled: filled || 0,
    price: safeNumber(apiOrder.price ?? apiOrder.trigger_price),
    markPrice: safeNumber(apiOrder.mark_price) || null,
    reduceOnly: apiOrder.reduce_only ?? null,
    margin: null,
    triggerConditions: apiOrder.trigger_price ? `${apiOrder.trigger_price}` : null,
    expiresIn: null,
    takeProfit: apiOrder.tp_price ? safeNumber(apiOrder.tp_price) : null,
    stopLoss: apiOrder.sl_price ? safeNumber(apiOrder.sl_price) : null,
    status: apiOrder.status ?? "open",
    createdAt: normalizeTimestamp(apiOrder.created_at),
  };
}
