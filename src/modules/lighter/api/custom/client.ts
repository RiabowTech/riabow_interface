/**
 * Trading API client
 *
 * Standalone trading API client.
 * It does not depend on mode checks and talks directly to the trading backend.
 */

import { tradeProductApiBaseUrl, tradeProductApiPath, type TradeProduct } from "./productRouting";
import { DEFAULT_CHAIN_ID } from "config/chains";

import {
  mapReferralDashboardToOnChainResponse,
  normalizeReferralDashboardResponse,
} from "./referralDashboard.normalize";
import { normalizeReferralLeaderboardResponse } from "./referralLeaderboard.normalize";
import {
  getOnChainReferralDashboardMock,
  getReferralDashboardMock,
  getReferralLeaderboardMock,
  getReferralStatusMock,
  referralUseMockFromEnv,
} from "./referralMock";
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
  FundingFeeHistoryItem,
  Position,
  Order,
  AccountBalance,
  CreateOrderRequest,
  UpdateOrderRequest,
  UpdateOrderResponse,
  BatchCancelRequest,
  BatchCancelResponse,
  ClosePositionRequest,
  CollateralRequest,
  TpSlRequest,
  TpSlResponse,
  CreateTriggerOrderRequest,
  TriggerOrderResponse,
  TriggerOrdersResponse,
  LatestCandleResponse,
  KlinePeriod,
  GetCandlesParams,
  CreateReferralCodeParams,
  CreateReferralCodeResponse,
  BindReferralCodeParams,
  BindReferralCodeResponse,
  ReferralDashboardResponse,
  ReferralLeaderboardEntry,
  ReferralStatusResponse,
  ReferralClaimSignatureRequest,
  ReferralClaimSignatureResponse,
  ClaimReferralResponse,
  OnChainDashboardResponse,
  ClaimableResponse,
  OperatorStatusResponse,
  WithdrawRecord,
  WithdrawRequest,
  WithdrawResponse,
  EarnDomainResponse,
  EarnProduct,
  EarnProductsResponse,
  EarnPerformanceResponse,
  EarnSubscription,
  EarnSubscriptionsResponse,
  EarnSubscribePrepareRequest,
  EarnSubscribePrepareResponse,
  PnlResponse,
  GetPnlParams,
} from "../types";

const JWT_STORAGE_KEY_PREFIX = "zanbara_jwt_token";
const JWT_EXPIRY_KEY_PREFIX = "zanbara_jwt_expiry";
const LAST_ADDRESS_KEY = "zanbara_last_address";
/**
 * 历史品牌 key 前缀,仅用于一次性读/迁移。读到立刻拷贝到新前缀并删掉老 key,
 * 保证用户改域后不被登出。历史数据完全清空后可下线这些常量。
 */
const LEGACY_JWT_STORAGE_KEY_PREFIX = "axblade_jwt_token";
const LEGACY_JWT_EXPIRY_KEY_PREFIX = "axblade_jwt_expiry";
const LEGACY_LAST_ADDRESS_KEY = "axblade_last_address";

// Helper function to get storage key for a specific address and chainId
function getStorageKey(address: string | null | undefined, keyPrefix: string, chainId?: number | null): string {
  if (!address || !chainId) {
    // Fallback to old key for backward compatibility (will be deprecated)
    return keyPrefix;
  }
  // Normalize address to lowercase for consistent key generation
  // Include chainId to separate tokens for different chains (testnet vs mainnet)
  const normalizedAddress = address.toLowerCase();
  return `${keyPrefix}_${chainId}_${normalizedAddress}`;
}

/**
 * 把一对 legacy (axblade_*) 存储 key 搬到新 (zanbara_*) 前缀。
 * 新 key 已有值时不覆盖,避免回写老 token 顶掉新 session;
 * 搬完后立即删除 legacy key,防止下次读到旧数据。
 */
function migrateLegacyPair(
  legacyStorageKey: string,
  legacyExpiryKey: string,
  targetStorageKey: string,
  targetExpiryKey: string
): void {
  if (typeof window === "undefined") return;
  const legacyToken = localStorage.getItem(legacyStorageKey);
  const legacyExpiry = localStorage.getItem(legacyExpiryKey);
  if (!legacyToken || !legacyExpiry) return;
  if (!localStorage.getItem(targetStorageKey)) {
    localStorage.setItem(targetStorageKey, legacyToken);
  }
  if (!localStorage.getItem(targetExpiryKey)) {
    localStorage.setItem(targetExpiryKey, legacyExpiry);
  }
  localStorage.removeItem(legacyStorageKey);
  localStorage.removeItem(legacyExpiryKey);
}

/**
 * 尝试把给定 address/chainId 组合下的 axblade_* token 迁到 zanbara_*。
 * 顺序覆盖三种历史布局:
 *  1) {prefix}_{chainId}_{addr}
 *  2) {prefix}_{addr}(无 chainId)
 *  3) 裸 {prefix}
 */
function migrateLegacyJwtFor(address: string | null, chainId: number | null | undefined): void {
  if (typeof window === "undefined") return;
  // legacy last-address key → zanbara
  const legacyLastAddr = localStorage.getItem(LEGACY_LAST_ADDRESS_KEY);
  if (legacyLastAddr && !localStorage.getItem(LAST_ADDRESS_KEY)) {
    localStorage.setItem(LAST_ADDRESS_KEY, legacyLastAddr);
  }
  if (legacyLastAddr) localStorage.removeItem(LEGACY_LAST_ADDRESS_KEY);

  if (address && chainId) {
    migrateLegacyPair(
      getStorageKey(address, LEGACY_JWT_STORAGE_KEY_PREFIX, chainId),
      getStorageKey(address, LEGACY_JWT_EXPIRY_KEY_PREFIX, chainId),
      getStorageKey(address, JWT_STORAGE_KEY_PREFIX, chainId),
      getStorageKey(address, JWT_EXPIRY_KEY_PREFIX, chainId)
    );
  }
  if (address) {
    migrateLegacyPair(
      getStorageKey(address, LEGACY_JWT_STORAGE_KEY_PREFIX, null),
      getStorageKey(address, LEGACY_JWT_EXPIRY_KEY_PREFIX, null),
      getStorageKey(address, JWT_STORAGE_KEY_PREFIX, null),
      getStorageKey(address, JWT_EXPIRY_KEY_PREFIX, null)
    );
  }
  migrateLegacyPair(
    LEGACY_JWT_STORAGE_KEY_PREFIX,
    LEGACY_JWT_EXPIRY_KEY_PREFIX,
    JWT_STORAGE_KEY_PREFIX,
    JWT_EXPIRY_KEY_PREFIX
  );
}

// Helper function to get the last used address from localStorage
export function getLastAddress(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(LAST_ADDRESS_KEY);
}

// Helper function to store the last used address
function setLastAddress(address: string | null): void {
  if (typeof window === "undefined") return;
  if (address) {
    localStorage.setItem(LAST_ADDRESS_KEY, address.toLowerCase());
  } else {
    localStorage.removeItem(LAST_ADDRESS_KEY);
  }
}

