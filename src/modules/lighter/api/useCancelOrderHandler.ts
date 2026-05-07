import { t } from "@lingui/macro";
/**
 * Primit Cancel Order Handler Hook
 *
 * This hook provides a unified interface for cancelling orders,
 * with support for both API-based and on-chain cancellation.
 */

import { useCallback } from "react";
import { useAccount, useSignTypedData } from "wagmi";
import { getAddress } from "viem";
import { useSWRConfig } from "swr";

import { useSelector } from "@/modules/lighter/store/SyntheticsStateContext/utils";
import { selectExpressGlobalParams } from "@/modules/lighter/store/SyntheticsStateContext/selectors/expressSelectors";
import { selectSrcChainId, selectSubaccountForChainAction } from "@/modules/lighter/store/SyntheticsStateContext/selectors/globalSelectors";
import { estimateBatchExpressParams } from "domain/synthetics/express/expressOrderUtils";
import { sendBatchOrderTxn } from "domain/synthetics/orders/sendBatchOrderTxn";
import { useOrderTxnCallbacks } from "domain/synthetics/orders/useOrderTxnCallbacks";
import { isTwapOrder, OrderInfo } from "domain/synthetics/orders";
import { useChainId } from "lib/chains";
import { helperToast } from "lib/helperToast";
import { useJsonRpcProvider } from "lib/rpc";
import useWallet from "lib/wallets/useWallet";

import { cancelOrder, batchCancelOrders, isAuthenticated, getNonce, deletePositionTpSl, cancelTriggerOrder } from "./custom/client";
import { shouldUseApiOrderSubmit } from "./custom/usePrimitOrderSubmit";
import { useApiOrders } from "./custom/useApiOrders";

export interface UseCancelOrderHandlerResult {
  cancelSingleOrder: (order: OrderInfo, onStart?: () => void, onComplete?: () => void) => Promise<void>;
  cancelMultipleOrders: (orderKeys: string[], onStart?: () => void, onComplete?: () => void) => Promise<void>;
  isApiEnabled: boolean;
}

