import { t } from "@lingui/macro";
/**
 * Zanbara Order Submission Hook
 *
 * This hook provides a way to submit orders through the Zanbara backend API.
 * When enabled via feature flag, orders are sent to our backend first,
 * which then relays them to the blockchain.
 *
 * Benefits:
 * - Better error handling and validation
 * - Order tracking and history
 * - Rate limiting protection
 * - Additional business logic (referrals, rewards)
 */

import { useCallback } from "react";
import { useAccount, useSignTypedData } from "wagmi";
import { getAddress, formatUnits } from "viem";
import { useSWRConfig } from "swr";

import { useChainId } from "lib/chains";
import { helperToast } from "lib/helperToast";
import { getTradingVaultAddress } from "config/custom/contracts";
import { useApiOrders } from "./useApiOrders";

import {
  createOrder,
  cancelOrder,
  batchCancelOrders,
  closePosition,
  isAuthenticated,
  CreateOrderResponse,
  getNonce,
} from "./client";
import type {
  CreateOrderRequest,
  OrderSide,
  OrderType as ApiOrderType,
  BatchCancelRequest,
  BatchCancelResponse,
  ClosePositionRequest,
  TimeInForce,
  WorkingType,
  PositionModeSide,
} from "../types";

/**
 * Harden the EIP-712 domain against cross-chain / wrong-contract replay.
 *
 * The backend returns a `typed_data.domain` that the UI forwards into the
 * wallet for signing. If the backend (or an attacker in between) swaps the
 * `chainId` or `verifyingContract`, the user could sign a valid message for a
 * *different* chain or contract, letting the attacker replay it elsewhere.
 *
 * We pin both fields to frontend-controlled truth:
 *   - chainId           ← useChainId() (the currently connected wallet)
 *   - verifyingContract ← getTradingVaultAddress(chainId) (repo constant)
 * and refuse to sign if the backend's claim disagrees.
 */
function assertTrustedDomain(
  backendDomain: { chainId?: number | string; verifyingContract?: string } | undefined,
  chainId: number
): { chainId: number; verifyingContract: string } {
  const expectedContract = getTradingVaultAddress(chainId);
  if (!expectedContract) {
    throw new Error(`[order] No known verifyingContract for chainId ${chainId}`);
  }

  if (!backendDomain) {
    throw new Error("[order] Backend did not return a typed_data.domain");
  }

  const backendChainId =
    typeof backendDomain.chainId === "string" ? Number(backendDomain.chainId) : backendDomain.chainId;

  if (backendChainId !== chainId) {
    throw new Error(
      `[order] EIP-712 chainId mismatch — wallet=${chainId}, backend=${backendChainId}. Refusing to sign.`
    );
  }

  const backendContract = backendDomain.verifyingContract?.toLowerCase();
  const expectedLower = expectedContract.toLowerCase();
  if (backendContract !== expectedLower) {
    throw new Error(
      `[order] EIP-712 verifyingContract mismatch — expected=${expectedContract}, backend=${backendDomain.verifyingContract}. Refusing to sign.`
    );
  }

  return { chainId, verifyingContract: expectedContract };
}

/**
 * Lossless bigint → fixed-decimal string.
 *
 * Replaces the previous `(Number(bigint) / 10 ** decimals).toFixed(n)` pattern,
 * which silently truncates values above `Number.MAX_SAFE_INTEGER` (2^53 - 1 ≈
 * 9.007e15). Order sizes in wei (e.g. 10 ETH = 1e19) and prices at 1e30
 * precision both blow past that threshold and lose bits in the float cast.
 *
 * We truncate rather than round — for order amounts this is always safer
 * (never inflates the user's intent) and for prices the delta is below the
 * backend's accepted precision anyway.
 */
function formatFixedDecimal(value: bigint, decimals: number, fractionalDigits: number): string {
  const s = formatUnits(value, decimals); // e.g. "10.000000012345" — lossless
  const dot = s.indexOf(".");
  if (dot === -1) {
    return fractionalDigits > 0 ? `${s}.${"0".repeat(fractionalDigits)}` : s;
  }
  const intPart = s.slice(0, dot);
  const frac = s.slice(dot + 1);
  if (fractionalDigits === 0) return intPart;
  const padded = (frac + "0".repeat(fractionalDigits)).slice(0, fractionalDigits);
  return `${intPart}.${padded}`;
}

