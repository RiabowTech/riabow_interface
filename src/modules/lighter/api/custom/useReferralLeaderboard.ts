import useSWR from "swr";

import type { ContractsChainId } from "config/chains";

import { clampReferralLeaderboardN, getReferralLeaderboard } from "./client";

/**
 * 返佣排行榜 `GET /referral/leaderboard?n=`（无需登录）
 */
export function useReferralLeaderboard(
  chainId: ContractsChainId | undefined,
  options?: { n?: number; enabled?: boolean }
) {
  const n = clampReferralLeaderboardN(options?.n);
  const enabled = options?.enabled !== false && Boolean(chainId);

  const { data, error, isLoading, mutate } = useSWR(
    enabled ? [`referral-leaderboard`, chainId, n] : null,
    () => getReferralLeaderboard(chainId!, n),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      refreshInterval: 60_000,
      shouldRetryOnError: (err: unknown) => (err as { status?: number } | undefined)?.status !== 400,
    }
  );

  return {
    rows: data ?? [],
    error,
    isLoading,
    mutate,
    n,
  };
}