// ============================================
// Token Management
// ============================================
export function getStoredToken(address?: string | null, chainId?: number | null): string | null {
  if (typeof window === "undefined") return null;

  // If address is not provided, try to get from last used address
  let targetAddress = address;
  if (!targetAddress) {
    targetAddress = getLastAddress();
  }

  // Normalize address to lowercase for consistent lookup
  const normalizedAddress = targetAddress ? targetAddress.toLowerCase() : null;

  // 读老 axblade_* token → 迁移到 zanbara_* 命名空间;迁移后后续逻辑按新 key 读即可。
  migrateLegacyJwtFor(normalizedAddress, chainId ?? null);

  // First, try to get address and chainId-specific token (new format)
  if (normalizedAddress && chainId) {
    const storageKey = getStorageKey(normalizedAddress, JWT_STORAGE_KEY_PREFIX, chainId);
    const expiryKey = getStorageKey(normalizedAddress, JWT_EXPIRY_KEY_PREFIX, chainId);

    const token = localStorage.getItem(storageKey);
    const expiry = localStorage.getItem(expiryKey);

    if (token && expiry) {
      const expiryTime = parseInt(expiry, 10) * 1000;
      const now = Date.now();
      const isValid = now < expiryTime;

      // Only log if token is invalid (expired)
      if (!isValid) {
        console.warn("[getStoredToken] Token expired, clearing", {
          expiryTime,
          now,
          timeSinceExpiry: now - expiryTime,
          address: `${normalizedAddress.substring(0, 6)}...`,
          chainId,
        });
        clearStoredToken(normalizedAddress, chainId);
      }
      // Return valid token without logging (too frequent)

      if (isValid) {
        return token;
      }
    }
  }

  // Fallback: try to get legacy token (old format without address/chainId binding)
  // This provides backward compatibility for tokens stored before the address/chainId binding feature
  // Try address-only format first (without chainId)
  if (normalizedAddress) {
    const legacyAddressKey = getStorageKey(normalizedAddress, JWT_STORAGE_KEY_PREFIX, null);
    const legacyAddressExpiryKey = getStorageKey(normalizedAddress, JWT_EXPIRY_KEY_PREFIX, null);

    const legacyAddressToken = localStorage.getItem(legacyAddressKey);
    const legacyAddressExpiry = localStorage.getItem(legacyAddressExpiryKey);

    if (legacyAddressToken && legacyAddressExpiry) {
      if (Date.now() < parseInt(legacyAddressExpiry, 10) * 1000) {
        // If we have chainId, migrate the legacy token to address+chainId-specific format
        if (chainId) {
          setStoredToken(legacyAddressToken, parseInt(legacyAddressExpiry, 10), normalizedAddress, chainId);
          // Clear legacy token after migration
          localStorage.removeItem(legacyAddressKey);
          localStorage.removeItem(legacyAddressExpiryKey);
        }
        return legacyAddressToken;
      }
      // Legacy token expired, clear it
      localStorage.removeItem(legacyAddressKey);
      localStorage.removeItem(legacyAddressExpiryKey);
    }
  }

  // Fallback: try to get very old legacy token (without address and chainId)
  const legacyStorageKey = JWT_STORAGE_KEY_PREFIX;
  const legacyExpiryKey = JWT_EXPIRY_KEY_PREFIX;

  const legacyToken = localStorage.getItem(legacyStorageKey);
  const legacyExpiry = localStorage.getItem(legacyExpiryKey);

  if (legacyToken && legacyExpiry) {
    if (Date.now() < parseInt(legacyExpiry, 10) * 1000) {
      // If we have both address and chainId, migrate the legacy token to address+chainId-specific format
      if (normalizedAddress && chainId) {
        setStoredToken(legacyToken, parseInt(legacyExpiry, 10), normalizedAddress, chainId);
        // Clear legacy token after migration
        localStorage.removeItem(legacyStorageKey);
        localStorage.removeItem(legacyExpiryKey);
      }
      return legacyToken;
    }
    // Legacy token expired, clear it
    localStorage.removeItem(legacyStorageKey);
    localStorage.removeItem(legacyExpiryKey);
  }

  return null;
}

export function setStoredToken(
  token: string,
  expiresAt: number,
  address?: string | null,
  chainId?: number | null
): void {
  if (typeof window === "undefined") return;

  if (!address || !chainId) {
    console.error(" setStoredToken called without address or chainId. Token will not be stored.", {
      address,
      chainId,
      hasToken: !!token,
    });
    return;
  }

  // Normalize address to lowercase for consistent storage
  const normalizedAddress = address.toLowerCase();

  // Store the address as the last used address
  setLastAddress(normalizedAddress);

  const storageKey = getStorageKey(normalizedAddress, JWT_STORAGE_KEY_PREFIX, chainId);
  const expiryKey = getStorageKey(normalizedAddress, JWT_EXPIRY_KEY_PREFIX, chainId);

  localStorage.setItem(storageKey, token);
  localStorage.setItem(expiryKey, expiresAt.toString());

  // Verify storage (only log if verification fails)
  const verifyToken = localStorage.getItem(storageKey);
  const verifyExpiry = localStorage.getItem(expiryKey);
  if (!verifyToken || !verifyExpiry) {
    console.error(" setStoredToken: Storage verification failed", {
      tokenStored: !!verifyToken,
      expiryStored: !!verifyExpiry,
      storageKey,
      expiryKey,
    });
  }

  // Notify token change listeners (same tab)
  // Use setTimeout to ensure localStorage is updated before event is dispatched
  setTimeout(() => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("auth-token-change"));
    }
  }, 0);
}

export function clearStoredToken(address?: string | null, chainId?: number | null): void {
  if (typeof window === "undefined") return;

  // If address is not provided, clear the last used address's token
  let targetAddress = address;
  if (!targetAddress) {
    targetAddress = getLastAddress();
  }

  if (targetAddress && chainId) {
    // Clear chainId-specific token
    const storageKey = getStorageKey(targetAddress, JWT_STORAGE_KEY_PREFIX, chainId);
    const expiryKey = getStorageKey(targetAddress, JWT_EXPIRY_KEY_PREFIX, chainId);
    localStorage.removeItem(storageKey);
    localStorage.removeItem(expiryKey);
  }

  // Also clear legacy tokens (address-only, or no address/chainId)
  if (targetAddress) {
    // Clear address-only legacy token
    const legacyAddressKey = getStorageKey(targetAddress, JWT_STORAGE_KEY_PREFIX, null);
    const legacyAddressExpiryKey = getStorageKey(targetAddress, JWT_EXPIRY_KEY_PREFIX, null);
    localStorage.removeItem(legacyAddressKey);
    localStorage.removeItem(legacyAddressExpiryKey);
  }

  // Also clear the last address if clearing for a specific address
  if (address) {
    const lastAddress = getLastAddress();
    if (lastAddress && lastAddress.toLowerCase() === address.toLowerCase()) {
      setLastAddress(null);
    }
  }

  // Also clear very old legacy token (without address and chainId) for backward compatibility
  localStorage.removeItem(JWT_STORAGE_KEY_PREFIX);
  localStorage.removeItem(JWT_EXPIRY_KEY_PREFIX);

  // Notify token change listeners (same tab)
  setTimeout(() => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("auth-token-change"));
    }
  }, 0);
}

export function isAuthenticated(address?: string | null, chainId?: number | null): boolean {
  return getStoredToken(address, chainId) !== null;
}

// ============================================
// Core Fetch Wrapper (Trading API specific)
// ============================================
interface FetchOptions extends RequestInit {
  requireAuth?: boolean;
  address?: string | null; // Optional address for address-specific token lookup
  product?: TradeProduct;
}

function getAuthChainId(chainId: number, product?: TradeProduct): number {
  return product === "spot" ? DEFAULT_CHAIN_ID : chainId;
}

