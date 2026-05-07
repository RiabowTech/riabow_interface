import { useMemo } from "react";
import { useAccount } from "wagmi";

import { useApiOrders } from "@/modules/lighter/api";
import { useChainId } from "lib/chains";

import { formatExpiry, mapApiOrderToLighterOpenOrder, type LighterOpenOrder } from "./lighterOpenOrders";

export type { LighterOpenOrder } from "./lighterOpenOrders";

export function useOpenOrdersAdapter(): LighterOpenOrder[] {
  const { chainId } = useChainId();
  const { address } = useAccount();
  const { apiOrders } = useApiOrders(chainId, address);

  return useMemo(() => {
    const list = apiOrders;
    if (!list?.length) return [];

    return list
      .filter((order) => {
        const status = (order.status || "").toLowerCase();
        return status === "open" || status === "pending" || status === "partially_filled";
      })
      .map((order) => ({
        ...mapApiOrderToLighterOpenOrder(order),
        expiresIn: order.expires_at ? formatExpiry(order.expires_at) : null,
      }));
  }, [apiOrders]);
}
