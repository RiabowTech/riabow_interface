/**
 * Position Adapter - Converts API Position format to SDK Position format
 * This allows gradual migration from useMulticall to REST API
 */

import { ethers } from "ethers";
import { getAddress } from "viem";
import type { Position as SdkPosition, PositionsData } from "sdk/types/positions";
import {
  DEFAULT_COLLATERAL_ADDRESS,
  getMarketAddressFromSymbol as getMarketAddressFromSymbolConfig,
  getSymbolFromMarketAddress as getSymbolFromMarketAddressConfig,
} from "config/custom/contracts";

import type { Position as ApiPosition } from "../types";

/**
 * Convert an API symbol to the synthetic market address used by the trading backend.
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
function parseDecimal(value: string, decimals: number): bigint {
  const parts = value.split(".");
  const wholePart = parts[0] || "0";
  let fractionalPart = parts[1] || "";

  // Pad or truncate fractional part to match decimals
  if (fractionalPart.length < decimals) {
    fractionalPart = fractionalPart.padEnd(decimals, "0");
  } else if (fractionalPart.length > decimals) {
    fractionalPart = fractionalPart.slice(0, decimals);
  }

  return BigInt(wholePart + fractionalPart);
}

/**
 * Generate position key in protocol format
 */
function generatePositionKey(
  account: string,
  marketAddress: string,
  collateralTokenAddress: string,
  isLong: boolean
): string {
  return `${account}:${marketAddress}:${collateralTokenAddress}:${isLong}`;
}

/**
 * Generate hashed contract position key
 * For API trading mode with synthetic addresses, use simple hashing instead of ABI encoding.
 */
function generateContractKey(
  account: string,
  marketAddress: string,
  collateralTokenAddress: string,
  isLong: boolean
): string {
  // For synthetic market addresses in API trading mode, use simple string hashing.
  if (marketAddress.startsWith("synth-")) {
    const keyString = `${account}:${marketAddress}:${collateralTokenAddress}:${isLong}`;
    return ethers.keccak256(ethers.toUtf8Bytes(keyString));
  }

  // For real contract addresses, use ABI encoding
  const normalizedAccount = getAddress(account);
  const normalizedMarketAddress = getAddress(marketAddress);
  const normalizedCollateralAddress = getAddress(collateralTokenAddress);

  const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
    ["address", "address", "address", "bool"],
    [normalizedAccount, normalizedMarketAddress, normalizedCollateralAddress, isLong]
  );
  return ethers.keccak256(encoded);
}

/**
 * Convert a single API Position to SDK Position format
 */
export function convertApiPositionToSdk(
  apiPosition: ApiPosition,
  chainId: number,
  account: string
): SdkPosition | null {
  // Use the synthetic market address format for API trading mode.
  // This matches the format used in SyntheticsStateContextProvider.tsx
  const marketAddress = getSyntheticMarketAddress(apiPosition.symbol);

  const collateralTokenAddress = DEFAULT_COLLATERAL_ADDRESS[chainId];
  if (!collateralTokenAddress) {
    console.warn(`No default collateral for chain ${chainId}`);
    return null;
  }

  // Normalize account address to checksum format for ethers encoding
  const normalizedAccount = getAddress(account);

  const isLong = apiPosition.side === "long";

  // Parse values - handle both old and new API formats
  const positionId = apiPosition.position_id || apiPosition.id || "";
  const sizeInUsd = parseDecimal(apiPosition.size, USD_DECIMALS);
  const entryPrice = parseDecimal(apiPosition.entry_price, PRICE_DECIMALS);
  const markPrice = parseDecimal(apiPosition.mark_price, PRICE_DECIMALS);

  // Calculate sizeInTokens: sizeInUsd / entryPrice
  const sizeInTokens = entryPrice > 0n ? (sizeInUsd * BigInt(10 ** 18)) / entryPrice : 0n;

  // Parse margin/collateral - new API uses "collateral_amount"
  const marginValue = apiPosition.collateral_amount || apiPosition.margin || "0";
  const collateralAmount = parseDecimal(marginValue, 6);

  // Parse PnL
  const pnl = parseDecimal(apiPosition.unrealized_pnl, USD_DECIMALS);

  // Parse liquidation price if available
  const liquidationPrice = apiPosition.liquidation_price
    ? parseDecimal(apiPosition.liquidation_price, PRICE_DECIMALS)
    : undefined;

  // Generate keys (use normalized account for contract key generation)
  const key = generatePositionKey(normalizedAccount, marketAddress, collateralTokenAddress, isLong);
  const contractKey = generateContractKey(normalizedAccount, marketAddress, collateralTokenAddress, isLong);

  // Convert timestamps
  const increasedAtTime = BigInt(apiPosition.created_at);
  const decreasedAtTime = BigInt(apiPosition.updated_at);

  return {
    key,
    contractKey,
    account: normalizedAccount,
    marketAddress,
    collateralTokenAddress,
    sizeInUsd,
    sizeInTokens,
    collateralAmount,
    pendingBorrowingFeesUsd: 0n,
    increasedAtTime,
    decreasedAtTime,
    isLong,
    fundingFeeAmount: 0n,
    claimableLongTokenAmount: 0n,
    claimableShortTokenAmount: 0n,
    pnl,
    positionFeeAmount: 0n,
    traderDiscountAmount: 0n,
    uiFeeAmount: 0n,
    pendingImpactAmount: 0n,
    data: "",
    // Store entry price from API for direct use
    entryPrice,
    // Store liquidation price from API for direct use
    liquidationPrice,
    // Store the original position ID for API trading mode.
    originalPositionId: positionId,
    // Store original size from API (string) for close position requests
    originalSize: apiPosition.size,
    // Store amount (token quantity) and symbol from API for display
    originalAmount: apiPosition.amount,
    originalSymbol: apiPosition.symbol,
    // Store backend leverage directly (convert integer to BASIS_POINTS: 50 -> 500000)
    originalLeverage: BigInt(apiPosition.leverage) * BigInt(10000),
  } as any;
}

/**
 * Convert API positions array to SDK PositionsData map
 */
export function convertApiPositionsToSdk(
  apiPositions: ApiPosition[],
  chainId: number,
  account: string
): PositionsData {
  const positionsData: PositionsData = {};

  for (const apiPosition of apiPositions) {
    const sdkPosition = convertApiPositionToSdk(apiPosition, chainId, account);
    if (sdkPosition) {
      positionsData[sdkPosition.key] = sdkPosition;
    }
  }

  return positionsData;
}

/**
 * Get market address from symbol
 * Re-export from config for backward compatibility
 */
export function getMarketAddressFromSymbol(chainId: number, symbol: string): string | undefined {
  return getMarketAddressFromSymbolConfig(chainId, symbol);
}

/**
 * Get symbol from market address
 * Re-export from config for backward compatibility
 */
export function getSymbolFromMarketAddress(chainId: number, marketAddress: string): string | undefined {
  return getSymbolFromMarketAddressConfig(chainId, marketAddress);
}