async function apiFetch<T>(chainId: number, path: string, options: FetchOptions = {}): Promise<T> {
  const baseUrl = tradeProductApiBaseUrl(chainId, options.product);
  const resolvedPath = options.product ? tradeProductApiPath(options.product, path) : path;
  const url = `${baseUrl}/api/v1${resolvedPath}`;

  // Debug log for K-line requests
  if (resolvedPath.includes("/candles")) {
  }

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (options.requireAuth) {
    // Get token for the specified address and chainId
    // If address is not provided, try to get from last used address
    let targetAddress = options.address;
    if (!targetAddress) {
      targetAddress = getLastAddress();
    }

    const authChainId = getAuthChainId(chainId, options.product);
    const token = getStoredToken(targetAddress, authChainId);
    if (!token) {
      console.error(" Token not found for authentication", {
        providedAddress: options.address,
        lastAddress: getLastAddress(),
        chainId,
        authChainId,
        product: options.product,
      });
      throw new Error(" Authentication required. Please sign in again.");
    }

    // Log token usage for debugging

    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      let errorData: ApiError;
      let errorText: string | undefined;
      try {
        errorData = await response.json();
        // Log the full error response for debugging
        console.error(` API Error (${response.status}):`, errorData);
      } catch (e) {
        // If JSON parsing fails, try to get text
        try {
          errorText = await response.text();
          console.error(` API Error (${response.status}) - Raw response:`, errorText);
        } catch (textError) {
          // Ignore text parsing errors
        }
        errorData = {
          error: "request_failed",
          message: errorText || `Request failed with status ${response.status}`,
        };
      }

      // Extract error message from various possible formats
      const fullMessage =
        errorData.message || errorData.error || (errorData as any).detail || errorText || "Request failed";

      // Handle 401 Unauthorized errors - token is invalid or expired
      if (response.status === 401) {
        // Get the address used for this request
        let targetAddress = options.address;
        if (!targetAddress) {
          targetAddress = getLastAddress();
        }
        // Only clear token if we have an address to clear it for
        if (targetAddress) {
          console.warn(" Clearing invalid/expired token for address and chainId");
          clearStoredToken(targetAddress, chainId);
        } else {
          console.warn(" Cannot clear token: no address available");
        }

        // Don't show error toast for 401, as it will trigger re-authentication
        // The calling code should handle re-authentication
      }
      // Note: We don't show toasts for API errors here because:
      // 1. Backend error messages may be in Chinese or other languages
      // 2. The t macro doesn't work correctly outside React components
      // 3. Components should handle error display with proper i18n support

      // Throw an Error object so it can be properly caught
      const error = new Error(fullMessage);
      (error as any).status = response.status;
      (error as any).errorData = errorData;
      throw error;
    }

    return response.json();
  } catch (error) {
    // Handle network errors and other exceptions

    // If error already has status (API error handled above), just re-throw
    if ((error as any)?.status) {
      throw error;
    }

    // For network errors without status, throw generic error
    // Note: We don't show toasts here because the t macro doesn't work correctly
    // outside React components. Components should handle error display.
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    throw new Error(errorMessage);
  }
}

// ============================================
// Auth API
// ============================================
export async function getNonce(chainId: number, address: string): Promise<NonceResponse> {
  return apiFetch<NonceResponse>(chainId, `/auth/nonce/${address}`);
}

export async function login(chainId: number, request: LoginRequest, address?: string | null): Promise<LoginResponse> {
  const response = await apiFetch<LoginResponse>(chainId, "/auth/login", {
    method: "POST",
    body: JSON.stringify(request),
  });

  // Store token with address and chainId binding
  const targetAddress = address || request.address;

  // Ensure expires_at is a number
  const expiresAt = typeof response.expires_at === "string" ? parseInt(response.expires_at, 10) : response.expires_at;

  if (!targetAddress || !chainId) {
    console.error(" login: Cannot store token - missing address or chainId", {
      targetAddress,
      chainId,
      address,
      requestAddress: request.address,
    });
  } else {
    setStoredToken(response.token, expiresAt, targetAddress, chainId);
    // Also store the last used address for token lookup when address is not provided
    setLastAddress(targetAddress);

    // Verify token was stored
    const verifyToken = getStoredToken(targetAddress, chainId);
  }

  return response;
}

export function logout(address?: string | null, chainId?: number | null): void {
  clearStoredToken(address, chainId);
}

// ============================================
// Public Market API
// ============================================
export interface MarketsResponse {
  markets: Market[];
  total: number;
}

export interface SpotMarket {
  id: string;
  base_token: string;
  quote_token: string;
  tick_size: string;
  lot_size: string;
  min_notional: string;
  maker_fee_bps: number;
  taker_fee_bps: number;
  status: "listed" | "halted" | "delisted" | string;
}

export interface SpotTicker24h {
  symbol: string;
  last_price: string;
  open_price: string;
  high: string;
  low: string;
  volume: string;
  quote_volume: string;
  trade_count: number;
  open_time: number;
  close_time: number;
}

export type SpotOrderSide = "buy" | "sell";
export type SpotOrderType = "limit" | "market";
export type SpotTimeInForce = "gtc" | "ioc" | "post_only";

export interface CreateSpotOrderRequest {
  symbol: string;
  side: SpotOrderSide;
  type: SpotOrderType;
  tif?: SpotTimeInForce;
  price?: string;
  quantity?: string;
  quote_quantity?: string;
}

export interface CreateSpotOrderResponse {
  id: string;
  symbol: string;
  side: SpotOrderSide;
  type: SpotOrderType;
  tif?: SpotTimeInForce;
  price?: string | null;
  quantity?: string | null;
  quote_quantity?: string | null;
  filled_qty?: string;
  avg_fill_price?: string | null;
  status: string;
  reject_reason?: string | null;
  created_at?: number;
  updated_at?: number;
  fills?: Array<{
    trade_id: string;
    price: string;
    quantity: string;
    fee: string;
    fee_token: string;
  }>;
}

function normalizeSpotMarketsResponse(raw: unknown): MarketsResponse {
  const data = unwrapApiData<unknown>(raw);
  const spotMarkets = Array.isArray(data)
    ? data
    : Array.isArray((data as any)?.markets)
      ? (data as any).markets
      : [];

  const markets = spotMarkets.map((market: any): Market => {
    const id = String(market.id ?? market.symbol ?? "").toUpperCase();
    const base = String(market.base_token ?? market.base_asset ?? id.replace(/USDT$/, "")).toUpperCase();
    const quote = String(market.quote_token ?? market.quote_asset ?? "USDT").toUpperCase();
    const symbol = id.endsWith("USDT") ? id.replace(/USDT$/, "-USD") : `${base}-USD`;

    return {
      symbol,
      base_asset: base,
      quote_asset: quote,
      last_price: String(market.last_price ?? "0"),
      price_change_24h: "0",
      price_change_percent_24h: "0",
      high_24h: "0",
      low_24h: "0",
      volume_24h: "0",
      volume_24h_usd: "0",
      rank: 0,
      type: "spot",
      leverage: 1,
      tick_size: String(market.tick_size ?? "0.0001"),
      lot_size: String(market.lot_size ?? "0.01"),
      min_notional: String(market.min_notional ?? "0"),
      maker_fee_bps: Number(market.maker_fee_bps ?? 0),
      taker_fee_bps: Number(market.taker_fee_bps ?? 0),
      price_decimals: countDecimalPlaces(String(market.tick_size ?? "0.0001")),
      size_decimals: countDecimalPlaces(String(market.lot_size ?? "0.01")),
      status: market.status === "listed" || market.status === "active" ? "active" : "inactive",
    };
  });

  return { markets, total: markets.length };
}

function countDecimalPlaces(value: string): number {
  const fractional = value.split(".")[1];
  if (!fractional) return 0;
  return fractional.replace(/0+$/, "").length;
}

