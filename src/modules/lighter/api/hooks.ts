import useSWR, { SWRConfiguration } from "swr";
import { useAccount } from "wagmi";

import { getServerBaseUrl } from "config/backend";

import {
  getMarkets,
  getMarketDetails,
  getOrderbook,
  getTicker,
  getTrades,
  getPrice,
  getAllFundingRates,
  getFundingRate,
  getFundingHistory,
  getOnChainDashboard,
  getOnChainClaimable,
  getOperatorStatus,
  type MarketDetailsResponse,
  type PositionsResponse,
  type OrdersResponse,
  type BalancesResponse,
} from "./client";
import {
  getBalances,
  isAuthenticated,
  getWithdrawHistory,
  getPositions,
  getOrders,
  getUnifiedAccount,
  type WithdrawHistoryResponse,
  type UnifiedAccountResponse,
} from "./custom/client";
import type {
  Market,
  Orderbook,
  Ticker,
  Trade,
  PriceResponse,
  FundingRate,
  FundingHistory,
  OnChainDashboard,
  ClaimableAmount,
  OperatorStatus,
} from "./types";

// Default SWR configuration
const defaultConfig: SWRConfiguration = {
  revalidateOnFocus: false,
  dedupingInterval: 5000,
};

// ============================================
// Market Hooks
// ============================================
export function usePrimitMarkets(chainId: number | undefined, config?: SWRConfiguration) {
  return useSWR<{ markets: Market[]; total: number }>(
    chainId ? [`primit-markets`, chainId] : null,
    () => getMarkets(chainId!),
    { ...defaultConfig, ...config }
  );
}

export function usePrimitOrderbook(chainId: number | undefined, symbol: string | undefined, config?: SWRConfiguration) {
  return useSWR<Orderbook>(
    chainId && symbol ? [`primit-orderbook`, chainId, symbol] : null,
    () => getOrderbook(chainId!, symbol!),
    { ...defaultConfig, refreshInterval: 1000, ...config }
  );
}

export function usePrimitTicker(chainId: number | undefined, symbol: string | undefined, config?: SWRConfiguration) {
  return useSWR<Ticker>(
    chainId && symbol ? [`primit-ticker`, chainId, symbol] : null,
    () => getTicker(chainId!, symbol!),
    { ...defaultConfig, refreshInterval: 2000, dedupingInterval: 1000, ...config }
  );
}

export function usePrimitMarketDetails(
  chainId: number | undefined,
  symbol: string | undefined,
  config?: SWRConfiguration
) {
  return useSWR<MarketDetailsResponse>(
    chainId && symbol ? [`primit-market-details`, chainId, symbol] : null,
    () => getMarketDetails(chainId!, symbol!),
    { ...defaultConfig, ...config }
  );
}

export function usePrimitTrades(chainId: number | undefined, symbol: string | undefined, config?: SWRConfiguration) {
  return useSWR<{ symbol: string; trades: Trade[] }>(
    chainId && symbol ? [`primit-trades`, chainId, symbol] : null,
    () => getTrades(chainId!, symbol!),
    { ...defaultConfig, refreshInterval: 1000, ...config }
  );
}

export function usePrimitPrice(chainId: number | undefined, symbol: string | undefined, config?: SWRConfiguration) {
  return useSWR<PriceResponse>(
    chainId && symbol ? [`primit-price`, chainId, symbol] : null,
    () => getPrice(chainId!, symbol!),
    { ...defaultConfig, refreshInterval: 1000, ...config }
  );
}

// ============================================
// Funding Rate Hooks
// ============================================
export function usePrimitFundingRates(chainId: number | undefined, config?: SWRConfiguration) {
  return useSWR<{ rates: FundingRate[] }>(
    chainId ? [`primit-funding-rates`, chainId] : null,
    () => getAllFundingRates(chainId!),
    { ...defaultConfig, refreshInterval: 30000, ...config }
  );
}

export function usePrimitFundingRate(chainId: number | undefined, symbol: string | undefined, config?: SWRConfiguration) {
  return useSWR<FundingRate>(
    chainId && symbol ? [`primit-funding-rate`, chainId, symbol] : null,
    () => getFundingRate(chainId!, symbol!),
    { ...defaultConfig, refreshInterval: 30000, ...config }
  );
}