export function useCancelOrderHandler(): UseCancelOrderHandlerResult {
  const { chainId } = useChainId();
  const { signer } = useWallet();
  const { address } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();
  const { provider } = useJsonRpcProvider(chainId);
  const srcChainId = useSelector(selectSrcChainId);
  const globalExpressParams = useSelector(selectExpressGlobalParams);
  const subaccount = useSelector(selectSubaccountForChainAction);
  const { makeOrderTxnCallback } = useOrderTxnCallbacks();
  const { mutate } = useSWRConfig();

  const isApiEnabled = shouldUseApiOrderSubmit();

  // Get API orders for checking trigger types
  const { apiOrders } = useApiOrders(chainId, address);

  // Generate EIP-712 signature for cancel order
  const generateCancelSignature = useCallback(
    async (orderIds: string[]): Promise<{ signature: string; timestamp: number }> => {
      if (!address) {
        throw new Error("Wallet address required");
      }

      const timestamp = Math.floor(Date.now() / 1000);
      const checksumAddress = getAddress(address);

      // Get domain info from backend
      const nonceResponse = await getNonce(chainId, checksumAddress);
      if (!nonceResponse?.typed_data?.domain) {
        throw new Error("Backend did not return domain in nonce response");
      }

      const backendDomain = nonceResponse.typed_data.domain;

      // Build EIP-712 typed data structure matching the test implementation
      // For eth_signTypedData_v4, we need explicit EIP712Domain type
      const isBatch = orderIds.length > 1;

      const typedData = isBatch
        ? {
            types: {
              EIP712Domain: [
                { name: "name", type: "string" },
                { name: "version", type: "string" },
                { name: "chainId", type: "uint256" },
                { name: "verifyingContract", type: "address" },
              ],
              BatchCancelOrders: [
                { name: "wallet", type: "address" },
                { name: "orderIds", type: "string" },
                { name: "timestamp", type: "uint256" },
              ],
            },
            primaryType: "BatchCancelOrders",
            domain: {
              name: backendDomain.name,
              version: backendDomain.version,
              chainId: Number(backendDomain.chainId),
              verifyingContract: backendDomain.verifyingContract,
            },
            message: {
              wallet: checksumAddress,
              orderIds: orderIds.join(","),
              timestamp: timestamp,
            },
          }
        : {
            types: {
              EIP712Domain: [
                { name: "name", type: "string" },
                { name: "version", type: "string" },
                { name: "chainId", type: "uint256" },
                { name: "verifyingContract", type: "address" },
              ],
              CancelOrder: [
                { name: "wallet", type: "address" },
                { name: "orderId", type: "string" },
                { name: "timestamp", type: "uint256" },
              ],
            },
            primaryType: "CancelOrder",
            domain: {
              name: backendDomain.name,
              version: backendDomain.version,
              chainId: Number(backendDomain.chainId),
              verifyingContract: backendDomain.verifyingContract,
            },
            message: {
              wallet: checksumAddress,
              orderId: orderIds[0],
              timestamp: timestamp,
            },
          };


      // Sign EIP-712 typed data using wagmi
      const signature = await signTypedDataAsync({
        domain: typedData.domain as any,
        types: typedData.types as any,
        primaryType: typedData.primaryType as any,
        message: typedData.message as any,
      });

      if (!signature || !signature.startsWith("0x")) {
        throw new Error("Invalid signature format");
      }


      return { signature, timestamp };
    },
    [chainId, address, signTypedDataAsync]
  );

  // Cancel via Primit API
  const cancelViaApi = useCallback(
    async (orderKeys: string[]): Promise<void> => {
      if (!isAuthenticated(address, chainId)) {
        throw new Error("Authentication required");
      }

      const { signature, timestamp } = await generateCancelSignature(orderKeys);

      if (orderKeys.length === 1) {
        await cancelOrder(chainId, orderKeys[0], {
          signature,
          timestamp,
        });
      } else {
        await batchCancelOrders(chainId, {
          order_ids: orderKeys,
          signature,
          timestamp,
        });
      }
    },
    [chainId, address, generateCancelSignature]
  );

  // Cancel via on-chain transaction
  const cancelOnChain = useCallback(
    async (orderKeys: string[]): Promise<void> => {
      if (!signer || !provider) {
        const errorMsg = isApiEnabled ? " Wallet not connected" : "Wallet not connected";
        throw new Error(errorMsg);
      }

      const batchParams = {
        createOrderParams: [],
        updateOrderParams: [],
        cancelOrderParams: orderKeys.map((key) => ({ orderKey: key })),
      };

      const expressParams = await estimateBatchExpressParams({
        signer,
        chainId,
        batchParams,
        requireValidations: true,
        globalExpressParams,
        estimationMethod: "approximate",
        provider,
        isTradingAccount: srcChainId !== undefined,
        subaccount,
      });

      await sendBatchOrderTxn({
        chainId,
        signer,
        batchParams,
        expressParams,
        simulationParams: undefined,
        callback: makeOrderTxnCallback({}),
        provider,
        isTradingAccount: srcChainId !== undefined,
      });
    },
    [chainId, globalExpressParams, makeOrderTxnCallback, provider, signer, srcChainId, subaccount]
  );

  // Cancel a single order
  const cancelSingleOrder = useCallback(
    async (order: OrderInfo, onStart?: () => void, onComplete?: () => void): Promise<void> => {
      // For SDK keys (used for on-chain cancellation and UI state)
      const orderKeys = isTwapOrder(order) ? order.orders.map((o) => o.key) : [order.key];

      // For API cancellation, use original order IDs (use type assertion since OrderInfo may not have this field typed)
      const apiOrderIds = isTwapOrder(order)
        ? order.orders.map((o) => (o as any).originalOrderId).filter((id): id is string => !!id)
        : (order as any).originalOrderId ? [(order as any).originalOrderId] : [];

      onStart?.();

      try {
        // When API trading is enabled, require authentication.
        console.log("[cancelSingleOrder] Debug:", {
          isApiEnabled,
          isAuth: isAuthenticated(address, chainId),
          address: address ? `${address.substring(0, 8)}...` : null,
          chainId,
          orderKeys,
          apiOrderIds,
          originalOrderId: (order as any).originalOrderId,
        });

        if (isApiEnabled) {
          if (!isAuthenticated(address, chainId)) {
            helperToast.error(t`Please sign in to cancel orders`);
            throw new Error("Authentication required");
          }
          if (apiOrderIds.length === 0) {
            helperToast.error(t`Order ID not found for cancellation`);
            throw new Error("No valid order IDs for API cancellation");
          }

          // Check if this is a TP/SL order
          const originalApiOrder = apiOrders?.find((o) => o.id === apiOrderIds[0]);
          const orderType = originalApiOrder?.order_type;
          const isTpSlOrder = orderType === "take_profit" || orderType === "stop_market" ||
                             orderType === "take_profit_limit" || orderType === "stop_limit";


          if (isTpSlOrder) {
            // For TP/SL orders, prefer DELETE /positions/:position_id/tp-sl
            // (clears all TP/SL for that position). If no position_id available
            // (standalone trigger order), fall back to DELETE /trigger-orders/:id.
            const positionId = (originalApiOrder as any)?.position_id;

            if (positionId) {
              await deletePositionTpSl(chainId, positionId);
            } else {
              await cancelTriggerOrder(chainId, apiOrderIds[0], address);
            }
            helperToast.success(t`TP/SL cancelled successfully`);
          } else {
            // For regular orders, use the normal cancel API
            await cancelViaApi(apiOrderIds);
            helperToast.success(t`Order cancelled successfully`);
          }

          // Refresh orders list after successful cancellation
          if (address) {
            setTimeout(() => {
              mutate(["api-orders", chainId, address], undefined, { revalidate: true });
            }, 100);
          }
        } else {
          // For non-API routes, use on-chain cancellation.
          await cancelOnChain(orderKeys);
        }
      } catch (error) {
        console.error("[cancelSingleOrder] Error:", error);
        // Trigger order 已被 keeper 触发/执行，本地仍当它 active —— 强制刷新一次
        // 让 UI 把 stale open order 移出列表，用户下一次不会再踩同一个错。
        const msg = (error as Error)?.message || "";
        // 后端可能返回：already cancelled/triggered/executed/expired/failed、just fired、
        // 或旧版本的 "not cancellable"/"not found"。任何一类都说明本地状态 stale，需要刷新。
        if (address && /already|just\s*fired|not\s*cancellable|not\s*found/i.test(msg)) {
          mutate(["api-orders", chainId, address], undefined, { revalidate: true });
        }
        throw error;
      } finally {
        onComplete?.();
      }
    },
    [cancelOnChain, cancelViaApi, isApiEnabled, address, chainId, mutate, apiOrders]
  );

  // Cancel multiple orders
  const cancelMultipleOrders = useCallback(
    async (orderKeys: string[], onStart?: () => void, onComplete?: () => void): Promise<void> => {
      if (orderKeys.length === 0) return;

      onStart?.();

      try {
        // When API trading is enabled, require authentication.
        console.log("[cancelMultipleOrders] Debug:", {
          isApiEnabled,
          isAuth: isAuthenticated(address, chainId),
          address: address ? `${address.substring(0, 8)}...` : null,
          chainId,
          orderKeys,
        });

        if (isApiEnabled) {
          if (!isAuthenticated(address, chainId)) {
            helperToast.error("Please sign in to cancel orders");
            throw new Error("Authentication required");
          }

          // Separate TP/SL orders from regular orders
          const tpSlPositionIds = new Set<string>();
          const regularOrderIds: string[] = [];

          for (const orderId of orderKeys) {
            const originalApiOrder = apiOrders?.find((o) => o.id === orderId);
            const orderType = originalApiOrder?.order_type;
            const isTpSlOrder = orderType === "take_profit" || orderType === "stop_market" ||
                               orderType === "take_profit_limit" || orderType === "stop_limit";

            if (isTpSlOrder && (originalApiOrder as any)?.position_id) {
              // For TP/SL orders, collect position IDs (deduplicated)
              tpSlPositionIds.add((originalApiOrder as any).position_id);
            } else {
              // For regular orders, collect order IDs
              regularOrderIds.push(orderId);
            }
          }


          // Cancel TP/SL orders by position (one API call per position)
          for (const positionId of tpSlPositionIds) {
            await deletePositionTpSl(chainId, positionId);
          }

          // Cancel regular orders in batch
          if (regularOrderIds.length > 0) {
            await cancelViaApi(regularOrderIds);
          }

          // Show success message
          if (tpSlPositionIds.size > 0 && regularOrderIds.length > 0) {
            helperToast.success(t`All orders cancelled successfully`);
          } else if (tpSlPositionIds.size > 0) {
            helperToast.success("TP/SL cancelled successfully");
          } else {
            helperToast.success(t`Orders cancelled successfully`);
          }

          // Refresh orders list after successful batch cancellation
          if (address) {
            setTimeout(() => {
              mutate(["api-orders", chainId, address], undefined, { revalidate: true });
            }, 100);
          }
        } else {
          // For non-API routes, use on-chain cancellation.
          await cancelOnChain(orderKeys);
        }
      } catch (error) {
        console.error("[cancelMultipleOrders] Error:", error);
        const msg = (error as Error)?.message || "";
        // 后端可能返回：already cancelled/triggered/executed/expired/failed、just fired、
        // 或旧版本的 "not cancellable"/"not found"。任何一类都说明本地状态 stale，需要刷新。
        if (address && /already|just\s*fired|not\s*cancellable|not\s*found/i.test(msg)) {
          mutate(["api-orders", chainId, address], undefined, { revalidate: true });
        }
        throw error;
      } finally {
        onComplete?.();
      }
    },
    [cancelOnChain, cancelViaApi, isApiEnabled, address, chainId, mutate, apiOrders]
  );

  return {
    cancelSingleOrder,
    cancelMultipleOrders,
    isApiEnabled,
  };
}