function normalizeSpotTicker(raw: unknown, symbol: string): Ticker {
  const data = unwrapApiData<any>(raw);
  const ticker = Array.isArray(data)
    ? data.find((item) => String(item?.symbol ?? "").toUpperCase() === symbol.toUpperCase()) || data[0]
    : data;
  const lastPrice = String(ticker?.last_price ?? "0");

  return {
    symbol: String(ticker?.symbol ?? symbol),
    last_price: lastPrice,
    price_change_24h: "0",
    price_change_percent_24h: "0",
    high_24h: String(ticker?.high ?? lastPrice),
    low_24h: String(ticker?.low ?? lastPrice),
    volume_24h: String(ticker?.volume ?? "0"),
    open_interest: "0",
    funding_rate: "0",
    next_funding_time: 0,
  };
}

function normalizeSpotOrderbook(raw: unknown, symbol: string): Orderbook {
  const data = unwrapApiData<any>(raw);
  const normalizeLevels = (levels: any): [string, string][] => {
    if (!Array.isArray(levels)) return [];

    return levels
      .map((level: any): [string, string] | null => {
        if (Array.isArray(level)) {
          const price = level[0];
          const size = level[1];
          if (price === undefined || size === undefined) return null;
          return [String(price), String(size)];
        }

        const price = level?.price ?? level?.p;
        const size = level?.quantity ?? level?.qty ?? level?.amount ?? level?.size ?? level?.q;
        if (price === undefined || size === undefined) return null;
        return [String(price), String(size)];
      })
      .filter((level): level is [string, string] => level !== null);
  };

  return {
    symbol: String(data?.symbol ?? symbol),
    bids: normalizeLevels(data?.bids),
    asks: normalizeLevels(data?.asks),
    timestamp: Number(data?.timestamp ?? data?.ts ?? Date.now()),
  };
}

function normalizeSpotTrades(raw: unknown, symbol: string): TradesResponse {
  const data = unwrapApiData<any>(raw);
  const rows = Array.isArray(data)
    ? data
    : Array.isArray(data?.trades)
      ? data.trades
      : [];

  return {
    symbol,
    trades: rows.map((trade: any, index: number): Trade => {
      const timestamp = trade?.ts ?? trade?.timestamp ?? trade?.created_at ?? Date.now();
      return {
        id: String(trade?.trade_id ?? trade?.id ?? `${symbol}-${timestamp}-${index}`),
        symbol: String(trade?.symbol ?? symbol),
        price: String(trade?.price ?? "0"),
        amount: String(trade?.quantity ?? trade?.amount ?? trade?.size ?? "0"),
        side: String(trade?.side ?? "").toLowerCase() === "sell" ? "sell" : "buy",
        timestamp,
      };
    }),
  };
}

function normalizeSpotCandles(raw: unknown, symbol: string, period: KlinePeriod): CandlesResponse {
  const data = unwrapApiData<any>(raw);
  const rows = Array.isArray(data)
    ? data
    : Array.isArray(data?.klines)
      ? data.klines
      : Array.isArray(data?.candles)
        ? data.candles
        : [];

  return {
    symbol,
    period,
    candles: rows.map((row: any): Candle => {
      if (Array.isArray(row)) {
        const openTime = Number(row[0] ?? Date.now());
        return {
          time: openTime > 1e12 ? Math.floor(openTime / 1000) : openTime,
          open: String(row[1] ?? "0"),
          high: String(row[2] ?? "0"),
          low: String(row[3] ?? "0"),
          close: String(row[4] ?? "0"),
          volume: String(row[5] ?? "0"),
          quote_volume: row[7] !== undefined ? String(row[7]) : undefined,
          trade_count: row[8] !== undefined ? Number(row[8]) : undefined,
        };
      }

      const rawTime = Number(row?.open_time ?? row?.time ?? row?.ts ?? row?.timestamp ?? Date.now());
      const time = rawTime > 1e12 ? Math.floor(rawTime / 1000) : rawTime;
      const volume = row?.volume ?? row?.base_volume ?? "0";
      return {
        time,
        open: String(row?.open ?? "0"),
        high: String(row?.high ?? "0"),
        low: String(row?.low ?? "0"),
        close: String(row?.close ?? "0"),
        volume: String(volume),
        quote_volume: row?.quote_volume !== undefined ? String(row.quote_volume) : undefined,
        trade_count: row?.trade_count !== undefined ? Number(row.trade_count) : undefined,
        is_final: row?.is_final,
      };
    }),
  };
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

// Helper to convert symbol format (e.g., "BTC-USD" -> "BTCUSDT")
function convertSymbolToApiFormat(symbol: string): string {
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

export async function getMarkets(chainId: number, limit?: number, product?: TradeProduct): Promise<MarketsResponse> {
  const queryParams = limit ? `?limit=${limit}` : "";
  if (product === "spot") {
    const raw = await apiFetch<unknown>(chainId, `/markets${queryParams}`, { product });
    return normalizeSpotMarketsResponse(raw);
  }
  return apiFetch<MarketsResponse>(chainId, `/markets${queryParams}`, { product });
}

export async function getMarketDetails(chainId: number, symbol: string, product?: TradeProduct): Promise<MarketDetailsResponse> {
  const apiSymbol = convertSymbolToApiFormat(symbol).toLowerCase();
  return apiFetch<MarketDetailsResponse>(chainId, `/markets/${apiSymbol}/details`, { product });
}

export async function getOrderbook(chainId: number, symbol: string, product?: TradeProduct): Promise<Orderbook> {
  const apiSymbol = convertSymbolToApiFormat(symbol);
  if (product === "spot") {
    const raw = await apiFetch<unknown>(chainId, `/depth?symbol=${encodeURIComponent(apiSymbol)}&limit=100`, { product });
    return normalizeSpotOrderbook(raw, apiSymbol);
  }
  return apiFetch<Orderbook>(chainId, `/markets/${apiSymbol}/orderbook`, { product });
}

export interface TradesResponse {
  symbol: string;
  trades: Trade[];
}

export async function getTrades(chainId: number, symbol: string, product?: TradeProduct): Promise<TradesResponse> {
  const apiSymbol = convertSymbolToApiFormat(symbol);
  if (product === "spot") {
    const raw = await apiFetch<unknown>(chainId, `/trades?symbol=${encodeURIComponent(apiSymbol)}&limit=50`, { product });
    return normalizeSpotTrades(raw, apiSymbol);
  }
  return apiFetch<TradesResponse>(chainId, `/markets/${apiSymbol}/trades`, { product });
}

export async function getTicker(chainId: number, symbol: string, product?: TradeProduct): Promise<Ticker> {
  const apiSymbol = convertSymbolToApiFormat(symbol);
  if (product === "spot") {
    const raw = await apiFetch<unknown>(chainId, `/ticker/24hr?symbol=${encodeURIComponent(apiSymbol)}`, { product });
    return normalizeSpotTicker(raw, apiSymbol);
  }
  return apiFetch<Ticker>(chainId, `/markets/${apiSymbol}/ticker`, { product });
}

export async function createSpotOrder(
  chainId: number,
  request: CreateSpotOrderRequest,
  address?: string | null
): Promise<CreateSpotOrderResponse> {
  const raw = await apiFetch<CreateSpotOrderResponse | ApiEnvelope<CreateSpotOrderResponse>>(chainId, "/orders", {
    method: "POST",
    body: JSON.stringify(request),
    requireAuth: true,
    address,
    product: "spot",
  });

  return unwrapApiData(raw);
}

export type SpotOrderStatus =
  | "pending"
  | "open"
  | "partially_filled"
  | "filled"
  | "canceled"
  | "cancelled"
  | "rejected"
  | "expired";

export interface SpotOrderRecord {
  id: string;
  order_id?: string;
  client_order_id?: string;
  symbol: string;
  side: SpotOrderSide;
  type: SpotOrderType;
  tif?: SpotTimeInForce;
  price?: string | null;
  quantity?: string | null;
  quote_quantity?: string | null;
  filled_qty?: string | null;
  avg_fill_price?: string | null;
  status: SpotOrderStatus;
  reject_reason?: string | null;
  created_at?: number | string;
  updated_at?: number | string;
}

export interface SpotTradeRecord {
  trade_id: string;
  id?: string;
  symbol: string;
  side: SpotOrderSide;
  price: string;
  quantity: string;
  fee?: string;
  fee_token?: string;
  role?: string;
  order_id?: string;
  created_at?: number | string;
  timestamp?: number | string;
}

export interface GetSpotOrdersParams {
  symbol?: string;
  status?: SpotOrderStatus;
  limit?: number;
}

export interface GetSpotTradesParams {
  symbol?: string;
  startTime?: number;
  endTime?: number;
  limit?: number;
}

function buildQueryString(params: Record<string, string | number | undefined | null>): string {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, String(value));
    }
  });
  const text = query.toString();
  return text ? `?${text}` : "";
}

