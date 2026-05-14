import type { Address } from "viem";

/**
 * The `<MarketFilterLongShort>` component was a GMX-era table filter that
 * read from `selectPositionsInfoDataSortedByMarket`, `selectOrdersInfoData`,
 * and GMX market info. None of those data paths are live in this fork —
 * the Lighter UI does not mount it anywhere.
 *
 * The shape types remain because trade-history and order-history utilities
 * still type their `marketsDirectionsFilter` parameter as
 * `MarketFilterLongShortItemData[]`. Removing the component but keeping the
 * types is the smallest safe cut. A separate sweep can migrate those
 * consumers to `sdk/modules/trades/trades` (which already defines an
 * equivalent shape with a wider `direction` union including `"swap"`).
 */

export type MarketFilterLongShortDirection = "long" | "short" | "swap" | "any";

export type MarketFilterLongShortItemData = {
  marketAddress: Address | "any";
  direction: MarketFilterLongShortDirection;
  collateralAddress?: Address;
};
