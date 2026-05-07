import useSWR from "swr";

import { ContractsChainId } from "config/chains";

import { getReferralStatus } from "./client";
import { referralUseMockFromEnv } from "./referralMock";
import { useAuthToken } from "./useAuthToken";

/**
 * GET /referral/status — 推荐人/被推荐人双向状态
 */
export function useReferralStatus(chainId: ContractsChainId | undefined, options?: { enabled?: boolean }) {
  const { token } = useAuthToken(chainId);
  const useMock = referralUseMockFromEnv();
  const enabled = options?.enabled !== false && Boolean(chainId && (useMock || token));
  const authKey = useMock ? "mock" : token;

  const { data, error, isLoading, mutate } = useSWR(
    enabled ? [`referral-status`, chainId, authKey] : null,
    async () => {
      if (!chainId) throw new Error("Chain ID is required");
      return getReferralStatus(chainId);
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      refreshInterval: 60_000,
      shouldRetryOnError: (error: unknown) => (error as { status?: number } | undefined)?.status !== 401,
    }
  );

  return { status: data, isLoading, error, mutate };
}
