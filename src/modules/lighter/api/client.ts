import { getServerBaseUrl } from "config/backend";

import {
  mapReferralDashboardToOnChainDashboard,
  normalizeReferralDashboardResponse,
} from "./custom/referralDashboard.normalize";
import type {
  ApiError,
  NonceResponse,
  LoginRequest,
  LoginResponse,
  Market,
  Orderbook,
  Trade,
  Ticker,
  PriceResponse,
  FundingRate,
  FundingHistory,
  OnChainDashboard,
  ClaimableAmount,
  OperatorStatus,
  Position,
  Order,
  AccountBalance,
  CreateOrderRequest,
  OrderPreviewRequest,
  OrderPreviewResponse,
  BatchCancelRequest,
  BatchCancelResponse,
  ClosePositionRequest,
  CollateralRequest,
} from "./types";

const JWT_STORAGE_KEY = "primit_jwt_token";
const JWT_EXPIRY_KEY = "primit_jwt_expiry";
/** 历史 key(品牌改名前),仅用于一次性读/迁移,避免老用户换域后被登出。 */
const LEGACY_JWT_STORAGE_KEY = "axblade_jwt_token";
const LEGACY_JWT_EXPIRY_KEY = "axblade_jwt_expiry";

/**
 * Minimal JWT shape check: three dot-separated base64url segments, the middle
 * one decoding to JSON with a numeric `exp` claim we can compare against.
 *
 * This is NOT a signature check — only the backend can do that. Its purpose
 * is to filter out obviously-forged values an attacker might plant under the
 * legacy key to get them promoted into the active slot, which the previous
 * migration did unconditionally. A real forgery requires the backend's
 * signing key; here we're closing the no-crypto-at-all trust gap.
 *
 * TODO(security): move JWTs out of localStorage entirely. HttpOnly +
 * SameSite=Strict + Secure cookie removes the XSS-grab class of attacks
 * altogether. Requires backend cooperation (Set-Cookie on /auth/login).
 */
function isPlausibleJwt(token: string, expirySeconds: number): boolean {
  if (typeof token !== "string") return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  if (parts.some((p) => p.length === 0)) return false;

  // base64url → JSON payload must parse and its `exp` must line up with the
  // separately-stored expiry. A mismatch (or no `exp`) is a red flag.
  try {
    const payloadJson = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(payloadJson) as { exp?: unknown };
    const exp = typeof payload.exp === "number" ? payload.exp : NaN;
    if (!Number.isFinite(exp)) return false;
    // Allow up to 60s clock skew between the stored expiry value and the
    // claim itself.
    if (Math.abs(exp - expirySeconds) > 60) return false;
    // Must not already be expired.
    if (exp * 1000 <= Date.now()) return false;
  } catch {
    return false;
  }

  return true;
}

function migrateLegacyJwt(): void {
  if (typeof window === "undefined") return;

  // Always drop legacy keys first so a bad migration never lingers.
  const clearLegacy = () => {
    localStorage.removeItem(LEGACY_JWT_STORAGE_KEY);
    localStorage.removeItem(LEGACY_JWT_EXPIRY_KEY);
  };

  if (localStorage.getItem(JWT_STORAGE_KEY) || localStorage.getItem(JWT_EXPIRY_KEY)) {
    clearLegacy();
    return;
  }

  const legacyToken = localStorage.getItem(LEGACY_JWT_STORAGE_KEY);
  const legacyExpiryRaw = localStorage.getItem(LEGACY_JWT_EXPIRY_KEY);
  if (!legacyToken || !legacyExpiryRaw) {
    clearLegacy();
    return;
  }

  const legacyExpiry = parseInt(legacyExpiryRaw, 10);
  if (!Number.isFinite(legacyExpiry) || !isPlausibleJwt(legacyToken, legacyExpiry)) {
    // Untrusted payload — discard rather than promote. Forces re-login,
    // which is the safe failure mode.
    clearLegacy();
    return;
  }

  localStorage.setItem(JWT_STORAGE_KEY, legacyToken);
  localStorage.setItem(JWT_EXPIRY_KEY, String(legacyExpiry));
  clearLegacy();
}

// ============================================
// Token Management
// ============================================
export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  migrateLegacyJwt();
  const token = localStorage.getItem(JWT_STORAGE_KEY);
  const expiry = localStorage.getItem(JWT_EXPIRY_KEY);
  if (token && expiry) {
    if (Date.now() < parseInt(expiry, 10) * 1000) {
      return token;
    }
    clearStoredToken();
  }
  return null;
}

export function setStoredToken(token: string, expiresAt: number): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(JWT_STORAGE_KEY, token);
  localStorage.setItem(JWT_EXPIRY_KEY, expiresAt.toString());
}