// Feature Flag for ZTDX API order submission
// Only return true for x10000 routes
export function shouldUseApiOrderSubmit(): boolean {
  if (typeof window === "undefined") return false;
  // Check whether the trading-page runtime is active via localStorage flag or pathname.
  const tradeModeFlag = localStorage.getItem("trade_mode");
  if (tradeModeFlag === "true") return true;
  // Also check pathname as a fallback
  if (window.location.pathname.startsWith("/trade")) return true;
  // For all other routes, return false to use on-chain submission
  return false;
}

// Convert protocol order type to Zanbara API order type
function mapOrderType(orderType: number, isIncrease: boolean, triggerPrice?: bigint): ApiOrderType {
  // Protocol order types:
  // 0 = MarketSwap
  // 1 = LimitSwap
  // 2 = MarketIncrease
  // 3 = LimitIncrease
  // 4 = MarketDecrease
  // 5 = LimitDecrease
  // 6 = StopLossDecrease
  // 7 = Liquidation
  // 8 = StopIncrease

  // For increase orders: if triggerPrice exists, it's a limit order (even if orderType is MarketIncrease)
  // This handles the case where user switches to limit tab but orderType hasn't updated yet
  if (isIncrease) {
    if (triggerPrice !== undefined && triggerPrice > 0n) {
      // Has triggerPrice means limit order
      return "limit";
    }
    // Check orderType as fallback
    if (orderType === 3) {
      // LimitIncrease
      return "limit";
    }
    // Default to market for increase orders
    return "market";
  }

  // For decrease orders
  if (orderType === 5) {
    // LimitDecrease - for decrease orders, limit is treated as take profit
    return "take_profit";
  }
  if (orderType === 6) {
    // StopLossDecrease
    return "stop_market";
  }

  // For other orders (MarketDecrease, etc.), return market
  return "market";
}

// Convert side (isLong) to API side
// API uses "buy"/"sell" for orders (matching actual backend implementation)
// Long positions = buy, Short positions = sell
function mapSide(isLong: boolean, isIncrease: boolean): "buy" | "sell" {
  // For both increase and decrease orders, side is based on position direction
  return isLong ? "buy" : "sell";
}

export interface ZanbaraOrderParams {
  symbol: string;
  isLong: boolean;
  isIncrease: boolean;
  sizeDeltaUsd: bigint; // Position size in tokens (bigint, will be converted to decimal string)
  indexTokenDecimals: number; // Index token decimals for formatting
  triggerPrice?: bigint;
  acceptablePrice?: bigint;
  orderType: number;
  apiOrderTypeOverride?: ApiOrderType;
  reduceOnly?: boolean;
  clientOrderId?: string;
  leverage?: number; // Leverage value (e.g., 50 for 50x)
  marginMode?: "cross" | "isolated";
  // --- 2026-04 新增可选字段(成交后后端自动创建条件平仓单)---
  tpPrice?: string; // 止盈触发价(decimal string,例 "80000.0")
  slPrice?: string; // 止损触发价(decimal string,例 "50000.0")
  maxSlippage?: string; // 最大滑点宽容度(例 "0.01" = 1%)
  stopPrice?: string; // 条件单触发价
  timeInForce?: TimeInForce;
  workingType?: WorkingType;
  positionSide?: PositionModeSide;
  closePosition?: boolean;
}

export interface UseZanbaraOrderSubmitResult {
  submitOrder: (params: ZanbaraOrderParams) => Promise<CreateOrderResponse>;
  cancelOrderById: (orderId: string) => Promise<{ success: boolean }>;
  batchCancel: (request: BatchCancelRequest) => Promise<BatchCancelResponse>;
  closePositionById: (positionId: string, request?: ClosePositionRequest) => Promise<CreateOrderResponse>;
  isApiEnabled: boolean;
  isReady: boolean;
}

