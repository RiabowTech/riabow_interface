import type { Market, MarketInfo } from "./markets";
import type { TokenData } from "./tokens";

export type Position = {
  key: string;
  contractKey: string;
  account: string;
  marketAddress: string;
  collateralTokenAddress: string;
  sizeInUsd: bigint;
  sizeInTokens: bigint;
  collateralAmount: bigint;
  pendingBorrowingFeesUsd: bigint;
  /**
   * Entry price from API (if available)
   * For API positions, this should be used directly instead of calculating from sizeInUsd/sizeInTokens
   */
  entryPrice?: bigint;
  /**
   * Liquidation price from API (if available)
   * For API positions, this should be used directly instead of calculating
   */
  liquidationPrice?: bigint;
  increasedAtTime: bigint;
  decreasedAtTime: bigint;
  isLong: boolean;
  fundingFeeAmount: bigint;
  claimableLongTokenAmount: bigint;
  claimableShortTokenAmount: bigint;
  isOpening?: boolean;
  pnl: bigint;
  positionFeeAmount: bigint;
  traderDiscountAmount: bigint;
  uiFeeAmount: bigint;
  pendingImpactAmount: bigint;
  /**
   * Not implemented in parsing
   */
  borrowingFactor?: bigint;
  /**
   * Not implemented in parsing
   */
  fundingFeeAmountPerSize?: bigint;
  /**
   * Not implemented in parsing
   */
  longTokenClaimableFundingAmountPerSize?: bigint;
  /**
   * Not implemented in parsing
   */
  shortTokenClaimableFundingAmountPerSize?: bigint;
  data: string;
  originalPositionId?: string; // For API trading mode: store original API position ID
  originalLeverage?: bigint; // For API trading mode: store backend leverage directly (in BASIS_POINTS)
};

export type PositionInfo = Position & {
  marketInfo: MarketInfo | undefined;
  market: Market;
  indexToken: TokenData;
  longToken: TokenData;
  shortToken: TokenData;
  indexName: string;
  poolName: string;
  collateralToken: TokenData;
  pnlToken: TokenData;
  markPrice: bigint;
  entryPrice: bigint | undefined;
  liquidationPrice: bigint | undefined;
  collateralUsd: bigint;
  remainingCollateralUsd: bigint;
  remainingCollateralAmount: bigint;
  hasLowCollateral: boolean;
  pnl: bigint;
  pnlPercentage: bigint;
  pnlAfterFees: bigint;
  pnlAfterFeesPercentage: bigint;
  netPriceImapctDeltaUsd: bigint;
  priceImpactDiffUsd: bigint;
  pendingImpactUsd: bigint;
  closePriceImpactDeltaUsd: bigint;
  leverage: bigint | undefined;
  leverageWithPnl: bigint | undefined;
  leverageWithoutPnl: bigint | undefined;
  netValue: bigint;
  closingFeeUsd: bigint;
  uiFeeUsd: bigint;
  pendingFundingFeesUsd: bigint;
  pendingClaimableFundingFeesUsd: bigint;
};

export type PositionInfoLoaded = PositionInfo & { marketInfo: MarketInfo };

export type PositionsData = {
  [positionKey: string]: Position;
};

export type PositionsInfoData = {
  [positionKey: string]: PositionInfo;
};
