import { t } from "@lingui/macro";
/**
 * Primit Close Position Handler Hook
 *
 * This hook provides a unified interface for closing positions,
 * with support for both API-based and on-chain closure.
 *
 * Note: This is a simplified handler for direct position closure via API.
 * The PositionSeller component handles more complex scenarios with
 * custom amounts, trigger prices, etc.
 */

import { useCallback } from "react";
import { useAccount } from "wagmi";

import { useChainId } from "lib/chains";
import { helperToast } from "lib/helperToast";

// Use custom client with address-specific authentication
import { closePosition, isAuthenticated, CreateOrderResponse } from "./custom/client";
import { shouldUseApiOrderSubmit } from "./custom/usePrimitOrderSubmit";
import type { ClosePositionRequest } from "./types";

export interface UseClosePositionHandlerResult {
  closePositionViaApi: (
    positionId: string,
    request?: ClosePositionRequest
  ) => Promise<CreateOrderResponse>;
  isApiEnabled: boolean;
  isReady: boolean;
}

export function useClosePositionHandler(): UseClosePositionHandlerResult {
  const { chainId } = useChainId();
  const { address } = useAccount();
  const isApiEnabled = shouldUseApiOrderSubmit();
  // Use address-specific authentication check
  const isReady = isApiEnabled && isAuthenticated(address, chainId);

  const closePositionViaApi = useCallback(
    async (
      positionId: string,
      request?: ClosePositionRequest
    ): Promise<CreateOrderResponse> => {
      if (!isAuthenticated(address, chainId)) {
        helperToast.error(t`Please connect your wallet and sign in first`);
        throw new Error("Authentication required");
      }

      try {
        const response = await closePosition(chainId, positionId, request);
        helperToast.success(t`Position close order submitted`);
        return response;
      } catch (error: any) {
        const message = error?.message || "Failed to close position";
        helperToast.error(message);
        throw error;
      }
    },
    [chainId, address]
  );

  return {
    closePositionViaApi,
    isApiEnabled,
    isReady,
  };
}
