import { useEffect, useRef, useState } from "react";
import useSWR from "swr";

import { useAuthToken } from "@/modules/lighter/api/custom/useAuthToken";
import { useChainId } from "lib/chains";
import useWallet from "lib/wallets/useWallet";

import { fetchFeeVipSummary } from "../api/feeVip.api";
import type { FeeVipSummary } from "../api/feeVip.types";

export function useFeeVipSummary() {
  const { account } = useWallet();
  const { chainId } = useChainId();
  const { token: jwt } = useAuthToken();

  const swr = useSWR<FeeVipSummary>(
    chainId ? ["fee-vip-summary", chainId, account ?? "", jwt ?? ""] : null,
    () => fetchFeeVipSummary(chainId!, account ?? undefined, jwt ?? undefined),
    { revalidateOnFocus: false, dedupingInterval: 60_000 }
  );

  // 记录 summary 最近一次"值变化"的本地时间戳(ms),用于 UI 展示"X 秒前更新"。
  // 只有 swr.data 引用变了才 bump,避免仅 revalidate 未返回新数据时误判为"刚更新"。
  const lastDataRef = useRef<FeeVipSummary | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  useEffect(() => {
    if (!swr.data) return;
    if (lastDataRef.current === swr.data) return;
    lastDataRef.current = swr.data;
    setLastUpdatedAt(Date.now());
  }, [swr.data]);

  return {
    summary: swr.data,
    error: swr.error as Error | undefined,
    isLoading: swr.isLoading,
    isValidating: swr.isValidating,
    hasAuthToken: Boolean(jwt),
    lastUpdatedAt,
    mutate: swr.mutate,
  };
}