export function clearStoredToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(JWT_STORAGE_KEY);
  localStorage.removeItem(JWT_EXPIRY_KEY);
  localStorage.removeItem(LEGACY_JWT_STORAGE_KEY);
  localStorage.removeItem(LEGACY_JWT_EXPIRY_KEY);
}

// Removed: isAuthenticated() - not used, use custom/client.ts version instead

// ============================================
// Core Fetch Wrapper
// ============================================
interface FetchOptions extends RequestInit {
  requireAuth?: boolean;
}

async function apiFetch<T>(chainId: number, path: string, options: FetchOptions = {}): Promise<T> {
  const baseUrl = getServerBaseUrl(chainId);
  const url = `${baseUrl}/api/v1${path}`;

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (options.requireAuth) {
    const token = getStoredToken();
    if (!token) {
      throw new Error("Authentication required");
    }
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorData: ApiError;
    try {
      errorData = await response.json();
    } catch (e) {
      errorData = {
        error: "request_failed",
        message: `Request failed with status ${response.status}`,
      };
    }

    throw errorData;
  }

  return response.json();
}

// ============================================
// Auth API
// ============================================
export async function getNonce(chainId: number, address: string): Promise<NonceResponse> {
  return apiFetch<NonceResponse>(chainId, `/auth/nonce/${address}`);
}

export async function login(chainId: number, request: LoginRequest): Promise<LoginResponse> {
  const response = await apiFetch<LoginResponse>(chainId, "/auth/login", {
    method: "POST",
    body: JSON.stringify(request),
  });
  setStoredToken(response.token, response.expires_at);
  return response;
}

export function logout(): void {
  clearStoredToken();
}

// ============================================
// Public Market API
// ============================================
export interface MarketsResponse {
  markets: Market[];
  total: number;
}

export interface MarketDetailsResponse {
  symbol: string;
  market_name: string;
  base_asset: string;
  quote_asset: string;
  description: string | null;
  min_base_amount: string;
  min_usd_amount: string;
  price_step: string;
  lot_size: string;
  max_leverage: number;
  initial_margin_fraction: string;
  maintenance_margin_fraction: string;
  close_out_margin_fraction: string;
  market_cap: string | null;
  fully_diluted_valuation: string | null;
  market_cap_updated_at: number | null;
  mark_price: string | null;
  last_price: string | null;
  funding_rate: string | null;
  next_funding_time: number | null;
  listing_phase: string | null;
  status: string | null;
}

export async function getMarkets(chainId: number, limit?: number): Promise<MarketsResponse> {
  const queryParams = limit ? `?limit=${limit}` : "";
  return apiFetch<MarketsResponse>(chainId, `/markets${queryParams}`);
}

export async function getMarketDetails(chainId: number, symbol: string): Promise<MarketDetailsResponse> {
  const apiSymbol = convertSymbolToApiFormat(symbol).toLowerCase();
  return apiFetch<MarketDetailsResponse>(chainId, `/markets/${apiSymbol}/details`);
}

export async function getOrderbook(chainId: number, symbol: string): Promise<Orderbook> {
  // Convert symbol to API format (BTCUSDT)
  const apiSymbol = convertSymbolToApiFormat(symbol);
  return apiFetch<Orderbook>(chainId, `/markets/${apiSymbol}/orderbook`);
}

export interface TradesResponse {
  symbol: string;
  trades: Trade[];
}

export async function getTrades(chainId: number, symbol: string): Promise<TradesResponse> {
  // Convert symbol to API format (BTCUSDT)
  const apiSymbol = convertSymbolToApiFormat(symbol);
  return apiFetch<TradesResponse>(chainId, `/markets/${apiSymbol}/trades`);
}

