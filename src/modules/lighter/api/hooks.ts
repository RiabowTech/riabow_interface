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
export function useZanbaraMarkets(chainId: number | undefined, config?: SWRConfiguration) {
  return useSWR<{ markets: Market[]; total: number }>(
    chainId ? [`zanbara-markets`, chainId] : null,
    () => getMarkets(chainId!),
    { ...defaultConfig, ...config }
  );
}

export function useZanbaraOrderbook(chainId: number | undefined, symbol: string | undefined, config?: SWRConfiguration) {
  return useSWR<Orderbook>(
    chainId && symbol ? [`zanbara-orderbook`, chainId, symbol] : null,
    () => getOrderbook(chainId!, symbol!),
    { ...defaultConfig, refreshInterval: 1000, ...config }
  );
}

export function useZanbaraTicker(chainId: number | undefined, symbol: string | undefined, config?: SWRConfiguration) {
  return useSWR<Ticker>(
    chainId && symbol ? [`zanbara-ticker`, chainId, symbol] : null,
    () => getTicker(chainId!, symbol!),
    { ...defaultConfig, refreshInterval: 2000, dedupingInterval: 1000, ...config }
  );
}

export function useZanbaraMarketDetails(
  chainId: number | undefined,
  symbol: string | undefined,
  config?: SWRConfiguration
) {
  return useSWR<MarketDetailsResponse>(
    chainId && symbol ? [`zanbara-market-details`, chainId, symbol] : null,
    () => getMarketDetails(chainId!, symbol!),
    { ...defaultConfig, ...config }
  );
}

export function useZanbaraTrades(chainId: number | undefined, symbol: string | undefined, config?: SWRConfiguration) {
  return useSWR<{ symbol: string; trades: Trade[] }>(
    chainId && symbol ? [`zanbara-trades`, chainId, symbol] : null,
    () => getTrades(chainId!, symbol!),
    { ...defaultConfig, refreshInterval: 1000, ...config }
  );
}

export function useZanbaraPrice(chainId: number | undefined, symbol: string | undefined, config?: SWRConfiguration) {
  return useSWR<PriceResponse>(
    chainId && symbol ? [`zanbara-price`, chainId, symbol] : null,
    () => getPrice(chainId!, symbol!),
    { ...defaultConfig, refreshInterval: 1000, ...config }
  );
}

// ============================================
// Funding Rate Hooks
// ============================================
export function useZanbaraFundingRates(chainId: number | undefined, config?: SWRConfiguration) {
  return useSWR<{ rates: FundingRate[] }>(
    chainId ? [`zanbara-funding-rates`, chainId] : null,
    () => getAllFundingRates(chainId!),
    { ...defaultConfig, refreshInterval: 30000, ...config }
  );
}

export function useZanbaraFundingRate(chainId: number | undefined, symbol: string | undefined, config?: SWRConfiguration) {
  return useSWR<FundingRate>(
    chainId && symbol ? [`zanbara-funding-rate`, chainId, symbol] : null,
    () => getFundingRate(chainId!, symbol!),
    { ...defaultConfig, refreshInterval: 30000, ...config }
  );
}

export function useZanbaraFundingHistory(
  chainId: number | undefined,
  symbol: string | undefined,
  params?: { period?: string; limit?: number },
  config?: SWRConfiguration
) {
  const period = params?.period;
  const limit = params?.limit;
  return useSWR<FundingHistory[]>(
    chainId && symbol ? [`zanbara-funding-history`, chainId, symbol, period, limit] : null,
    () => getFundingHistory(chainId!, symbol!, params),
    { ...defaultConfig, ...config }
  );
}

// ============================================
// Referral Hooks (`GET /referral/dashboard` → 映射为 OnChainDashboard)
// ============================================
export function useZanbaraOnChainDashboard(
  chainId: number | undefined,
  address: string | undefined,
  config?: SWRConfiguration
) {
  return useSWR<OnChainDashboard>(
    chainId && address ? [`zanbara-onchain-dashboard`, chainId, address] : null,
    () => getOnChainDashboard(chainId!, address!),
    { ...defaultConfig, ...config }
  );
}

export function useZanbaraClaimable(chainId: number | undefined, address: string | undefined, config?: SWRConfiguration) {
  return useSWR<ClaimableAmount>(
    chainId && address ? [`zanbara-claimable`, chainId, address] : null,
    () => getOnChainClaimable(chainId!, address!),
    { ...defaultConfig, ...config }
  );
}

export function useZanbaraOperatorStatus(chainId: number | undefined, config?: SWRConfiguration) {
  return useSWR<OperatorStatus>(chainId ? [`zanbara-operator-status`, chainId] : null, () => getOperatorStatus(chainId!), {
    ...defaultConfig,
    ...config,
  });
}

// ============================================
// Combined Hooks (with wallet)
// ============================================
export function useZanbaraUserDashboard(config?: SWRConfiguration) {
  const { address, chainId } = useAccount();
  return useZanbaraOnChainDashboard(chainId, address, config);
}

export function useZanbaraUserClaimable(config?: SWRConfiguration) {
  const { address, chainId } = useAccount();
  return useZanbaraClaimable(chainId, address, config);
}

