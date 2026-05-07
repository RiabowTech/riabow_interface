import { useMemo } from "react";

import { useChainId } from "lib/chains";
import { usePrimitBalances } from "modules/lighter/api/hooks";

export type LighterAssetRow = {
  asset: string;
  scope: string;
  totalBalance: number | null;
  availableBalance: number | null;
  pnl: number | null;
  usdcValue: number | null;
};

function toNumber(value: string | number | null | undefined) {
  if (value == null) return null;
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export function useAssetsAdapter(): LighterAssetRow[] {
  const { chainId } = useChainId();
  const { data } = usePrimitBalances(chainId);

  return useMemo(() => {
    const balances = data?.balances ?? [];
    if (balances.length === 0) return [];

    return balances.map((balance) => {
      const total = toNumber(balance.total);
      const available = toNumber(balance.available);

      return {
        asset: balance.symbol || balance.token || "--",
        scope: "Perps",
        totalBalance: total,
        availableBalance: available,
        pnl: null,
        usdcValue: total,
      };
    });
  }, [data?.balances]);
}
