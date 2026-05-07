/**
 * Order Adapter - Converts API Order format to SDK Order format
 * This allows gradual migration from useMulticall to REST API for orders
 */

import { ethers } from "ethers";
import { getAddress } from "viem";
import {
  DecreasePositionSwapType,
  Order as SdkOrder,
  OrderType as SdkOrderType,
  OrdersData,
} from "sdk/types/orders";
import {
  DEFAULT_COLLATERAL_ADDRESS,
} from "config/custom/contracts";

import type { Order as ApiOrder, OrderType as ApiOrderType, OrderSide } from "../types";

/**
 * Convert an API symbol to a synthetic market address for API trading mode.
 * e.g., "BTCUSDT" -> "synth-BTC-USD"
 */
function getSyntheticMarketAddress(symbol: string): string {
  // Extract base asset from symbol (e.g., "BTCUSDT" -> "BTC", "ETHUSDT" -> "ETH")
  let baseAsset = symbol.toUpperCase();
  if (baseAsset.endsWith("USDT")) {
    baseAsset = baseAsset.slice(0, -4);
  } else if (baseAsset.endsWith("-USD")) {
    baseAsset = baseAsset.slice(0, -4);
  }
  return `synth-${baseAsset}-USD`;
}

// USD decimals (30 for protocol format)
const USD_DECIMALS = 30;
const PRICE_DECIMALS = 30;

/**
 * Parse decimal string to bigint with specified decimals
 */
function parseDecimal(value: string | undefined, decimals: number): bigint {
  if (!value) return 0n;
  const parts = value.split(".");
  const wholePart = parts[0] || "0";
  let fractionalPart = parts[1] || "";

  if (fractionalPart.length < decimals) {
    fractionalPart = fractionalPart.padEnd(decimals, "0");
  } else if (fractionalPart.length > decimals) {
    fractionalPart = fractionalPart.slice(0, decimals);
  }

  return BigInt(wholePart + fractionalPart);
}

/**
 * Map API order type to SDK order type
 */
function mapOrderType(apiType: ApiOrderType, side: OrderSide, reduceOnly: boolean): SdkOrderType {
  switch (apiType) {
    case "market":
      return reduceOnly ? SdkOrderType.MarketDecrease : SdkOrderType.MarketIncrease;
    case "limit":
      return reduceOnly ? SdkOrderType.LimitDecrease : SdkOrderType.LimitIncrease;
    case "stop_market":
      return side === "sell" ? SdkOrderType.StopLossDecrease : SdkOrderType.StopIncrease;
    case "stop_limit":
      return SdkOrderType.StopLossDecrease;
    case "take_profit":
      return SdkOrderType.LimitDecrease;
    case "take_profit_limit":
      return SdkOrderType.LimitDecrease;
    default:
      return SdkOrderType.MarketIncrease;
  }
}

/**
 * Generate order key from API order ID
 */
function generateOrderKey(orderId: string): string {
  // Use keccak256 hash of the order ID to generate a consistent key
  return ethers.keccak256(ethers.toUtf8Bytes(orderId));
}

/**
 * Convert a single API Order to SDK Order format
 */
export function convertApiOrderToSdk(
  apiOrder: ApiOrder,
  chainId: number,
  account: string
): SdkOrder | null {
  // Use the synthetic market address format for API trading mode.
  // This matches the format used in SyntheticsStateContextProvider.tsx
  const marketAddress = getSyntheticMarketAddress(apiOrder.symbol);

  const collateralTokenAddress = DEFAULT_COLLATERAL_ADDRESS[chainId];
  if (!collateralTokenAddress) {
    console.warn(`No default collateral for chain ${chainId}`);
    return null;
  }

  const isLong = apiOrder.side === "buy";
  const orderType = mapOrderType(apiOrder.order_type, apiOrder.side, apiOrder.reduce_only);

  // Parse values - API may return "amount" or "size" field
  const orderAmount = apiOrder.size || apiOrder.amount || "0";
  const sizeDeltaUsd = parseDecimal(orderAmount, USD_DECIMALS);
  const triggerPrice = parseDecimal(apiOrder.trigger_price, PRICE_DECIMALS);
  const acceptablePrice = parseDecimal(apiOrder.price, PRICE_DECIMALS);

  // Generate order key
  const key = generateOrderKey(apiOrder.id);

  // Parse timestamps - API returns ISO 8601 strings or Unix timestamps (numbers)
  const updatedAtTime = typeof apiOrder.updated_at === "string"
    ? BigInt(Math.floor(new Date(apiOrder.updated_at).getTime() / 1000))
    : BigInt(apiOrder.updated_at);
  const createdAtIndexTime = typeof apiOrder.created_at === "string"
    ? BigInt(Math.floor(new Date(apiOrder.created_at).getTime() / 1000))
    : BigInt(apiOrder.created_at);

  // Normalize account address to checksum format
  const normalizedAccount = getAddress(account);

  return {
    key,
    account: normalizedAccount,
    callbackContract: ethers.ZeroAddress,
    initialCollateralTokenAddress: collateralTokenAddress,
    marketAddress,
    decreasePositionSwapType: DecreasePositionSwapType.NoSwap,
    receiver: normalizedAccount,
    swapPath: [],
    contractAcceptablePrice: acceptablePrice,
    contractTriggerPrice: triggerPrice,
    callbackGasLimit: 0n,
    executionFee: 0n,
    initialCollateralDeltaAmount: 0n,
    minOutputAmount: 0n,
    sizeDeltaUsd,
    updatedAtTime,
    isFrozen: false,
    isLong,
    orderType,
    shouldUnwrapNativeToken: false,
    autoCancel: false,
    data: [],
    uiFeeReceiver: ethers.ZeroAddress,
    validFromTime: createdAtIndexTime,
    title: `${apiOrder.side.toUpperCase()} ${apiOrder.symbol}`,
    originalOrderId: apiOrder.id, // Store original order ID for API trading mode.
    originalStatus: apiOrder.status, // Store original order status for API trading filtering.
    originalOrderType: apiOrder.order_type, // Store original order type for API trading filtering.
  };
}

/**
 * Convert API orders array to SDK OrdersData map
 */
export function convertApiOrdersToSdk(
  apiOrders: ApiOrder[],
  chainId: number,
  account: string
): OrdersData {
  const ordersData: OrdersData = {};

  // When using API orders, show ALL orders regardless of status
  // This includes: open, pending, partially_filled, filled, cancelled, rejected, expired
  // The UI will handle displaying status appropriately
  for (const apiOrder of apiOrders) {
    const sdkOrder = convertApiOrderToSdk(apiOrder, chainId, account);
    if (sdkOrder) {
      ordersData[sdkOrder.key] = sdkOrder;
    }
  }

  return ordersData;
}

// getMarketAddressFromSymbol is exported from positionAdapter.ts
