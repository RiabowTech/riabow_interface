import type { TradeProduct } from "@/modules/lighter/store/TradeStateContext";
import { getTradingBackendUrl, getTradingWsUrl } from "config/backend";

export type { TradeProduct };

export const DEFAULT_TRADE_PRODUCT: TradeProduct = "futures";

const FUTURES_API_PREFIX = normalizePrefix(import.meta.env.VITE_FUTURES_API_PREFIX || "");
const SPOT_API_PREFIX = normalizePrefix(import.meta.env.VITE_SPOT_API_PREFIX || "/spot");
const FUTURES_API_URL = import.meta.env.VITE_FUTURES_API_URL || "";
const SPOT_API_URL = import.meta.env.VITE_SPOT_API_URL || "";
const FUTURES_WS_URL = import.meta.env.VITE_FUTURES_WS_URL || "";
const SPOT_WS_URL = import.meta.env.VITE_SPOT_WS_URL || "";
const FUTURES_WS_CHANNEL_PREFIX = normalizeChannelPrefix(import.meta.env.VITE_FUTURES_WS_CHANNEL_PREFIX || "");
const SPOT_WS_CHANNEL_PREFIX = normalizeChannelPrefix(import.meta.env.VITE_SPOT_WS_CHANNEL_PREFIX || "spot");

function normalizePrefix(prefix: string): string {
  const trimmed = prefix.trim();
  if (!trimmed || trimmed === "/") return "";
  return trimmed.startsWith("/") ? trimmed.replace(/\/+$/, "") : `/${trimmed.replace(/\/+$/, "")}`;
}

function normalizeChannelPrefix(prefix: string): string {
  return prefix.trim().replace(/^:+|:+$/g, "");
}

export function tradeProductApiPath(product: TradeProduct | undefined, path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const prefix = product === "spot" ? SPOT_API_PREFIX : FUTURES_API_PREFIX;
  return `${prefix}${normalizedPath}`;
}

export function tradeProductApiBaseUrl(chainId: number, product: TradeProduct | undefined): string {
  if (product === "spot" && SPOT_API_URL) return SPOT_API_URL;
  if (product !== "spot" && FUTURES_API_URL) return FUTURES_API_URL;
  return getTradingBackendUrl(chainId);
}

export function tradeProductWsUrl(chainId: number, product: TradeProduct | undefined): string {
  if (product === "spot" && SPOT_WS_URL) return SPOT_WS_URL;
  if (product !== "spot" && FUTURES_WS_URL) return FUTURES_WS_URL;
  return getTradingWsUrl(chainId);
}

export function tradeProductSWRKey(product: TradeProduct | undefined, parts: unknown[]): unknown[] {
  return [product ?? DEFAULT_TRADE_PRODUCT, ...parts];
}

export function tradeProductChannel(product: TradeProduct | undefined, channel: string): string {
  const prefix = product === "spot" ? SPOT_WS_CHANNEL_PREFIX : FUTURES_WS_CHANNEL_PREFIX;
  return prefix ? `${prefix}:${channel}` : channel;
}
