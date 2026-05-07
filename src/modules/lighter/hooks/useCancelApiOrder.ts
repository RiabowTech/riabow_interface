import { t } from "@lingui/macro";
import { useCallback } from "react";
import { useSWRConfig } from "swr";
import { useAccount, useSignTypedData } from "wagmi";
import { getAddress } from "viem";

import { useChainId } from "lib/chains";
import { helperToast } from "lib/helperToast";

import { cancelOrder, cancelTriggerOrder, getNonce } from "../api/custom/client";
import type { Order } from "../api/types";

function isTriggerOrder(order: Pick<Order, "trigger_type">) {
  return Boolean(order.trigger_type);
}

export function useCancelApiOrder() {
  const { chainId } = useChainId();
  const { address } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();
  const { mutate } = useSWRConfig();

  const generateCancelSignature = useCallback(
    async (orderId: string) => {
      if (!chainId || !address) {
        throw new Error("Wallet address required");
      }

      const checksumAddress = getAddress(address);
      const timestamp = Math.floor(Date.now() / 1000);
      const nonceResponse = await getNonce(chainId, checksumAddress);
      const backendDomain = nonceResponse?.typed_data?.domain;

      if (!backendDomain) {
        throw new Error("Backend did not return signing domain");
      }

      const signature = await signTypedDataAsync({
        domain: {
          name: backendDomain.name,
          version: backendDomain.version,
          chainId: Number(backendDomain.chainId),
          verifyingContract: backendDomain.verifyingContract,
        } as any,
        types: {
          CancelOrder: [
            { name: "wallet", type: "address" },
            { name: "orderId", type: "string" },
            { name: "timestamp", type: "uint256" },
          ],
        } as any,
        primaryType: "CancelOrder" as any,
        message: {
          wallet: checksumAddress,
          orderId,
          timestamp,
        } as any,
      });

      return { signature, timestamp };
    },
    [address, chainId, signTypedDataAsync]
  );

  const cancel = useCallback(
    async (order: Pick<Order, "id" | "trigger_type">) => {
      if (!chainId) {
        throw new Error("Chain unavailable");
      }

      const orderId = String(order.id);

      if (isTriggerOrder(order)) {
        await cancelTriggerOrder(chainId, orderId, address);
      } else {
        const { signature, timestamp } = await generateCancelSignature(orderId);
        await cancelOrder(chainId, orderId, { signature, timestamp });
      }

      await Promise.all([
        mutate((key) => Array.isArray(key) && String(key[0]).includes("orders"), undefined, { revalidate: true }),
        mutate((key) => Array.isArray(key) && String(key[0]).includes("positions"), undefined, { revalidate: true }),
      ]);

      helperToast.success(t`Order canceled`);
    },
    [address, chainId, generateCancelSignature, mutate]
  );

  return { cancel };
}