function normalizeSpotOrders(raw: unknown): SpotOrderRecord[] {
  const data = unwrapApiData<unknown>(raw);
  const orders = Array.isArray(data)
    ? data
    : Array.isArray((data as any)?.orders)
      ? (data as any).orders
      : [];

  return orders.map((order: any) => ({
    id: String(order.id ?? order.order_id ?? ""),
    order_id: order.order_id ? String(order.order_id) : undefined,
    client_order_id: order.client_order_id ? String(order.client_order_id) : undefined,
    symbol: String(order.symbol ?? ""),
    side: String(order.side ?? "").toLowerCase() === "sell" ? "sell" : "buy",
    type: String(order.type ?? order.order_type ?? "").toLowerCase() === "market" ? "market" : "limit",
    tif: order.tif ?? order.time_in_force,
    price: order.price ?? null,
    quantity: order.quantity ?? order.size ?? null,
    quote_quantity: order.quote_quantity ?? null,
    filled_qty: order.filled_qty ?? order.filled_size ?? order.filled_amount ?? null,
    avg_fill_price: order.avg_fill_price ?? order.average_price ?? null,
    status: String(order.status ?? "open").toLowerCase() as SpotOrderStatus,
    reject_reason: order.reject_reason ?? null,
    created_at: order.created_at,
    updated_at: order.updated_at,
  }));
}

function normalizeSpotAccountTrades(raw: unknown): SpotTradeRecord[] {
  const data = unwrapApiData<unknown>(raw);
  const trades = Array.isArray(data)
    ? data
    : Array.isArray((data as any)?.trades)
      ? (data as any).trades
      : [];

  return trades.map((trade: any) => ({
    trade_id: String(trade.trade_id ?? trade.id ?? ""),
    id: trade.id ? String(trade.id) : undefined,
    symbol: String(trade.symbol ?? ""),
    side: String(trade.side ?? "").toLowerCase() === "sell" ? "sell" : "buy",
    price: String(trade.price ?? "0"),
    quantity: String(trade.quantity ?? trade.amount ?? trade.size ?? "0"),
    fee: trade.fee != null ? String(trade.fee) : undefined,
    fee_token: trade.fee_token ?? trade.fee_asset ?? undefined,
    role: trade.role ?? trade.liquidity ?? undefined,
    order_id: trade.order_id ? String(trade.order_id) : undefined,
    created_at: trade.created_at,
    timestamp: trade.timestamp,
  }));
}

export async function getSpotOrders(
  chainId: number,
  params: GetSpotOrdersParams = {},
  address?: string | null
): Promise<SpotOrderRecord[]> {
  const query = buildQueryString({
    symbol: params.symbol ? convertSymbolToApiFormat(params.symbol) : undefined,
    status: params.status,
    limit: params.limit,
  });
  const raw = await apiFetch<unknown>(chainId, `/orders${query}`, {
    requireAuth: true,
    address,
    product: "spot",
  });
  return normalizeSpotOrders(raw);
}

export async function getSpotAccountTrades(
  chainId: number,
  params: GetSpotTradesParams = {},
  address?: string | null
): Promise<SpotTradeRecord[]> {
  const query = buildQueryString({
    symbol: params.symbol ? convertSymbolToApiFormat(params.symbol) : undefined,
    startTime: params.startTime,
    endTime: params.endTime,
    limit: params.limit,
  });
  const raw = await apiFetch<unknown>(chainId, `/trades/me${query}`, {
    requireAuth: true,
    address,
    product: "spot",
  });
  return normalizeSpotAccountTrades(raw);
}

export async function cancelSpotOrder(
  chainId: number,
  orderId: string,
  address?: string | null
): Promise<SpotOrderRecord> {
  const raw = await apiFetch<unknown>(chainId, `/orders/${encodeURIComponent(orderId)}`, {
    method: "DELETE",
    requireAuth: true,
    address,
    product: "spot",
  });
  const data = unwrapApiData(raw);
  return normalizeSpotOrders(Array.isArray(data) ? data : [data])[0];
}

