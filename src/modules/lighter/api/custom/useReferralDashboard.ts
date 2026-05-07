import useSWR from "swr";
import { useAccount } from "wagmi";

import { ContractsChainId } from "config/chains";

import { getReferralDashboard } from "./client";
import { referralUseMockFromEnv } from "./referralMock";
import { useAuthToken } from "./useAuthToken";

/**
 * Hook to fetch referral dashboard data
 * GET /api/v1/referral/dashboard
 */
export function useReferralDashboard(chainId: ContractsChainId | undefined, options?: { enabled?: boolean }) {
  const { address } = useAccount();
  const { token } = useAuthToken(chainId);
  const useMock = referralUseMockFromEnv();
  const enabled = options?.enabled !== false && Boolean(chainId && (useMock || token));
  const authKey = useMock ? "mock" : token;

  const { data, error, isLoading, mutate } = useSWR(
    enabled ? [`referral-dashboard`, chainId, authKey, address] : null,
    async () => {
      if (!chainId) {
        throw new Error("Chain ID is required");
      }
      return getReferralDashboard(chainId, { address: address ?? undefined });
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      refreshInterval: 30000, // Refresh every 30 seconds
      shouldRetryOnError: (error: unknown) => (error as { status?: number } | undefined)?.status !== 401,
    }
  );

  return {
    dashboard: data,
    isLoading,
    error,
    mutate,
  };
}

