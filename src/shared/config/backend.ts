export const PROTOCOL_STATS_API_URL = "";

// ============================================
// Unified backend service URL configuration
// ============================================
// The active chain is selected by VITE_DEFAULT_CHAIN, so a single backend URL
// pair is sufficient — operators point env vars at the chain-specific cluster.
const TRADING_API_URL = import.meta.env.VITE_PROXY_API_URL || "https://api.primit.io";
const TRADING_WS_URL = import.meta.env.VITE_PROXY_WS_URL || "wss://api.primit.io";

// Legacy trading backend URL（已弃用，保留兼容）
const LEGACY_BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8080";

// ============================================
// Exported helpers
// ============================================

/**
 * Get the trading backend API URL.
 * The chainId arg is retained for call-site compatibility; the URL itself
 * is driven entirely by VITE_PROXY_API_URL.
 */
export function getTradingBackendUrl(_chainId: number): string {
  if (import.meta.env.DEV) {
    return "";
  }
  return TRADING_API_URL;
}

/**
 * Get the trading WebSocket URL.
 */
export function getTradingWsUrl(_chainId: number): string {
  if (import.meta.env.DEV) {
    return "";
  }
  return TRADING_WS_URL;
}

/**
 * Get the points API URL.
 * Uses the same base URL as the trading backend and appends /api/v1.
 */
export function getPointsApiUrl(chainId: number): string {
  const baseUrl = getTradingBackendUrl(chainId);
  return `${baseUrl}/api/v1`;
}

/**
 * Whether API trading data mode is enabled.
 * This currently always returns true.
 */
function isTradingApiMode(): boolean {
  return true;
}

export function getServerBaseUrl(chainId: number) {
  if (!chainId) {
    throw new Error("chainId is not provided");
  }

  // Force API trading mode to use the new backend URL for the selected chain.
  if (isTradingApiMode()) {
    return getTradingBackendUrl(chainId);
  }

  if (document.location.hostname.includes("deploy-preview")) {
    const fromLocalStorage = localStorage.getItem("SERVER_BASE_URL");
    if (fromLocalStorage) {
      return fromLocalStorage;
    }
  }

  return LEGACY_BACKEND_URL;
}

export function getServerUrl(chainId: number, path: string) {
  return `${getServerBaseUrl(chainId)}${path}`;
}