export function usePrimitFundingHistory(
  chainId: number | undefined,
  symbol: string | undefined,
  params?: { period?: string; limit?: number },
  config?: SWRConfiguration
) {
  const period = params?.period;
  const limit = params?.limit;
  return useSWR<FundingHistory[]>(
    chainId && symbol ? [`primit-funding-history`, chainId, symbol, period, limit] : null,
    () => getFundingHistory(chainId!, symbol!, params),
    { ...defaultConfig, ...config }
  );
}

// ============================================
// Referral Hooks (`GET /referral/dashboard` → 映射为 OnChainDashboard)
// ============================================
export function usePrimitOnChainDashboard(
  chainId: number | undefined,
  address: string | undefined,
  config?: SWRConfiguration
) {
  return useSWR<OnChainDashboard>(
    chainId && address ? [`primit-onchain-dashboard`, chainId, address] : null,
    () => getOnChainDashboard(chainId!, address!),
    { ...defaultConfig, ...config }
  );
}

export function usePrimitClaimable(chainId: number | undefined, address: string | undefined, config?: SWRConfiguration) {
  return useSWR<ClaimableAmount>(
    chainId && address ? [`primit-claimable`, chainId, address] : null,
    () => getOnChainClaimable(chainId!, address!),
    { ...defaultConfig, ...config }
  );
}

export function usePrimitOperatorStatus(chainId: number | undefined, config?: SWRConfiguration) {
  return useSWR<OperatorStatus>(chainId ? [`primit-operator-status`, chainId] : null, () => getOperatorStatus(chainId!), {
    ...defaultConfig,
    ...config,
  });
}

// ============================================
// Combined Hooks (with wallet)
// ============================================
export function usePrimitUserDashboard(config?: SWRConfiguration) {
  const { address, chainId } = useAccount();
  return usePrimitOnChainDashboard(chainId, address, config);
}

export function usePrimitUserClaimable(config?: SWRConfiguration) {
  const { address, chainId } = useAccount();
  return usePrimitClaimable(chainId, address, config);
}

// ============================================
// Utility: Check if backend is available
// ============================================
export function usePrimitBackendStatus(chainId: number | undefined) {
  return useSWR<boolean>(
    chainId ? [`primit-backend-status`, chainId] : null,
    async () => {
      try {
        const baseUrl = getServerBaseUrl(chainId!);
        const response = await fetch(`${baseUrl}/health`);
        return response.ok;
      } catch (_error) {
        return false;
      }
    },
    { ...defaultConfig, refreshInterval: 30000 }
  );
}

// ============================================
// Protected Account Hooks (Requires Auth)
// ============================================
export function usePrimitPositions(chainId: number | undefined, config?: SWRConfiguration) {
  const { address } = useAccount();
  const authenticated = isAuthenticated(address, chainId);
  return useSWR<PositionsResponse>(
    chainId && authenticated && address ? [`primit-positions`, chainId, address] : null,
    () => getPositions(chainId!, address),
    { ...defaultConfig, refreshInterval: 2000, ...config }
  );
}

export function usePrimitOrders(chainId: number | undefined, config?: SWRConfiguration) {
  const { address } = useAccount();
  const authenticated = isAuthenticated(address, chainId);
  return useSWR<OrdersResponse>(
    chainId && authenticated && address ? [`primit-orders`, chainId, address] : null,
    () => getOrders(chainId!, address),
    { ...defaultConfig, refreshInterval: 5000, ...config }
  );
}

export function usePrimitBalances(chainId: number | undefined, config?: SWRConfiguration) {
  const { address } = useAccount();
  const authenticated = isAuthenticated(address, chainId);
  return useSWR<BalancesResponse>(
    chainId && authenticated && address ? [`primit-balances`, chainId, address] : null,
    () => getBalances(chainId!, address),
    {
      ...defaultConfig,
      refreshInterval: 10000,
      ...config,
      onError: (error: any, key: string, swrConfig: any) => {
        // Handle 401 errors by clearing token
        if (error?.status === 401 || error?.message?.includes("401") || error?.message?.includes("Unauthorized")) {
          console.warn(" 401 error in usePrimitBalances, token will be cleared by apiFetch");
          // Token is already cleared in apiFetch, but we can trigger re-authentication if needed
        }
        // Call custom onError if provided
        if (config?.onError) {
          config.onError(error, key, swrConfig);
        }
      },
    }
  );
}

