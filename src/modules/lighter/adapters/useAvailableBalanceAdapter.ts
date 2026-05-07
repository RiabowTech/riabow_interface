import { useMemo } from "react";

import { useChainId } from "lib/chains";
import { usePrimitBalances } from "modules/lighter/api/hooks";

/**
 * 读取用户账户 Available to Trade(USD 值)。
 * 直接调 /account/balances — 与 preview 独立,不依赖订单表单输入。
 * 未连钱包 / 未认证时返回 null。
 */
export function useAvailableBalanceAdapter(): {
  available: number | null;
  loading: boolean;
} {
  const { chainId } = useChainId();
  const { data, isLoading } = usePrimitBalances(chainId);

  const available = useMemo(() => {
    const list = data?.balances;
    if (!list || !list.length) return null;
    // 优先取 USDT / USD 作为可用资金;否则累加所有 available
    const usd = list.find((b) => /USDT?$/i.test(b.symbol));
    if (usd?.available != null) {
      const n = Number(usd.available);
      return Number.isFinite(n) ? n : null;
    }
    const total = list.reduce((sum, b) => sum + (Number(b.available) || 0), 0);
    return Number.isFinite(total) ? total : null;
  }, [data]);

  return { available, loading: isLoading };
}