// Helper to convert symbol format (e.g., "BTC-USD" -> "BTCUSDT")
function convertSymbolToApiFormat(symbol: string): string {
  // If already in BTCUSDT format, return as is
  const upper = symbol.toUpperCase().trim();

  if (upper.includes("-USD") || upper.includes("/USD")) {
    const base = upper.split(/-|\//)[0] ?? "";
    if (base.endsWith("USDT")) return base;
    if (base.endsWith("USD")) return base.replace(/USD$/, "USDT");
    return `${base}USDT`;
  }

  const cleaned = upper.replace(/[/-]/g, "");
  if (cleaned.endsWith("USDT")) return cleaned;
  if (cleaned.endsWith("USD")) return cleaned.replace(/USD$/, "USDT");
  return `${cleaned}USDT`;
}

export async function getTicker(chainId: number, symbol: string): Promise<Ticker> {
  // Convert symbol to API format (BTCUSDT)
  const apiSymbol = convertSymbolToApiFormat(symbol);
  return apiFetch<Ticker>(chainId, `/markets/${apiSymbol}/ticker`);
}

export async function getPrice(chainId: number, symbol: string): Promise<PriceResponse> {
  const apiSymbol = convertSymbolToApiFormat(symbol);
  return apiFetch<PriceResponse>(chainId, `/markets/${apiSymbol}/price`);
}

// ============================================
// Public Funding Rate API
// ============================================
export interface FundingRatesResponse {
  rates: FundingRate[];
}

export async function getAllFundingRates(chainId: number): Promise<FundingRatesResponse> {
  return apiFetch<FundingRatesResponse>(chainId, "/funding-rates");
}

export async function getFundingRate(chainId: number, symbol: string): Promise<FundingRate> {
  const apiSymbol = convertSymbolToApiFormat(symbol);
  return apiFetch<FundingRate>(chainId, `/funding-rates/${apiSymbol}`);
}

export async function getFundingHistory(
  chainId: number,
  symbol: string,
  params?: { period?: string; limit?: number }
): Promise<FundingHistory[]> {
  const apiSymbol = convertSymbolToApiFormat(symbol);
  const query = new URLSearchParams();
  if (params?.period) query.set("period", params.period);
  if (params?.limit != null) query.set("limit", String(params.limit));
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiFetch<FundingHistory[]>(chainId, `/funding-rates/${apiSymbol}/history${suffix}`);
}

// ============================================
// Referral dashboard (JWT; 与 `/referral/dashboard` 同源，映射为旧 OnChainDashboard)
// ============================================
export async function getOnChainDashboard(chainId: number, address: string): Promise<OnChainDashboard> {
  const raw = await apiFetch<unknown>(chainId, "/referral/dashboard", { requireAuth: true });
  const d = normalizeReferralDashboardResponse(raw);
  return mapReferralDashboardToOnChainDashboard(d, address);
}

export async function getOnChainClaimable(chainId: number, address: string): Promise<ClaimableAmount> {
  return apiFetch<ClaimableAmount>(chainId, `/referral/on-chain/claimable/${address}`);
}

export async function getOperatorStatus(chainId: number): Promise<OperatorStatus> {
  return apiFetch<OperatorStatus>(chainId, "/referral/on-chain/operator-status");
}

// ============================================
// Protected Account API (Requires Auth)
// ============================================
export interface PositionsResponse {
  positions: Position[];
  total_unrealized_pnl: string;
  total_collateral: string;
}

export interface OrdersResponse {
  orders: Order[];
}

export interface BalancesResponse {
  balances: AccountBalance[];
}

export async function getPositions(chainId: number): Promise<PositionsResponse> {
  return apiFetch<PositionsResponse>(chainId, "/account/positions", { requireAuth: true });
}

export async function getOrders(chainId: number): Promise<OrdersResponse> {
  return apiFetch<OrdersResponse>(chainId, "/account/orders", { requireAuth: true });
}

export interface AccountTradesResponse {
  trades: Trade[];
}

export async function getAccountTrades(chainId: number): Promise<AccountTradesResponse> {
  return apiFetch<AccountTradesResponse>(chainId, "/account/trades", { requireAuth: true });
}

// Removed: getBalances(chainId) - not used, use custom/client.ts version (with address param) instead

// ============================================
// Protected Order API (Requires Auth)
// ============================================
export interface CreateOrderResponse {
  order_id: string;
  status: string;
  filled_amount: string;
  remaining_amount: string;
  average_price: string | null;
  created_at: string;
}

export async function createOrder(chainId: number, request: CreateOrderRequest): Promise<CreateOrderResponse> {
  return apiFetch<CreateOrderResponse>(chainId, "/orders", {
    method: "POST",
    body: JSON.stringify(request),
    requireAuth: true,
  });
}

/**
 * 订单预估(Order Preview)— 用户调整面板(数量、杠杆、价格)时实时查询:
 * - 预估成交价 / 预估强平价 / 变动后保证金 / 预估手续费
 * - 不需签名(Bearer Token 或 API-KEY 即可)
 */
export async function getOrderPreview(chainId: number, request: OrderPreviewRequest): Promise<OrderPreviewResponse> {
  return apiFetch<OrderPreviewResponse>(chainId, "/orders/preview", {
    method: "POST",
    body: JSON.stringify(request),
    requireAuth: true,
  });
}

export interface CancelOrderRequest {
  signature: string;
  timestamp: number;
}

export interface CancelOrderResponse {
  order_id: string;
  status: string;
  created_at: string;
}

export async function cancelOrder(
  chainId: number,
  orderId: string,
  request: CancelOrderRequest
): Promise<CancelOrderResponse> {
  return apiFetch<CancelOrderResponse>(chainId, `/orders/${orderId}`, {
    method: "DELETE",
    body: JSON.stringify(request),
    requireAuth: true,
  });
}

export async function batchCancelOrders(chainId: number, request: BatchCancelRequest): Promise<BatchCancelResponse> {
  return apiFetch<BatchCancelResponse>(chainId, "/orders/batch", {
    method: "POST",
    body: JSON.stringify(request),
    requireAuth: true,
  });
}

// ============================================
// Protected Position API (Requires Auth)
// ============================================
export async function closePosition(
  chainId: number,
  positionId: string,
  request?: ClosePositionRequest
): Promise<CreateOrderResponse> {
  return apiFetch<CreateOrderResponse>(chainId, `/positions/${positionId}/close`, {
    method: "POST",
    body: JSON.stringify(request || {}),
    requireAuth: true,
  });
}

export async function addPositionCollateral(
  chainId: number,
  positionId: string,
  request: CollateralRequest
): Promise<Position> {
  return apiFetch<Position>(chainId, `/positions/${positionId}/collateral/add`, {
    method: "POST",
    body: JSON.stringify(request),
    requireAuth: true,
  });
}

export async function removePositionCollateral(
  chainId: number,
  positionId: string,
  request: CollateralRequest
): Promise<Position> {
  return apiFetch<Position>(chainId, `/positions/${positionId}/collateral/remove`, {
    method: "POST",
    body: JSON.stringify(request),
    requireAuth: true,
  });
}

// Legacy alias for backward compatibility
export async function updatePositionCollateral(
  chainId: number,
  positionId: string,
  request: CollateralRequest
): Promise<Position> {
  return addPositionCollateral(chainId, positionId, request);
}

// ============================================
// K-line / Candles API
// ============================================
export interface Candle {
  /** Unix timestamp in milliseconds - period start time (API returns milliseconds) */
  time: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  quote_volume?: string;
  trade_count?: number;
  is_final?: boolean; // API may include this field
}

export interface CandlesResponse {
  symbol: string;
  period: string;
  candles: Candle[];
}

export interface LatestCandleResponse {
  symbol: string;
  period: string;
  candle: Candle;
  is_final: boolean;
}

export type KlinePeriod = "1m" | "5m" | "15m" | "30m" | "1h" | "4h" | "1d"; // API supports these periods

export interface GetCandlesParams {
  period: KlinePeriod;
  limit?: number;
  start?: number; // API uses "start" (milliseconds), not "from"
  end?: number; // API uses "end" (milliseconds), not "to"
}

/**
 * Get historical candles for a symbol
 * GET /api/v1/markets/{symbol}/candles
 */
export async function getCandles(chainId: number, symbol: string, params: GetCandlesParams): Promise<CandlesResponse> {
  // Convert symbol to API format (BTCUSDT)
  const apiSymbol = convertSymbolToApiFormat(symbol);
  const queryParams = new URLSearchParams();
  queryParams.set("period", params.period);
  if (params.limit !== undefined) queryParams.set("limit", params.limit.toString());
  if (params.start !== undefined) queryParams.set("from", Math.floor(params.start / 1000).toString());
  if (params.end !== undefined) queryParams.set("to", Math.floor(params.end / 1000).toString());

  return apiFetch<CandlesResponse>(chainId, `/markets/${apiSymbol}/candles?${queryParams.toString()}`);
}

/**
 * Get the latest candle for a symbol
 * GET /api/v1/markets/{symbol}/candles/latest
 */
export async function getLatestCandle(
  chainId: number,
  symbol: string,
  period: KlinePeriod
): Promise<LatestCandleResponse> {
  const apiSymbol = convertSymbolToApiFormat(symbol);
  return apiFetch<LatestCandleResponse>(chainId, `/klines/${apiSymbol}/candles/latest?period=${period}`);
}

// ============================================
// SWR Fetcher Helper
// ============================================
export function createSwrFetcher<T>(chainId: number, requireAuth = false) {
  return async (path: string): Promise<T> => {
    return apiFetch<T>(chainId, path, { requireAuth });
  };
}

// Export for direct usage
export const api = {
  // Auth
  getNonce,
  login,
  logout,
  getStoredToken,
  clearStoredToken,
  // Markets
  getMarkets,
  getOrderbook,
  getTrades,
  getTicker,
  getPrice,
  // K-line / Candles
  getCandles,
  getLatestCandle,
  // Funding
  getAllFundingRates,
  getFundingRate,
  getFundingHistory,
  // Referral
  getOnChainDashboard,
  getOnChainClaimable,
  getOperatorStatus,
  // Account (Protected)
  getPositions,
  getOrders,
  // Orders (Protected)
  createOrder,
  cancelOrder,
  batchCancelOrders,
  // Positions (Protected)
  closePosition,
  updatePositionCollateral,
};
