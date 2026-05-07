/**
 * Trade Adapter - Converts API Trade format to SDK TradeAction format
 * This allows gradual migration from GraphQL to REST API for trades
 *
 * For API trading mode, bypass the normal processRawTradeActions pipeline.
 * and create PositionTradeAction objects directly with mock market/token data.
 */

import { ethers } from "ethers";
import { zeroAddress, getAddress } from "viem";
import type { TradeAction as SubsquidTradeAction } from "sdk/types/subsquid";
import type { PositionTradeAction, TradeAction } from "sdk/types/tradeHistory";
import { TradeActionType } from "sdk/types/tradeHistory";
import type { MarketInfo } from "sdk/types/markets";
import type { TokenData } from "sdk/types/tokens";
import {
  MARKET_SYMBOL_TO_ADDRESS,
  DEFAULT_COLLATERAL_ADDRESS,
} from "config/custom/contracts";

import type { Trade as ApiTrade } from "../types";

// USD decimals (30 for protocol format)
const USD_DECIMALS = 30;
const PRICE_DECIMALS = 30;
// Internal precision for multiplication
const INTERNAL_DECIMALS = 18;

/**
 * Parse decimal string to bigint with specified decimals
 */
function parseDecimal(value: string | undefined, decimals: number): bigint {
  if (!value) return 0n;
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
 * Calculate USD value from amount and price
 * amount: token amount (e.g., "0.044" BTC)
 * price: price per token in USD (e.g., "90560.56")
 * Returns: USD value with USD_DECIMALS precision (30 decimals)
 */
function calculateUsdValue(amount: string | undefined, price: string | undefined): bigint {
  if (!amount || !price) return 0n;

  // Parse both with internal precision (18 decimals)
  const amountBigInt = parseDecimal(amount, INTERNAL_DECIMALS);
  const priceBigInt = parseDecimal(price, INTERNAL_DECIMALS);

  // Multiply: result has 36 decimals (18 + 18)
  const product = amountBigInt * priceBigInt;

  // Adjust to USD_DECIMALS (30): divide by 10^6 (36 - 30 = 6)
  const adjustmentFactor = 10n ** BigInt(INTERNAL_DECIMALS * 2 - USD_DECIMALS);

  return product / adjustmentFactor;
}

/**
 * Convert timestamp (string or number) to Unix timestamp in seconds
 * API returns timestamp in milliseconds, SDK expects seconds
 */
function parseTimestamp(timestamp: number | string): number {
  if (typeof timestamp === "string") {
    return Math.floor(new Date(timestamp).getTime() / 1000);
  }
  // API returns timestamp in milliseconds, convert to seconds
  // Check if timestamp is in milliseconds (> year 2100 in seconds would be > 4102444800)
  if (timestamp > 4102444800) {
    return Math.floor(timestamp / 1000);
  }
  return timestamp;
}

/**
 * Convert a single API Trade to Subsquid TradeAction format
 * 
 * Note: This creates a minimal TradeAction since API Trade has limited fields.
 * We assume it's a MarketIncrease order execution.
 */
export function convertApiTradeToSubsquidTradeAction(
  apiTrade: ApiTrade,
  chainId: number,
  account: string
): SubsquidTradeAction | null {
  const marketAddresses = MARKET_SYMBOL_TO_ADDRESS[chainId];
  if (!marketAddresses) {
    console.warn(`No market mapping for chain ${chainId}`);
    return null;
  }

  // Get symbol from trade or use default
  const symbol = apiTrade.symbol || "ETHUSDT";
  
  // Try direct lookup first (for ETHUSDT format)
  let marketAddress = marketAddresses[symbol];
  
  // If not found, try converting ETHUSDT -> ETH-USD format
  if (!marketAddress && symbol.endsWith("USDT")) {
    const convertedSymbol = symbol.replace("USDT", "-USD");
    marketAddress = marketAddresses[convertedSymbol];
  }
  
  if (!marketAddress) {
    console.warn(`Unknown market symbol: ${symbol}`);
    return null;
  }

  const collateralTokenAddress = DEFAULT_COLLATERAL_ADDRESS[chainId];
  if (!collateralTokenAddress) {
    console.warn(`No default collateral for chain ${chainId}`);
    return null;
  }

  const isLong = apiTrade.side === "buy";

  // Parse amounts and prices
  // sizeDeltaUsd = amount (in tokens) * price (in USD)
  const sizeDeltaUsd = calculateUsdValue(apiTrade.amount, apiTrade.price);
  const sizeDeltaInTokens = parseDecimal(apiTrade.amount, INTERNAL_DECIMALS);
  const executionPrice = parseDecimal(apiTrade.price, PRICE_DECIMALS);
  const acceptablePrice = executionPrice; // Use execution price as acceptable price
  
  // Generate order key from trade ID
  const orderKey = ethers.keccak256(ethers.toUtf8Bytes(apiTrade.id));
  
  // Parse timestamp
  const timestamp = parseTimestamp(apiTrade.timestamp);
  
  // Parse fees and PnL if available
  const positionFeeAmount = apiTrade.fee ? parseDecimal(apiTrade.fee, USD_DECIMALS) : 0n;
  const pnlUsd = apiTrade.realized_pnl ? parseDecimal(apiTrade.realized_pnl, USD_DECIMALS) : undefined;

  // Create a minimal TradeAction (OrderExecuted event for MarketIncrease)
  const tradeAction: SubsquidTradeAction = {
    id: apiTrade.id,
    eventName: TradeActionType.OrderExecuted,
    account,
    marketAddress,
    initialCollateralTokenAddress: collateralTokenAddress,
    swapPath: [],
    initialCollateralDeltaAmount: sizeDeltaUsd.toString(), // Approximate: use size as collateral
    sizeDeltaUsd: sizeDeltaUsd.toString(),
    sizeDeltaInTokens: sizeDeltaInTokens.toString(),
    triggerPrice: undefined,
    acceptablePrice: acceptablePrice.toString(),
    executionPrice: executionPrice.toString(),
    minOutputAmount: 0n.toString(),
    executionAmountOut: undefined,
    swapImpactUsd: undefined,
    collateralTotalCostAmount: undefined,
    priceImpactUsd: undefined,
    priceImpactDiffUsd: undefined,
    positionFeeAmount: positionFeeAmount.toString(),
    borrowingFeeAmount: undefined,
    fundingFeeAmount: undefined,
    liquidationFeeAmount: undefined,
    pnlUsd: pnlUsd?.toString(),
    basePnlUsd: undefined,
    collateralTokenPriceMax: undefined,
    collateralTokenPriceMin: undefined,
    indexTokenPriceMin: undefined,
    indexTokenPriceMax: undefined,
    orderType: 2, // OrderType.MarketIncrease = 2
    orderKey,
    isLong,
    shouldUnwrapNativeToken: false,
    twapGroupId: undefined,
    uiFeeReceiver: "", // Not available in API trade
    numberOfParts: undefined,
    totalImpactUsd: undefined,
    proportionalPendingImpactUsd: undefined,
    decreasePositionSwapType: undefined,
    reason: undefined,
    reasonBytes: undefined,
    timestamp,
    transaction: {
      blockNumber: 0,
      from: account,
      hash: apiTrade.id, // Use trade ID as transaction hash (approximation)
      id: apiTrade.id,
      timestamp,
      to: marketAddress,
      transactionIndex: 0,
    },
    srcChainId: undefined,
  };

  return tradeAction;
}

/**
 * Convert API trades array to Subsquid TradeAction array
 */
export function convertApiTradesToSubsquidTradeActions(
  apiTrades: ApiTrade[],
  chainId: number,
  account: string
): SubsquidTradeAction[] {
  const tradeActions: SubsquidTradeAction[] = [];

  for (const apiTrade of apiTrades) {
    const tradeAction = convertApiTradeToSubsquidTradeAction(apiTrade, chainId, account);
    if (tradeAction) {
      tradeActions.push(tradeAction);
    }
  }

  // Sort by timestamp descending (most recent first)
  return tradeActions.sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Create mock TokenData for API trading mode.
 * Used to satisfy type requirements when real token data is not available
 */
function createMockTokenData(symbol: string, address: string): TokenData {
  const isStable = symbol.includes("USD") || symbol === "USDT";
  const decimals = isStable ? 6 : 18;

  return {
    // Token base properties
    name: symbol,
    symbol: symbol,
    decimals: decimals,
    address: address,
    isNative: false,
    isShortable: !isStable,
    isStable: isStable,
    isSynthetic: true,
    visualMultiplier: 1,
    // TokenAsyncData properties
    prices: {
      minPrice: 1000000000000000000000000000000n, // 1 USD in 30 decimals
      maxPrice: 1000000000000000000000000000000n,
    },
  };
}

/**
 * Create mock market info for API trading mode.
 * Used to satisfy type requirements when real market data is not available
 * Note: Uses type assertion since not all MarketInfo fields are needed for rendering
 */
function createMockMarketInfo(
  symbol: string,
  marketAddress: string,
  indexToken: TokenData,
  collateralToken: TokenData
): MarketInfo {
  // Create minimal market info with only fields needed for trade history rendering
  // Using type assertion since full MarketInfo has many more required fields
  return {
    marketTokenAddress: marketAddress as `0x${string}`,
    indexTokenAddress: indexToken.address as `0x${string}`,
    longTokenAddress: collateralToken.address as `0x${string}`,
    shortTokenAddress: collateralToken.address as `0x${string}`,
    isSameCollaterals: true,
    isSpotOnly: false,
    name: symbol,
    data: "",
    isDisabled: false,
    longToken: collateralToken,
    shortToken: collateralToken,
    indexToken: indexToken,
    // Required numeric fields set to 0
    longInterestUsd: 0n,
    shortInterestUsd: 0n,
    longInterestInTokens: 0n,
    shortInterestInTokens: 0n,
    longPoolAmount: 0n,
    shortPoolAmount: 0n,
    maxLongPoolUsdForDeposit: 0n,
    maxShortPoolUsdForDeposit: 0n,
    maxLongPoolAmount: 0n,
    maxShortPoolAmount: 0n,
    poolValueMax: 0n,
    poolValueMin: 0n,
    reserveFactorLong: 0n,
    reserveFactorShort: 0n,
    openInterestReserveFactorLong: 0n,
    openInterestReserveFactorShort: 0n,
    maxOpenInterestLong: 0n,
    maxOpenInterestShort: 0n,
    totalBorrowingFees: 0n,
    positionImpactPoolAmount: 0n,
    minPositionImpactPoolAmount: 0n,
    positionImpactPoolDistributionRate: 0n,
    swapImpactPoolAmountLong: 0n,
    swapImpactPoolAmountShort: 0n,
    borrowingFactorLong: 0n,
    borrowingFactorShort: 0n,
    borrowingExponentFactorLong: 0n,
    borrowingExponentFactorShort: 0n,
    fundingFactor: 0n,
    fundingExponentFactor: 0n,
    fundingIncreaseFactorPerSecond: 0n,
    fundingDecreaseFactorPerSecond: 0n,
    thresholdForDecreaseFunding: 0n,
    thresholdForStableFunding: 0n,
    minFundingFactorPerSecond: 0n,
    maxFundingFactorPerSecond: 0n,
    maxPnlFactorForTradersLong: 0n,
    maxPnlFactorForTradersShort: 0n,
    minCollateralFactor: 0n,
    minCollateralFactorForLiquidation: 0n,
    minCollateralFactorForOpenInterestLong: 0n,
    minCollateralFactorForOpenInterestShort: 0n,
    claimableFundingAmountLong: 0n,
    claimableFundingAmountShort: 0n,
    positionFeeFactorForBalanceWasImproved: 0n,
    positionFeeFactorForBalanceWasNotImproved: 0n,
    positionImpactFactorPositive: 0n,
    positionImpactFactorNegative: 0n,
    maxPositionImpactFactorPositive: 0n,
    maxPositionImpactFactorNegative: 0n,
    maxPositionImpactFactorForLiquidations: 0n,
    maxLendableImpactFactor: 0n,
    maxLendableImpactFactorForWithdrawals: 0n,
    maxLendableImpactUsd: 0n,
    lentPositionImpactPoolAmount: 0n,
    positionImpactExponentFactor: 0n,
    swapFeeFactorForBalanceWasImproved: 0n,
    swapFeeFactorForBalanceWasNotImproved: 0n,
    atomicSwapFeeFactor: 0n,
    swapImpactFactorPositive: 0n,
    swapImpactFactorNegative: 0n,
    swapImpactExponentFactor: 0n,
    borrowingFactorPerSecondForLongs: 0n,
    borrowingFactorPerSecondForShorts: 0n,
    fundingFactorPerSecond: 0n,
    longsPayShorts: false,
    virtualPoolAmountForLongToken: 0n,
    virtualPoolAmountForShortToken: 0n,
    virtualInventoryForPositions: 0n,
    virtualMarketId: "",
    virtualLongTokenId: "",
    virtualShortTokenId: "",
  } as MarketInfo;
}

/**
 * Convert a single API Trade directly to PositionTradeAction format
 * This bypasses processRawTradeActions and creates complete TradeAction objects
 * with mock market and token data for API trading mode rendering.
 */
export function convertApiTradeToPositionTradeAction(
  apiTrade: ApiTrade,
  chainId: number,
  account: string
): PositionTradeAction | null {
  // Extract symbol info
  const symbol = apiTrade.symbol || "BTCUSDT";
  let baseAsset = symbol.toUpperCase();
  if (baseAsset.endsWith("USDT")) {
    baseAsset = baseAsset.slice(0, -4);
  }

  // Use synthetic market address format (like positions do)
  const marketAddress = `synth-${baseAsset}-USD`;
  const collateralAddress = DEFAULT_COLLATERAL_ADDRESS[chainId] || zeroAddress;

  // Create mock tokens with proper prices
  const priceValue = parseDecimal(apiTrade.price, PRICE_DECIMALS);
  const indexToken = createMockTokenData(baseAsset, marketAddress);
  indexToken.prices = {
    minPrice: priceValue,
    maxPrice: priceValue,
  };

  const collateralToken = createMockTokenData("USDT", collateralAddress);

  // Create mock market info
  const marketInfo = createMockMarketInfo(
    `${baseAsset}/USD`,
    marketAddress,
    indexToken,
    collateralToken
  );

  const isLong = apiTrade.side === "buy";
  const timestamp = parseTimestamp(apiTrade.timestamp);
  const sizeDeltaUsd = calculateUsdValue(apiTrade.amount, apiTrade.price);
  const sizeDeltaInTokens = parseDecimal(apiTrade.amount, INTERNAL_DECIMALS);
  const executionPrice = priceValue;
  const orderKey = ethers.keccak256(ethers.toUtf8Bytes(apiTrade.id));

  const tradeAction: PositionTradeAction = {
    type: "position",
    id: apiTrade.id,
    eventName: TradeActionType.OrderExecuted,
    account: getAddress(account),
    marketAddress: marketAddress as `0x${string}`,
    marketInfo,
    indexToken,
    swapPath: [],
    initialCollateralTokenAddress: collateralAddress as `0x${string}`,
    initialCollateralToken: collateralToken,
    targetCollateralToken: collateralToken,
    initialCollateralDeltaAmount: sizeDeltaUsd,
    sizeDeltaUsd,
    sizeDeltaInTokens,
    triggerPrice: undefined,
    acceptablePrice: executionPrice,
    executionPrice,
    minOutputAmount: 0n,
    collateralTokenPriceMax: undefined,
    collateralTokenPriceMin: undefined,
    indexTokenPriceMin: executionPrice,
    indexTokenPriceMax: executionPrice,
    orderType: 2, // MarketIncrease
    orderKey,
    isLong,
    pnlUsd: apiTrade.realized_pnl ? parseDecimal(apiTrade.realized_pnl, USD_DECIMALS) : undefined,
    basePnlUsd: undefined,
    priceImpactDiffUsd: undefined,
    priceImpactUsd: undefined,
    totalImpactUsd: undefined,
    positionFeeAmount: apiTrade.fee ? parseDecimal(apiTrade.fee, USD_DECIMALS) : undefined,
    borrowingFeeAmount: undefined,
    fundingFeeAmount: undefined,
    liquidationFeeAmount: undefined,
    reason: undefined,
    reasonBytes: undefined,
    // Transaction hash is what TradeHistoryRow uses for explorer link
    transaction: {
      hash: apiTrade.id, // Use trade ID as transaction hash (placeholder for explorer link)
    },
    timestamp,
    shouldUnwrapNativeToken: false,
    twapParams: undefined,
  };

  return tradeAction;
}

/**
 * Convert API trades array directly to TradeAction array
 * This bypasses processRawTradeActions for API trading mode.
 */
export function convertApiTradesToTradeActions(
  apiTrades: ApiTrade[],
  chainId: number,
  account: string
): TradeAction[] {
  const tradeActions: TradeAction[] = [];

  for (const apiTrade of apiTrades) {
    const tradeAction = convertApiTradeToPositionTradeAction(apiTrade, chainId, account);
    if (tradeAction) {
      tradeActions.push(tradeAction);
    }
  }

  // Sort by timestamp descending (most recent first)
  return tradeActions.sort((a, b) => b.timestamp - a.timestamp);
}