export function useZanbaraOrderSubmit(): UseZanbaraOrderSubmitResult {
  const { chainId } = useChainId();
  const { address } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();
  const isApiEnabled = shouldUseApiOrderSubmit();
  const isReady = isApiEnabled && isAuthenticated(address, chainId);

  // Get mutate function to refresh orders list after creating/canceling orders
  const { mutate: refreshOrders } = useApiOrders(chainId, address);
  // Get global mutate to refresh both balance SWR keys after order operations
  const { mutate: globalMutate } = useSWRConfig();

  const refreshBalances = useCallback(() => {
    if (!address || !chainId) return;
    globalMutate([`zanbara-balances`, chainId, address], undefined, { revalidate: true });
    globalMutate([`zanbara-balances`, chainId, address], undefined, { revalidate: true });
  }, [globalMutate, address, chainId]);

  const submitOrder = useCallback(
    async (params: ZanbaraOrderParams): Promise<CreateOrderResponse> => {
      console.log(" submitOrder called", {
        isAuthenticated: isAuthenticated(address, chainId),
        address: address ? `${address.substring(0, 6)}...` : null,
        params: {
          symbol: params.symbol,
          isLong: params.isLong,
          leverage: params.leverage,
        },
      });

      if (!address) {
        helperToast.error(t`Please connect your wallet first`);
        throw new Error("Wallet address required");
      }

      // Show friendly message if not authenticated yet
      // Note: User can still proceed - signature will trigger authentication flow
      if (!isAuthenticated(address, chainId)) {
        helperToast.info(t`Signing transaction will also authenticate your account`);
      }

      const {
        symbol,
        isLong,
        isIncrease,
        sizeDeltaUsd,
        indexTokenDecimals,
        triggerPrice,
        acceptablePrice,
        orderType,
        reduceOnly,
        clientOrderId,
        leverage,
        marginMode,
      } = params;

      // Convert position size in tokens (bigint) to decimal string, lossless.
      // sizeDeltaUsd is position size in the token's smallest unit; dividing
      // via Number() silently truncates past 2^53. See formatFixedDecimal.
      const sizeStr = formatFixedDecimal(sizeDeltaUsd, indexTokenDecimals, 8);

      // Debug: Log order type mapping

      const apiOrderType = params.apiOrderTypeOverride ?? mapOrderType(orderType, isIncrease, triggerPrice);
      const side = mapSide(isLong, isIncrease);

      // Use leverage from params (already converted to integer in useTradeboxTransactions)
      // Backend expects integer (i32), so ensure it's an integer
      const leverageValue = leverage ? Math.round(leverage) : 1;

      const timestamp = Math.floor(Date.now() / 1000);

      // Build price string for signature
      // For limit orders, use triggerPrice (the limit price set by user)
      // For market orders, use "0" (as per backend specification)
      const usesLimitPrice =
        apiOrderType === "limit" || apiOrderType === "stop_limit" || apiOrderType === "take_profit_limit";

      let priceStr: string;
      if (usesLimitPrice) {
        // For limit orders, triggerPrice is the limit price (user-set limit price)
        if (triggerPrice !== undefined && triggerPrice > 0n) {
          // bigint at 1e30 precision → lossless decimal string.
          // Number(bigint) at this scale loses ~14 digits of precision.
          priceStr = formatFixedDecimal(triggerPrice, 30, 6);
        } else {
          // If no triggerPrice but it's a limit order, this is an error
          console.error(" Limit order requires triggerPrice");
          priceStr = "0"; // Fallback to "0", but this shouldn't happen
        }
      } else {
        // Market orders use "0" for price (as per backend specification)
        priceStr = "0";
      }

      // Convert symbol for API (use BTCUSDT format, matching backend)
      const apiSymbol = symbol.includes("-USD") ? symbol.replace("-USD", "USDT").toUpperCase() : symbol.toUpperCase();

      // Get typed_data structure from /auth/nonce endpoint
      // Backend returns the typed_data structure that should be used for signing
      const checksumAddress = getAddress(address);

      let nonceResponse;
      try {
        nonceResponse = await getNonce(chainId, checksumAddress);
      } catch (error: any) {
        console.error(" Failed to get nonce:", error);
        helperToast.error(` Failed to get nonce: ${error?.message || "Unknown error"}`);
        throw error;
      }

      if (!nonceResponse?.typed_data) {
        throw new Error(" Backend did not return typed_data in nonce response");
      }

      // Map order type to signature format: "limit" or "market" (lowercase, required)
      // Backend only accepts "limit" or "market" for orderType in signature
      // According to documentation, "take_profit" and "stop_market" should be mapped
      let signatureOrderType: string;
      if (usesLimitPrice) {
        signatureOrderType = "limit";
      } else {
        signatureOrderType = "market";
      }

      // Ensure side is lowercase (required by backend Display trait)
      const signatureSide = side.toLowerCase();

      // Use typed_data structure from backend, but modify for CreateOrder
      // Backend provides domain and types structure, we need to add CreateOrder type and modify message
      const backendTypedData = nonceResponse.typed_data;

      // Pin chainId + verifyingContract to frontend-controlled values to block
      // cross-chain / wrong-contract signature replay (see assertTrustedDomain).
      const trustedDomain = assertTrustedDomain(backendTypedData.domain, chainId);

      // Build CreateOrder typed_data based on backend's typed_data structure
      // Use the domain from backend (which has correct name like "Zanbara")
      // Add CreateOrder type definition
      // Use JSON parse/stringify to ensure no circular references and clean data structure
      // This prevents "Maximum call stack size exceeded" errors in wallet extensions
      const typedDataRaw = {
        types: {
          ...backendTypedData.types, // Keep existing types (EIP712Domain, Login, etc.)
          CreateOrder: [
            { name: "wallet", type: "address" },
            { name: "symbol", type: "string" },
            { name: "side", type: "string" },
            { name: "orderType", type: "string" }, // camelCase, lowercase: "limit" or "market"
            { name: "price", type: "string" },
            { name: "amount", type: "string" },
            { name: "leverage", type: "uint32" }, // uint32, not uint256
            { name: "timestamp", type: "uint256" }, // uint256, seconds (number, not string)
          ],
        },
        primaryType: "CreateOrder", // Use CreateOrder instead of Login
        domain: {
          name: backendTypedData.domain.name,
          version: backendTypedData.domain.version,
          chainId: trustedDomain.chainId,
          verifyingContract: trustedDomain.verifyingContract,
        },
        message: {
          wallet: checksumAddress, // Use checksum address
          symbol: apiSymbol,
          side: signatureSide, // "buy" or "sell" (lowercase, required by backend Display trait)
          orderType: signatureOrderType.toLowerCase(), // "market" or "limit" (lowercase, required by backend Display trait)
          price: priceStr, // "0" for market orders, or price string for limit orders
          amount: sizeStr,
          leverage: leverageValue, // number (uint32), not string
          timestamp: timestamp, // uint256 (number, seconds), NOT string - backend expects number
        },
      };

      // Deep copy to avoid circular references
      const typedData = JSON.parse(JSON.stringify(typedDataRaw));

      // Sign EIP-712 typed data - this will trigger wallet popup
      let signature: string;
      try {
        // Use wagmi's signTypedDataAsync which works with all wallet types
        // and correctly routes to the connected account (unlike window.ethereum.request
        // which requires the address to match MetaMask's currently selected account)
        signature = await signTypedDataAsync({
          domain: typedData.domain as any,
          types: typedData.types as any,
          primaryType: typedData.primaryType as any,
          message: typedData.message as any,
        });

        // Ensure signature has 0x prefix
        if (!signature || typeof signature !== "string" || !signature.startsWith("0x")) {
          throw new Error(" Invalid signature format received from wallet");
        }
      } catch (error: any) {
        console.error(" EIP-712 signature failed:", error);
        const errorMessage = error?.message || "Failed to sign order";
        // Don't show toast if user rejected, just log it
        if (
          errorMessage.includes("rejected") ||
          errorMessage.includes("denied") ||
          errorMessage.includes("User rejected")
        ) {
          // Don't show error toast for user rejection
        } else {
          helperToast.error(` Signature failed: ${errorMessage}`);
        }
        throw error;
      }

      const request: CreateOrderRequest = {
        symbol: apiSymbol,
        side,
        order_type: apiOrderType,
        amount: sizeStr,
        leverage: leverageValue,
        margin_mode: marginMode ?? "cross",
        signature,
        timestamp,
      };

      // Add price for limit orders and take profit orders
      if (apiOrderType === "limit" && priceStr !== "market") {
        request.price = priceStr;
      }

      if ((apiOrderType === "stop_limit" || apiOrderType === "take_profit_limit") && priceStr !== "0") {
        request.price = priceStr;
      }

      // 2026-04 扩展可选字段
      if (params.reduceOnly) request.reduce_only = true;
      if (params.tpPrice) request.tp_price = params.tpPrice;
      if (params.slPrice) request.sl_price = params.slPrice;
      if (params.maxSlippage) request.max_slippage = params.maxSlippage;
      if (params.stopPrice) request.trigger_price = params.stopPrice;
      if (params.timeInForce) request.time_in_force = params.timeInForce;
      if (params.workingType) request.working_type = params.workingType;
      if (params.positionSide) request.position_side = params.positionSide;
      if (params.closePosition != null) request.close_position = params.closePosition;
      if (params.clientOrderId) request.client_order_id = params.clientOrderId;

      // Trigger order types (stop_market, stop_limit, take_profit, take_profit_limit)
      // must go to POST /trigger-orders, not POST /orders.
      const triggerTypeMap: Record<string, string> = {
        stop_market: "StopLoss",
        stop_limit: "StopLimit",
        take_profit: "TakeProfit",
        take_profit_limit: "TakeProfitLimit",
      };
      const isTriggerType = apiOrderType in triggerTypeMap;

      try {
        if (isTriggerType) {
          // Build trigger order request (different schema from regular orders)
          const triggerSizeUsd = parseFloat(sizeStr) * (parseFloat(params.stopPrice || "0") || 0);
          // /trigger-orders 的 side 要求首字母大写(Buy / Sell),跟 /orders 的小写不同。
          const triggerSide = side ? side.charAt(0).toUpperCase() + side.slice(1).toLowerCase() : side;
          const triggerRequest = {
            market_symbol: apiSymbol,
            trigger_type: triggerTypeMap[apiOrderType] as any,
            side: triggerSide as any,
            size: String(triggerSizeUsd > 0 ? triggerSizeUsd : 0),
            trigger_price: params.stopPrice || "0",
            limit_price: usesLimitPrice && priceStr !== "0" ? priceStr : undefined,
            reduce_only: params.reduceOnly || false,
            close_position: params.closePosition || false,
          };

          const { createTriggerOrder } = await import("./client");
          const triggerResponse = await createTriggerOrder(chainId, triggerRequest, address);
          helperToast.success(`Trigger order created: ${triggerResponse.id}`);
          refreshOrders();
          refreshBalances();

          // Return compatible shape for callers expecting CreateOrderResponse
          return {
            order_id: triggerResponse.id,
            status: "open" as any,
            filled_amount: "0",
            remaining_amount: sizeStr,
            average_price: "0",
            created_at: Date.now(),
          } as CreateOrderResponse;
        }

        // Regular orders go to POST /orders
        const response = await createOrder(chainId, request, address);
        helperToast.success(`Order submitted: ${response.order_id}`);

        // Refresh orders list after successful order creation
        refreshOrders();
        refreshBalances();

        return response;
      } catch (error: any) {
        const message = error?.message || "Failed to submit order";
        helperToast.error(message);
        throw error;
      }
    },
    [chainId, address, refreshOrders, refreshBalances, signTypedDataAsync]
  );

  const cancelOrderById = useCallback(
    async (orderId: string): Promise<{ success: boolean }> => {
      if (!isAuthenticated(address, chainId)) {
        throw new Error(" Authentication required");
      }

      if (!address) {
        throw new Error(" Wallet address required");
      }

      try {
        const timestamp = Math.floor(Date.now() / 1000);
        const checksumAddress = getAddress(address);

        // Get typed_data structure from backend
        const nonceResponse = await getNonce(chainId, checksumAddress);
        if (!nonceResponse?.typed_data) {
          throw new Error(" Backend did not return typed_data in nonce response");
        }

        const backendTypedData = nonceResponse.typed_data;
        const trustedDomain = assertTrustedDomain(backendTypedData.domain, chainId);

        // Build CancelOrder typed_data
        const typedDataRaw = {
          types: {
            ...backendTypedData.types,
            CancelOrder: [
              { name: "wallet", type: "address" },
              { name: "orderId", type: "string" },
              { name: "timestamp", type: "uint256" },
            ],
          },
          primaryType: "CancelOrder",
          domain: {
            name: backendTypedData.domain.name,
            version: backendTypedData.domain.version,
            chainId: trustedDomain.chainId,
            verifyingContract: trustedDomain.verifyingContract,
          },
          message: {
            wallet: checksumAddress,
            orderId: orderId,
            timestamp: timestamp,
          },
        };

        const typedData = JSON.parse(JSON.stringify(typedDataRaw));

        // Sign EIP-712 typed data using wagmi
        const signature = await signTypedDataAsync({
          domain: typedData.domain as any,
          types: typedData.types as any,
          primaryType: typedData.primaryType as any,
          message: typedData.message as any,
        });

        if (!signature || !signature.startsWith("0x")) {
          throw new Error(" Invalid signature format");
        }

        await cancelOrder(chainId, orderId, {
          signature,
          timestamp,
        });
        helperToast.success(t`Order cancelled`);

        // Refresh orders list after successful order cancellation
        refreshOrders();
        refreshBalances();

        return { success: true };
      } catch (error: any) {
        const message = error?.message || "Failed to cancel order";
        if (!message.includes("rejected") && !message.includes("denied")) {
          helperToast.error(message);
        }
        throw error;
      }
    },
    [chainId, address, refreshOrders, refreshBalances, signTypedDataAsync]
  );

  const batchCancel = useCallback(
    async (request: BatchCancelRequest): Promise<BatchCancelResponse> => {
      if (!isAuthenticated(address, chainId)) {
        throw new Error(" Authentication required");
      }

      if (!address) {
        throw new Error(" Wallet address required");
      }

      try {
        const timestamp = Math.floor(Date.now() / 1000);
        const checksumAddress = getAddress(address);

        // Get typed_data structure from backend
        const nonceResponse = await getNonce(chainId, checksumAddress);
        if (!nonceResponse?.typed_data) {
          throw new Error(" Backend did not return typed_data in nonce response");
        }

        const backendTypedData = nonceResponse.typed_data;
        const trustedDomain = assertTrustedDomain(backendTypedData.domain, chainId);

        // Build BatchCancelOrders typed_data
        const typedDataRaw = {
          types: {
            ...backendTypedData.types,
            BatchCancelOrders: [
              { name: "wallet", type: "address" },
              { name: "orderIds", type: "string" },
              { name: "timestamp", type: "uint256" },
            ],
          },
          primaryType: "BatchCancelOrders",
          domain: {
            name: backendTypedData.domain.name,
            version: backendTypedData.domain.version,
            chainId: trustedDomain.chainId,
            verifyingContract: trustedDomain.verifyingContract,
          },
          message: {
            wallet: checksumAddress,
            orderIds: request.order_ids.join(","),
            timestamp: timestamp,
          },
        };

        const typedData = JSON.parse(JSON.stringify(typedDataRaw));

        // Sign EIP-712 typed data using wagmi
        const signature = await signTypedDataAsync({
          domain: typedData.domain as any,
          types: typedData.types as any,
          primaryType: typedData.primaryType as any,
          message: typedData.message as any,
        });

        if (!signature || !signature.startsWith("0x")) {
          throw new Error(" Invalid signature format");
        }

        const response = await batchCancelOrders(chainId, {
          order_ids: request.order_ids,
          signature,
          timestamp,
        });
        const cancelledCount = response.cancelled.length;
        const failedCount = response.failed.length;

        if (failedCount > 0) {
          helperToast.info(` Cancelled ${cancelledCount} orders, ${failedCount} failed`);
        } else {
          helperToast.success(` Cancelled ${cancelledCount} orders`);
        }

        // Refresh orders list after successful batch cancellation
        refreshOrders();
        refreshBalances();

        return response;
      } catch (error: any) {
        const message = error?.message || "Failed to cancel orders";
        if (!message.includes("rejected") && !message.includes("denied")) {
          helperToast.error(message);
        }
        throw error;
      }
    },
    [chainId, address, refreshOrders, refreshBalances, signTypedDataAsync]
  );

  const closePositionById = useCallback(
    async (positionId: string, request?: ClosePositionRequest): Promise<CreateOrderResponse> => {
      if (!isAuthenticated(address, chainId)) {
        throw new Error(" Authentication required");
      }

      try {
        const response = await closePosition(chainId, positionId, request);
        helperToast.success(t`Position close order submitted`);

        // Refresh orders list after successful position close order
        refreshOrders();
        refreshBalances();

        return response;
      } catch (error: any) {
        const message = error?.message || "Failed to close position";
        helperToast.error(message);
        throw error;
      }
    },
    [chainId, address, refreshOrders, refreshBalances]
  );

  return {
    submitOrder,
    cancelOrderById,
    batchCancel,
    closePositionById,
    isApiEnabled,
    isReady,
  };
}