// ============================================
// Utility: Check if backend is available
// ============================================
export function useZanbaraBackendStatus(chainId: number | undefined) {
  return useSWR<boolean>(
    chainId ? [`zanbara-backend-status`, chainId] : null,
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
export function useZanbaraPositions(chainId: number | undefined, config?: SWRConfiguration) {
  const { address } = useAccount();
  const authenticated = isAuthenticated(address, chainId);
  return useSWR<PositionsResponse>(
    chainId && authenticated && address ? [`zanbara-positions`, chainId, address] : null,
    () => getPositions(chainId!, address),
    { ...defaultConfig, refreshInterval: 2000, ...config }
  );
}

export function useZanbaraOrders(chainId: number | undefined, config?: SWRConfiguration) {
  const { address } = useAccount();
  const authenticated = isAuthenticated(address, chainId);
  return useSWR<OrdersResponse>(
    chainId && authenticated && address ? [`zanbara-orders`, chainId, address] : null,
    () => getOrders(chainId!, address),
    { ...defaultConfig, refreshInterval: 5000, ...config }
  );
}

export function useZanbaraBalances(chainId: number | undefined, config?: SWRConfiguration) {
  const { address } = useAccount();
  const authenticated = isAuthenticated(address, chainId);
  return useSWR<BalancesResponse>(
    chainId && authenticated && address ? [`zanbara-balances`, chainId, address] : null,
    () => getBalances(chainId!, address),
    {
      ...defaultConfig,
      refreshInterval: 10000,
      ...config,
      onError: (error: any, key: string, swrConfig: any) => {
        // Handle 401 errors by clearing token
        if (error?.status === 401 || error?.message?.includes("401") || error?.message?.includes("Unauthorized")) {
          console.warn(" 401 error in useZanbaraBalances, token will be cleared by apiFetch");
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

export function useZanbaraUnifiedAccount(chainId: number | undefined, config?: SWRConfiguration) {
  const { address } = useAccount();
  const authenticated = isAuthenticated(address, chainId);
  return useSWR<UnifiedAccountResponse>(
    chainId && authenticated && address ? [`zanbara-unified-account`, chainId, address] : null,
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
export function useZanbaraUserPositions(config?: SWRConfiguration) {
  const { chainId } = useAccount();
  return useZanbaraPositions(chainId, config);
}

export function useZanbaraUserOrders(config?: SWRConfiguration) {
  const { chainId } = useAccount();
  return useZanbaraOrders(chainId, config);
}

export function useZanbaraUserBalances(config?: SWRConfiguration) {
  const { chainId } = useAccount();
  return useZanbaraBalances(chainId, config);
}

export function useZanbaraUserUnifiedAccount(config?: SWRConfiguration) {
  const { chainId } = useAccount();
  return useZanbaraUnifiedAccount(chainId, config);
}

export function useZanbaraWithdrawHistory(chainId: number | undefined, config?: SWRConfiguration) {
  const authenticated = isAuthenticated();
  return useSWR<WithdrawHistoryResponse>(
    chainId && authenticated ? [`zanbara-withdraw-history`, chainId] : null,
    () => getWithdrawHistory(chainId!),
    { ...defaultConfig, refreshInterval: 30000, ...config }
  );
}

export function useZanbaraUserWithdrawHistory(config?: SWRConfiguration) {
  const { chainId } = useAccount();
  return useZanbaraWithdrawHistory(chainId, config);
}

// ============================================
// Alias exports for the trading page
// ============================================
export function useApiMarkets(chainId: number | undefined, config?: SWRConfiguration) {
  const result = useZanbaraMarkets(chainId, config);
  return {
    markets: result.data ? { markets: result.data } : undefined,
    isLoading: result.isLoading,
    error: result.error,
    mutate: result.mutate,
  };
}

export function useApiTicker(chainId: number | undefined, symbol: string | undefined, config?: SWRConfiguration) {
  const result = useZanbaraTicker(chainId, symbol, config);
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
  const result = useZanbaraMarketDetails(chainId, symbol, config);
  return {
    details: result.data,
    isLoading: result.isLoading,
    error: result.error,
    mutate: result.mutate,
  };
}

export function useApiOrderbook(chainId: number | undefined, symbol: string | undefined, config?: SWRConfiguration) {
  const result = useZanbaraOrderbook(chainId, symbol, config);
  return {
    orderbook: result.data,
    isLoading: result.isLoading,
    error: result.error,
    mutate: result.mutate,
  };
}

export function useApiTrades(chainId: number | undefined, symbol: string | undefined, config?: SWRConfiguration) {
  const result = useZanbaraTrades(chainId, symbol, config);
  return {
    trades: result.data,
    isLoading: result.isLoading,
    error: result.error,
    mutate: result.mutate,
  };
}

export function useApiPrice(chainId: number | undefined, symbol: string | undefined, config?: SWRConfiguration) {
  const result = useZanbaraPrice(chainId, symbol, config);
  return {
    price: result.data,
    isLoading: result.isLoading,
    error: result.error,
    mutate: result.mutate,
  };
}