export function usePrimitUnifiedAccount(chainId: number | undefined, config?: SWRConfiguration) {
  const { address } = useAccount();
  const authenticated = isAuthenticated(address, chainId);
  return useSWR<UnifiedAccountResponse>(
    chainId && authenticated && address ? [`primit-unified-account`, chainId, address] : null,
    () => getUnifiedAccount(chainId!, address),
    {
      ...defaultConfig,
      refreshInterval: 5000,
      ...config,
    }
  );
}

// ============================================
// Combined User Hooks (with wallet)
// ============================================
export function usePrimitUserPositions(config?: SWRConfiguration) {
  const { chainId } = useAccount();
  return usePrimitPositions(chainId, config);
}

export function usePrimitUserOrders(config?: SWRConfiguration) {
  const { chainId } = useAccount();
  return usePrimitOrders(chainId, config);
}

export function usePrimitUserBalances(config?: SWRConfiguration) {
  const { chainId } = useAccount();
  return usePrimitBalances(chainId, config);
}

export function usePrimitUserUnifiedAccount(config?: SWRConfiguration) {
  const { chainId } = useAccount();
  return usePrimitUnifiedAccount(chainId, config);
}

export function usePrimitWithdrawHistory(chainId: number | undefined, config?: SWRConfiguration) {
  const authenticated = isAuthenticated();
  return useSWR<WithdrawHistoryResponse>(
    chainId && authenticated ? [`primit-withdraw-history`, chainId] : null,
    () => getWithdrawHistory(chainId!),
    { ...defaultConfig, refreshInterval: 30000, ...config }
  );
}

export function usePrimitUserWithdrawHistory(config?: SWRConfiguration) {
  const { chainId } = useAccount();
  return usePrimitWithdrawHistory(chainId, config);
}

// ============================================
// Alias exports for the trading page
// ============================================
export function useApiMarkets(chainId: number | undefined, config?: SWRConfiguration) {
  const result = usePrimitMarkets(chainId, config);
  return {
    markets: result.data ? { markets: result.data } : undefined,
    isLoading: result.isLoading,
    error: result.error,
    mutate: result.mutate,
  };
}

export function useApiTicker(chainId: number | undefined, symbol: string | undefined, config?: SWRConfiguration) {
  const result = usePrimitTicker(chainId, symbol, config);
  return {
    ticker: result.data,
    isLoading: result.isLoading,
    error: result.error,
    mutate: result.mutate,
  };
}

export function useApiMarketDetails(
  chainId: number | undefined,
  symbol: string | undefined,
  config?: SWRConfiguration
) {
  const result = usePrimitMarketDetails(chainId, symbol, config);
  return {
    details: result.data,
    isLoading: result.isLoading,
    error: result.error,
    mutate: result.mutate,
  };
}

export function useApiOrderbook(chainId: number | undefined, symbol: string | undefined, config?: SWRConfiguration) {
  const result = usePrimitOrderbook(chainId, symbol, config);
  return {
    orderbook: result.data,
    isLoading: result.isLoading,
    error: result.error,
    mutate: result.mutate,
  };
}

export function useApiTrades(chainId: number | undefined, symbol: string | undefined, config?: SWRConfiguration) {
  const result = usePrimitTrades(chainId, symbol, config);
  return {
    trades: result.data,
    isLoading: result.isLoading,
    error: result.error,
    mutate: result.mutate,
  };
}

export function useApiPrice(chainId: number | undefined, symbol: string | undefined, config?: SWRConfiguration) {
  const result = usePrimitPrice(chainId, symbol, config);
  return {
    price: result.data,
    isLoading: result.isLoading,
    error: result.error,
    mutate: result.mutate,
  };
}