export async function getPrice(chainId: number, symbol: string, product?: TradeProduct): Promise<PriceResponse> {
  const apiSymbol = convertSymbolToApiFormat(symbol);
  return apiFetch<PriceResponse>(chainId, `/markets/${apiSymbol}/price`, { product });
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

export async function getFundingHistory(chainId: number, symbol: string): Promise<FundingHistory[]> {
  const apiSymbol = convertSymbolToApiFormat(symbol);
  return apiFetch<FundingHistory[]>(chainId, `/funding-rates/${apiSymbol}/history`);
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

type ApiEnvelope<T> = {
  success?: boolean;
  data?: T;
  error?: unknown;
};

function unwrapApiData<T>(raw: T | ApiEnvelope<T>): T {
  if (raw && typeof raw === "object" && "data" in raw && (raw as ApiEnvelope<T>).data !== undefined) {
    return (raw as ApiEnvelope<T>).data as T;
  }

  return raw as T;
}

function normalizeBalancesResponse(raw: unknown): BalancesResponse {
  const data = unwrapApiData<unknown>(raw);
  const balances = Array.isArray(data)
    ? data
    : Array.isArray((data as any)?.balances)
      ? (data as any).balances
      : [];

  return {
    balances: balances.map((balance: any) => {
      const symbol = String(
        balance.symbol ??
          balance.token ??
          balance.asset ??
          balance.currency ??
          balance.coin ??
          balance.token_symbol ??
          balance.tokenSymbol ??
          ""
      );
      const token = String(balance.token ?? balance.symbol ?? balance.asset ?? balance.currency ?? balance.coin ?? symbol);
      const available = String(balance.available ?? balance.available_balance ?? "0");
      const frozen = String(balance.frozen ?? balance.locked ?? balance.frozen_balance ?? "0");
      const total = String(balance.total ?? balance.balance ?? Number(available) + Number(frozen));

      return {
        token,
        symbol,
        available,
        frozen,
        total,
        available_usd: balance.available_usd !== undefined ? String(balance.available_usd) : undefined,
        frozen_usd: balance.frozen_usd !== undefined ? String(balance.frozen_usd) : undefined,
        total_usd: balance.total_usd !== undefined ? String(balance.total_usd) : undefined,
      };
    }),
  };
}

export interface UnifiedAccountResponse {
  margin_mode: string;
  wallet_balance: string;
  total_equity: string;
  available_balance: string;
  total_initial_margin: string;
  total_maintenance_margin: string;
  total_unrealized_pnl: string;
  uni_mmr: string;
  account_status: string;
}

export async function getPositions(chainId: number, address?: string | null, product?: TradeProduct): Promise<PositionsResponse> {
  return apiFetch<PositionsResponse>(chainId, "/account/positions", { requireAuth: true, address, product });
}

export async function getOrders(chainId: number, address?: string | null, product?: TradeProduct): Promise<OrdersResponse> {
  return apiFetch<OrdersResponse>(chainId, "/account/orders", { requireAuth: true, address, product });
}

export async function getTriggerOrders(chainId: number, address?: string | null, product?: TradeProduct): Promise<TriggerOrdersResponse> {
  return apiFetch<TriggerOrdersResponse>(chainId, "/trigger-orders", { requireAuth: true, address, product });
}

export async function createTriggerOrder(
  chainId: number,
  request: CreateTriggerOrderRequest,
  address?: string | null,
  product?: TradeProduct
): Promise<TriggerOrderResponse> {
  // 后端实际返回 `{success, data:{id,...}, error}` envelope,这里拆包成扁平 TriggerOrderResponse
  // (历史上曾直接返回扁平对象,发现有包裹后再剥一层;两种格式都兼容)。
  const raw = await apiFetch<TriggerOrderResponse | { success: boolean; data: TriggerOrderResponse; error: unknown }>(
    chainId,
    "/trigger-orders",
    {
      method: "POST",
      body: JSON.stringify(request),
      requireAuth: true,
      address,
      product,
    }
  );
  if (raw && typeof raw === "object" && "data" in raw && (raw as any).data) {
    return (raw as { data: TriggerOrderResponse }).data;
  }
  return raw as TriggerOrderResponse;
}

export async function cancelTriggerOrder(
  chainId: number,
  triggerOrderId: string,
  address?: string | null,
  product?: TradeProduct
): Promise<void> {
  await apiFetch<unknown>(chainId, `/trigger-orders/${triggerOrderId}`, {
    method: "DELETE",
    requireAuth: true,
    address,
    product,
  });
}

export async function getBalances(
  chainId: number,
  address?: string | null,
  product?: TradeProduct
): Promise<BalancesResponse> {
  if (product === "spot") {
    const raw = await apiFetch<unknown>(chainId, "/balances", { requireAuth: true, address, product });
    return normalizeBalancesResponse(raw);
  }

  const raw = await apiFetch<unknown>(chainId, "/account/balances", { requireAuth: true, address, product });
  return normalizeBalancesResponse(raw);
}

export async function getUnifiedAccount(chainId: number, address?: string | null, product?: TradeProduct): Promise<UnifiedAccountResponse> {
  return apiFetch<UnifiedAccountResponse>(chainId, "/unified/account", { requireAuth: true, address, product });
}

export interface AccountTradesResponse {
  trades: Trade[];
}

export async function getAccountTrades(chainId: number, address?: string | null, product?: TradeProduct): Promise<AccountTradesResponse> {
  return apiFetch<AccountTradesResponse>(chainId, "/account/trades", { requireAuth: true, address, product });
}

export interface WithdrawHistoryResponse {
  withdrawals: WithdrawRecord[];
}

export interface GetFundingFeeHistoryParams {
  symbol?: string;
  startTime?: number;
  endTime?: number;
  limit?: number;
}

function normalizeWithdrawHistoryResponse(raw: unknown): WithdrawHistoryResponse {
  const data = unwrapApiData<unknown>(raw);
  const rawWithdrawals = Array.isArray(data)
    ? data
    : Array.isArray((data as any)?.withdrawals)
      ? (data as any).withdrawals
      : [];

  const withdrawals = rawWithdrawals.map(normalizeWithdrawRecord);

  return { withdrawals };
}

function normalizeApiTimestamp(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 1_000_000_000_000 ? Math.floor(value / 1000) : value;
  }

  if (typeof value === "string" && value.trim()) {
    const numericValue = Number(value);
    if (Number.isFinite(numericValue)) {
      return numericValue > 1_000_000_000_000 ? Math.floor(numericValue / 1000) : numericValue;
    }

    const parsedDate = Date.parse(value);
    if (Number.isFinite(parsedDate)) {
      return Math.floor(parsedDate / 1000);
    }
  }

  return 0;
}

function normalizeWithdrawRecord(record: any): WithdrawRecord {
  return {
    ...record,
    id: String(record?.id ?? record?.withdraw_id ?? ""),
    token: String(record?.token ?? ""),
    amount: String(record?.amount ?? "0"),
    amount_in_wei: record?.amount_in_wei !== undefined ? String(record.amount_in_wei) : undefined,
    token_address: record?.token_address,
    tx_hash: record?.tx_hash ?? record?.transaction_hash ?? null,
    status: record?.status ?? "pending",
    created_at: normalizeApiTimestamp(record?.created_at ?? record?.requested_at ?? record?.completed_at),
    completed_at:
      record?.completed_at !== undefined || record?.confirmed_at !== undefined
        ? normalizeApiTimestamp(record?.completed_at ?? record?.confirmed_at)
        : undefined,
    expiry: record?.expiry ?? record?.deadline,
    backend_signature: record?.backend_signature ?? record?.signature,
    hash: record?.hash,
  };
}

export async function getWithdrawHistory(chainId: number, product?: TradeProduct): Promise<WithdrawHistoryResponse> {
  if (product === "spot") {
    const raw = await apiFetch<unknown>(chainId, "/withdrawals?limit=50", { requireAuth: true, product });
    return normalizeWithdrawHistoryResponse(raw);
  }

  return apiFetch<WithdrawHistoryResponse>(chainId, "/withdraw/history", { requireAuth: true, product });
}

export async function getWithdrawById(
  chainId: number,
  withdrawId: string,
  product?: TradeProduct
): Promise<WithdrawRecord> {
  const path = product === "spot" ? `/withdrawals/${withdrawId}` : `/withdraw/${withdrawId}`;
  const raw = await apiFetch<WithdrawRecord | ApiEnvelope<WithdrawRecord>>(chainId, path, {
    requireAuth: true,
    product,
  });
  return normalizeWithdrawRecord(unwrapApiData(raw));
}

export interface SpotTransferRequest {
  token: string;
  amount: string;
  direction: "perp_to_spot" | "spot_to_perp";
}

export interface SpotTransferResponse {
  success?: boolean;
  transfer_id?: string;
  id?: string;
  token?: string;
  amount?: string;
  direction?: SpotTransferRequest["direction"];
}

export async function spotTransfer(chainId: number, request: SpotTransferRequest): Promise<SpotTransferResponse> {
  const raw = await apiFetch<SpotTransferResponse | ApiEnvelope<SpotTransferResponse>>(chainId, "/transfer", {
    method: "POST",
    body: JSON.stringify(request),
    requireAuth: true,
    product: "spot",
  });

  return unwrapApiData(raw);
}

export async function getFundingFeeHistory(
  chainId: number,
  params: GetFundingFeeHistoryParams = {}
): Promise<FundingFeeHistoryItem[]> {
  const query = new URLSearchParams();
  if (params.symbol) {
    query.set(
      "symbol",
      params.symbol.includes("USDT") ? params.symbol.toUpperCase() : `${params.symbol.toUpperCase()}USDT`
    );
  }
  if (params.startTime !== undefined) query.set("startTime", String(params.startTime));
  if (params.endTime !== undefined) query.set("endTime", String(params.endTime));
  query.set("limit", String(params.limit ?? 100));

  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiFetch<FundingFeeHistoryItem[]>(chainId, `/fapi/v1/fundingFeeHistory${suffix}`, { requireAuth: true });
}

export async function requestWithdraw(
  chainId: number,
  request: WithdrawRequest,
  product?: TradeProduct
): Promise<WithdrawResponse> {
  return apiFetch<WithdrawResponse>(chainId, "/withdraw/request", {
    method: "POST",
    body: JSON.stringify(request),
    requireAuth: true,
    product,
  });
}

export interface ConfirmWithdrawRequest {
  tx_hash: string;
}

export interface ConfirmWithdrawResponse {
  success: boolean;
  message?: string;
}

/**
 * Confirm withdrawal by submitting transaction hash
 * This is optional but recommended to speed up status updates
 */
export async function confirmWithdraw(
  chainId: number,
  withdrawId: string,
  request: ConfirmWithdrawRequest,
  product?: TradeProduct
): Promise<ConfirmWithdrawResponse> {
  if (product === "spot") {
    return { success: true };
  }

  return apiFetch<ConfirmWithdrawResponse>(chainId, `/withdraw/${withdrawId}/confirm`, {
    method: "POST",
    body: JSON.stringify(request),
    requireAuth: true,
    product,
  });
}

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

export async function createOrder(
  chainId: number,
  request: CreateOrderRequest,
  address?: string | null,
  product?: TradeProduct
): Promise<CreateOrderResponse> {
  return apiFetch<CreateOrderResponse>(chainId, "/orders", {
    method: "POST",
    body: JSON.stringify(request),
    requireAuth: true,
    address,
    product,
  });
}

/**
 * 订单预估(Order Preview)— 用户调整面板(数量、杠杆、价格)时实时查询预估数据
 * 使用 custom client 的 address-aware token 存储,与登录流程一致
 */
export async function getOrderPreview(
  chainId: number,
  request: import("../types").OrderPreviewRequest,
  address?: string | null,
  product?: TradeProduct
): Promise<import("../types").OrderPreviewResponse> {
  // Backend expects API symbol format (e.g. "BTCUSDT"), but state may hold "BTC-USD"
  const normalized = { ...request, symbol: convertSymbolToApiFormat(request.symbol) };
  return apiFetch<import("../types").OrderPreviewResponse>(chainId, "/orders/preview", {
    method: "POST",
    body: JSON.stringify(normalized),
    requireAuth: true,
    address,
    product,
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
  request: CancelOrderRequest,
  product?: TradeProduct
): Promise<CancelOrderResponse> {
  return apiFetch<CancelOrderResponse>(chainId, `/orders/${orderId}`, {
    method: "DELETE",
    body: JSON.stringify(request),
    requireAuth: true,
    product,
  });
}

export async function updateOrder(
  chainId: number,
  orderId: string,
  request: UpdateOrderRequest,
  address?: string | null,
  product?: TradeProduct
): Promise<UpdateOrderResponse> {
  try {
    return await apiFetch<UpdateOrderResponse>(chainId, `/orders/${orderId}`, {
      method: "PATCH",
      body: JSON.stringify(request),
      requireAuth: true,
      address,
      product,
    });
  } catch (error) {
    const status = (error as { status?: number })?.status;

    if (status !== 404 && status !== 405) {
      throw error;
    }

    return apiFetch<UpdateOrderResponse>(chainId, `/orders/${orderId}`, {
      method: "PUT",
      body: JSON.stringify(request),
      requireAuth: true,
      address,
      product,
    });
  }
}

export async function batchCancelOrders(chainId: number, request: BatchCancelRequest, product?: TradeProduct): Promise<BatchCancelResponse> {
  return apiFetch<BatchCancelResponse>(chainId, "/orders/batch", {
    method: "POST",
    body: JSON.stringify(request),
    requireAuth: true,
    product,
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

export async function updatePositionCollateral(
  chainId: number,
  positionId: string,
  request: CollateralRequest
): Promise<Position> {
  return addPositionCollateral(chainId, positionId, request);
}

// ============================================
// Position TP/SL API
// ============================================

/**
 * Set Take Profit and Stop Loss for a position
 * POST /api/v1/positions/:position_id/tp-sl
 */
export async function setPositionTpSl(
  chainId: number,
  positionId: string,
  request: TpSlRequest,
  address?: string | null
): Promise<TpSlResponse> {
  const response = await apiFetch<{ success: boolean; data: TpSlResponse }>(chainId, `/positions/${positionId}/tp-sl`, {
    method: "POST",
    body: JSON.stringify(request),
    requireAuth: true,
    address,
  });
  return response.data;
}

/**
 * Get Take Profit and Stop Loss for a position
 * GET /api/v1/positions/:position_id/tp-sl
 */
export async function getPositionTpSl(
  chainId: number,
  positionId: string,
  address?: string | null
): Promise<TpSlResponse> {
  const response = await apiFetch<{ success: boolean; data: TpSlResponse }>(chainId, `/positions/${positionId}/tp-sl`, {
    requireAuth: true,
    address,
  });
  return response.data;
}

/**
 * Delete Take Profit and Stop Loss for a position
 * DELETE /api/v1/positions/:position_id/tp-sl
 */
export async function deletePositionTpSl(
  chainId: number,
  positionId: string
): Promise<{ success: boolean; data: string; error: string | null }> {
  return apiFetch<{ success: boolean; data: string; error: string | null }>(chainId, `/positions/${positionId}/tp-sl`, {
    method: "DELETE",
    requireAuth: true,
  });
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
  is_final?: boolean;
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

// Backend rejects "30m" on both perp (/markets/.../candles) and spot
// (/spot/klines) — the supported set is exactly these six values.
export type KlinePeriod = "1m" | "5m" | "15m" | "1h" | "4h" | "1d";

export interface GetCandlesParams {
  period: KlinePeriod;
  limit?: number;
  start?: number;
  end?: number;
}

export async function getCandles(
  chainId: number,
  symbol: string,
  params: GetCandlesParams,
  product?: TradeProduct
): Promise<CandlesResponse> {
  const apiSymbol = convertSymbolToApiFormat(symbol);
  const queryParams = new URLSearchParams();
  // Spot and perp use different parameter names for the same fields:
  //   spot: ?interval=…&start_time=…&end_time=…
  //   perp: ?period=…&from=…&to=…
  // Both expect unix seconds for time fields.
  const isSpot = product === "spot";
  queryParams.set(isSpot ? "interval" : "period", params.period);
  if (params.limit !== undefined) queryParams.set("limit", params.limit.toString());
  if (params.start !== undefined) {
    queryParams.set(isSpot ? "start_time" : "from", Math.floor(params.start / 1000).toString());
  }
  if (params.end !== undefined) {
    queryParams.set(isSpot ? "end_time" : "to", Math.floor(params.end / 1000).toString());
  }

  if (isSpot) {
    queryParams.set("symbol", apiSymbol);
    const raw = await apiFetch<unknown>(chainId, `/klines?${queryParams.toString()}`, { product });
    return normalizeSpotCandles(raw, apiSymbol, params.period);
  }

  return apiFetch<CandlesResponse>(chainId, `/markets/${apiSymbol}/candles?${queryParams.toString()}`);
}

export async function getLatestCandle(
  chainId: number,
  symbol: string,
  period: KlinePeriod
): Promise<LatestCandleResponse> {
  const apiSymbol = convertSymbolToApiFormat(symbol);
  return apiFetch<LatestCandleResponse>(chainId, `/klines/${apiSymbol}/candles/latest?period=${period}`);
}

// ============================================
// Referral API (根据 API 文档: https://zdocs.tubex.chat/account/referral)
// ============================================

// EIP-712 Typed Data interface
/**
 * 创建推荐码
 * POST /api/v1/referral/codes
 */
export async function createReferralCode(
  chainId: number,
  params: CreateReferralCodeParams
): Promise<CreateReferralCodeResponse> {
  return apiFetch<CreateReferralCodeResponse>(chainId, "/referral/codes", {
    method: "POST",
    body: JSON.stringify(params),
    requireAuth: true,
  });
}

/**
 * 绑定推荐码
 * POST /api/v1/referral/bind
 */
export async function bindReferralCode(
  chainId: number,
  params: BindReferralCodeParams
): Promise<BindReferralCodeResponse> {
  return apiFetch<BindReferralCodeResponse>(chainId, "/referral/bind", {
    method: "POST",
    body: JSON.stringify(params),
    requireAuth: true,
  });
}

/**
 * 获取推荐面板
 * GET /api/v1/referral/dashboard
 */
export async function getReferralDashboard(
  chainId: number,
  options?: { address?: string }
): Promise<ReferralDashboardResponse> {
  if (referralUseMockFromEnv()) {
    return getReferralDashboardMock();
  }
  const raw = await apiFetch<unknown>(chainId, "/referral/dashboard", {
    requireAuth: true,
    address: options?.address,
  });
  return normalizeReferralDashboardResponse(raw);
}

/**
 * 获取推荐状态（作为推荐人/被推荐人双向）
 * GET /api/v1/referral/status
 */
export async function getReferralStatus(chainId: number): Promise<ReferralStatusResponse> {
  if (referralUseMockFromEnv()) {
    return getReferralStatusMock();
  }
  return apiFetch<ReferralStatusResponse>(chainId, "/referral/status", {
    requireAuth: true,
  });
}

/**
 * 获取领取返佣签名
 * POST /api/v1/referral/on-chain/claim-signature
 */
export async function getReferralClaimSignature(
  chainId: number,
  request: ReferralClaimSignatureRequest
): Promise<ReferralClaimSignatureResponse> {
  return apiFetch<ReferralClaimSignatureResponse>(chainId, "/referral/on-chain/claim-signature", {
    method: "POST",
    body: JSON.stringify(request),
    requireAuth: true,
  });
}

/**
 * 领取奖励
 * POST /api/v1/referral/claim
 */
export async function claimReferralReward(
  chainId: number,
  options?: { address?: string }
): Promise<ClaimReferralResponse> {
  return apiFetch<ClaimReferralResponse>(chainId, "/referral/claim", {
    method: "POST",
    body: JSON.stringify({}),
    requireAuth: true,
    address: options?.address,
  });
}

/**
 * 与 {@link getReferralDashboard} 同源：`GET /referral/dashboard`（Bearer），
 * 映射为旧 `OnChainDashboardResponse` 字段名。`address` 仅用于多账户 JWT 解析（见 apiFetch）。
 */
export async function getOnChainReferralDashboard(chainId: number, address: string): Promise<OnChainDashboardResponse> {
  if (referralUseMockFromEnv()) {
    return getOnChainReferralDashboardMock(address);
  }
  const dash = await getReferralDashboard(chainId, { address });
  return mapReferralDashboardToOnChainResponse(dash);
}

/**
 * 查询可领取金额（公开接口）
 * GET /api/v1/referral/on-chain/claimable/:address
 */
export async function getClaimableReferralAmount(chainId: number, address: string): Promise<ClaimableResponse> {
  return apiFetch<ClaimableResponse>(chainId, `/referral/on-chain/claimable/${address}`);
}

/**
 * 操作员状态（公开接口）
 * GET /api/v1/referral/on-chain/operator-status
 */
export async function getReferralOperatorStatus(chainId: number): Promise<OperatorStatusResponse> {
  return apiFetch<OperatorStatusResponse>(chainId, "/referral/on-chain/operator-status");
}

/** 返佣榜默认条数（与 `GET /referral/leaderboard` 文档一致） */
export const REFERRAL_LEADERBOARD_DEFAULT_N = 10;
/** 返佣榜 `n` 上限 */
export const REFERRAL_LEADERBOARD_MAX_N = 50;

export function clampReferralLeaderboardN(n?: number): number {
  const raw = n ?? REFERRAL_LEADERBOARD_DEFAULT_N;
  const x = Number(raw);
  if (!Number.isFinite(x)) return REFERRAL_LEADERBOARD_DEFAULT_N;
  return Math.min(REFERRAL_LEADERBOARD_MAX_N, Math.max(1, Math.floor(x)));
}

/**
 * 返佣排行榜：按总返佣金额排序的前 N 名推荐人（无需认证）
 * GET /api/v1/referral/leaderboard?n=
 */
export async function getReferralLeaderboard(chainId: number, n?: number): Promise<ReferralLeaderboardEntry[]> {
  const q = clampReferralLeaderboardN(n);
  if (referralUseMockFromEnv()) {
    return getReferralLeaderboardMock(q);
  }
  const raw = await apiFetch<unknown>(chainId, `/referral/leaderboard?n=${q}`);
  return normalizeReferralLeaderboardResponse(raw);
}

// ============================================
// Earn API (理财服务)
// ============================================

/**
 * 获取 EIP-712 Domain 信息
 * GET /api/v1/earn/domain
 */
export async function getEarnDomain(chainId: number): Promise<EarnDomainResponse> {
  return apiFetch<EarnDomainResponse>(chainId, "/earn/domain");
}

/**
 * 获取产品列表
 * GET /api/v1/earn/products
 */
export async function getEarnProducts(
  chainId: number,
  params?: { status?: string; page?: number; page_size?: number }
): Promise<EarnProductsResponse> {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set("status", params.status);
  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.page_size) searchParams.set("page_size", String(params.page_size));

  const query = searchParams.toString();
  const path = query ? `/earn/products?${query}` : "/earn/products";
  return apiFetch<EarnProductsResponse>(chainId, path);
}

/**
 * 获取产品详情
 * GET /api/v1/earn/products/:id
 */
export async function getEarnProduct(chainId: number, productId: string): Promise<EarnProduct> {
  return apiFetch<EarnProduct>(chainId, `/earn/products/${productId}`);
}

/**
 * 获取历史表现
 * GET /api/v1/earn/performance
 */
export async function getEarnPerformance(chainId: number, limit?: number): Promise<EarnPerformanceResponse> {
  const path = limit ? `/earn/performance?limit=${limit}` : "/earn/performance";
  return apiFetch<EarnPerformanceResponse>(chainId, path);
}

/**
 * 获取我的申购列表 (需要认证)
 * GET /api/v1/earn/subscriptions
 * 注意: API 返回原始数组，需要包装成 EarnSubscriptionsResponse 格式
 */
export async function getEarnSubscriptions(
  chainId: number,
  address?: string | null
): Promise<EarnSubscriptionsResponse> {
  const subscriptions = await apiFetch<EarnSubscription[]>(chainId, "/earn/subscriptions", {
    requireAuth: true,
    address,
  });
  return { subscriptions };
}

/**
 * 准备申购 - 获取后端签名 (需要认证)
 * POST /api/v1/earn/subscribe/prepare
 */
export async function prepareEarnSubscribe(
  chainId: number,
  request: EarnSubscribePrepareRequest,
  address?: string | null
): Promise<EarnSubscribePrepareResponse> {
  return apiFetch<EarnSubscribePrepareResponse>(chainId, "/earn/subscribe/prepare", {
    method: "POST",
    body: JSON.stringify(request),
    requireAuth: true,
    address,
  });
}

// ============================================
// PnL API (每日和累计盈亏)
// ============================================

/**
 * 获取账户每日和累计盈亏数据
 * GET /api/v1/account/pnl
 */
export async function getAccountPnl(
  chainId: number,
  params?: GetPnlParams,
  address?: string | null
): Promise<PnlResponse> {
  const searchParams = new URLSearchParams();
  if (params?.symbol) searchParams.set("symbol", params.symbol);
  if (params?.start_date) searchParams.set("start_date", params.start_date);
  if (params?.end_date) searchParams.set("end_date", params.end_date);
  if (params?.days !== undefined) searchParams.set("days", String(params.days));

  const query = searchParams.toString();
  const path = query ? `/account/pnl?${query}` : "/account/pnl";

  return apiFetch<PnlResponse>(chainId, path, {
    requireAuth: true,
    address,
  });
}
