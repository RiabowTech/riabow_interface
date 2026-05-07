import { gql } from "@apollo/client";
import merge from "lodash/merge";
import { useMemo } from "react";
import { SWRConfiguration } from "swr";
import useInfiniteSwr, { SWRInfiniteResponse } from "swr/infinite";
import type { Address } from "viem";

import { useSettings } from "@/modules/lighter/context/SettingsContext";
import { useMarketsInfoData, useTokensData } from "@/modules/lighter/store/SyntheticsStateContext/hooks/globalsHooks";
import { OrderType } from "domain/synthetics/orders";
import { definedOrThrow } from "lib/guards";
import { getSubsquidGraphClient } from "lib/indexers";
import { EMPTY_ARRAY } from "lib/objects";
import { TradeAction as SubsquidTradeAction } from "sdk/types/subsquid";
import { TradeAction, TradeActionType } from "sdk/types/tradeHistory";
import { GraphQlFilters, buildFiltersBody } from "sdk/utils/indexers";

import { MarketFilterLongShortItemData } from "components/TableMarketFilter/MarketFilterLongShort";

// Backend API layer - feature-flag controlled data sources.
import { shouldUseApiTrades, useAccountTrades, convertApiTradesToTradeActions } from "@/modules/lighter/api";

import { processRawTradeActions } from "./processTradeActions";

export type TradeHistoryResult = {
  tradeActions?: TradeAction[];
  isLoading: boolean;
  pageIndex: number;
  setPageIndex: (...args: Parameters<SWRInfiniteResponse["setSize"]>) => void;
};

export function useTradeHistory(
  chainId: number,
  p: {
    account: string | null | undefined;
    forAllAccounts?: boolean;
    pageSize: number;
    fromTxTimestamp?: number;
    toTxTimestamp?: number;
    marketsDirectionsFilter?: MarketFilterLongShortItemData[];
    refreshInterval?: number;
    orderEventCombinations?: {
      eventName?: TradeActionType;
      orderType?: OrderType[];
      isDepositOrWithdraw?: boolean;
      isTwap?: boolean;
    }[];
  }
): TradeHistoryResult {
  const {
    pageSize,
    account,
    forAllAccounts,
    fromTxTimestamp,
    toTxTimestamp,
    marketsDirectionsFilter,
    orderEventCombinations,
    refreshInterval,
  } = p;
  const marketsInfoData = useMarketsInfoData();
  const tokensData = useTokensData();
  const { showDebugValues } = useSettings();

  // Feature flag: switch between backend API data and GraphQL data.
  const useApiDataSource = shouldUseApiTrades();

  // Backend API data source.
  const apiTradesResult = useAccountTrades(chainId, account);

  // GraphQL data source (legacy implementation).
  const client = getSubsquidGraphClient(chainId);

  const getKey = (index: number) => {
    if (chainId && client && (account || forAllAccounts) && !useApiDataSource) {
      return [
        chainId,
        "useTradeHistory",
        account,
        forAllAccounts,
        fromTxTimestamp,
        toTxTimestamp,
        orderEventCombinations,
        marketsDirectionsFilter,
        index,
        pageSize,
      ] as const;
    }
    return null;
  };

  const swrParams: SWRConfiguration = {};
  // SWR resets global options if pass undefined explicitly
  if (refreshInterval) {
    swrParams.refreshInterval = refreshInterval;
  }

  const {
    data,
    error,
    size: pageIndex,
    setSize: setPageIndex,
  } = useInfiniteSwr(getKey, {
    fetcher: async (key) => {
      const pageIndex = key.at(-2) as number;

      const actions = await fetchRawTradeActions({
        chainId,
        pageIndex,
        pageSize,
        marketsDirectionsFilter,
        forAllAccounts,
        account,
        fromTxTimestamp,
        toTxTimestamp,
        orderEventCombinations,
        showDebugValues,
      });

      return actions;
    },
    ...swrParams,
  });

  // For the API data source, convert directly to TradeAction format.
  const apiTradeActionsConverted = useMemo(() => {
    if (!useApiDataSource || !apiTradesResult.trades || !account || !chainId) {
      return undefined;
    }
    // Use direct conversion that creates complete TradeAction objects with mock market/token data
    return convertApiTradesToTradeActions(apiTradesResult.trades, chainId, account);
  }, [useApiDataSource, apiTradesResult.trades, account, chainId]);

  // For the GraphQL data source, keep the raw SubsquidTradeAction format.
  const rawTradeActions = !useApiDataSource ? data?.flat().filter(Boolean) as SubsquidTradeAction[] | undefined : undefined;

  const hasPopulatedData = useApiDataSource
    ? apiTradesResult.trades !== undefined
    : data !== undefined && data.every((p) => p !== undefined);
  const isLoading = useApiDataSource
    ? apiTradesResult.isLoading
    : (!error && !hasPopulatedData) || !marketsInfoData || !tokensData;

  // For the API data source, use directly converted TradeActions.
  // For the GraphQL data source, run the legacy transformer.
  const tradeActions = useMemo(() => {
    if (useApiDataSource) {
      // API trades are already converted to TradeAction format
      return apiTradeActionsConverted;
    }

    // GraphQL path: process raw SubsquidTradeAction through transformer
    if (!rawTradeActions) {
      return undefined;
    }

    return processRawTradeActions({
      chainId,
      rawActions: rawTradeActions,
      marketsInfoData,
      tokensData,
      marketsDirectionsFilter: marketsDirectionsFilter || EMPTY_ARRAY,
    });
  }, [useApiDataSource, apiTradeActionsConverted, rawTradeActions, marketsInfoData, tokensData, marketsDirectionsFilter, chainId]);

  return {
    tradeActions,
    isLoading,
    pageIndex,
    setPageIndex,
  };
}

export async function fetchRawTradeActions({
  chainId,
  pageIndex,
  pageSize,
  marketsDirectionsFilter = EMPTY_ARRAY,
  forAllAccounts,
  account,
  fromTxTimestamp,
  toTxTimestamp,
  orderEventCombinations,
  showDebugValues,
}: {
  chainId: number;
  pageIndex: number;
  pageSize: number;
  marketsDirectionsFilter: MarketFilterLongShortItemData[] | undefined;
  forAllAccounts: boolean | undefined;
  account: string | null | undefined;
  fromTxTimestamp: number | undefined;
  toTxTimestamp: number | undefined;
  orderEventCombinations:
    | {
        eventName?: TradeActionType | undefined;
        orderType?: OrderType[] | undefined;
        isDepositOrWithdraw?: boolean | undefined;
        isTwap?: boolean | undefined;
      }[]
    | undefined;
  showDebugValues?: boolean;
}): Promise<SubsquidTradeAction[] | undefined> {
  const client = getSubsquidGraphClient(chainId);
  definedOrThrow(client);

  const offset = pageIndex * pageSize;
  const limit = pageSize;

  const nonSwapRelevantDefinedFilters: MarketFilterLongShortItemData[] = marketsDirectionsFilter
    .filter((filter) => filter.direction !== "swap" && filter.marketAddress !== "any")
    .map((filter) => ({
      marketAddress: filter.marketAddress as Address,
      direction: filter.direction,
      collateralAddress: filter.collateralAddress as Address,
    }));

  const hasNonSwapRelevantDefinedMarkets = nonSwapRelevantDefinedFilters.length > 0;

  const pureDirectionFilters = marketsDirectionsFilter
    .filter((filter) => filter.direction !== "any" && filter.marketAddress === "any")
    .map((filter) => ({
      marketAddress: filter.marketAddress.toLowerCase() as "any",
      direction: filter.direction,
    }));
  const hasPureDirectionFilters = pureDirectionFilters.length > 0;

  const swapRelevantDefinedMarkets = marketsDirectionsFilter
    .filter((filter) => (filter.direction === "any" || filter.direction === "swap") && filter.marketAddress !== "any")
    .map((filter) => filter.marketAddress as Address | "any");

  const hasSwapRelevantDefinedMarkets = swapRelevantDefinedMarkets.length > 0;

  const mergedCombinations = orderEventCombinations?.flatMap((combination) =>
    (combination.orderType || []).map((orderType) => ({ ...combination, orderType }))
  );

  const filtersStr = buildFiltersBody({
    AND: [
      {
        account_eq: forAllAccounts ? undefined : account,
        timestamp_gte: fromTxTimestamp,
        timestamp_lte: toTxTimestamp,
      },
      {
        OR: !hasPureDirectionFilters
          ? undefined
          : pureDirectionFilters.map((filter) =>
              filter.direction === "swap"
                ? {
                    orderType_in: [OrderType.LimitSwap, OrderType.MarketSwap],
                  }
                : {
                    isLong_eq: filter.direction === "long",
                    orderType_not_in: [OrderType.LimitSwap, OrderType.MarketSwap],
                  }
            ),
      },
      {
        OR: [
          // For non-swap orders
          {
            AND: !hasNonSwapRelevantDefinedMarkets
              ? undefined
              : [
                  {
                    orderType_not_in: [OrderType.LimitSwap, OrderType.MarketSwap],
                  },
                  {
                    OR: nonSwapRelevantDefinedFilters.map((filter) => ({
                      marketAddress_eq: filter.marketAddress === "any" ? undefined : filter.marketAddress,
                      isLong_eq: filter.direction === "any" ? undefined : filter.direction === "long",
                      // Collateral filtering is done outside of graphql on the client
                    })),
                  },
                ],
          },
          // For defined markets on swap orders
          {
            AND: !hasSwapRelevantDefinedMarkets
              ? undefined
              : [
                  {
                    orderType_in: [OrderType.LimitSwap, OrderType.MarketSwap],
                  },
                  {
                    OR: [
                      // Source token is not in swap path so we add it to the or filter
                      {
                        marketAddress_in: swapRelevantDefinedMarkets,
                      } as GraphQlFilters,
                    ].concat(
                      swapRelevantDefinedMarkets.map((marketAddress) => ({
                        swapPath_containsAll: [marketAddress],
                      })) || []
                    ),
                  },
                ],
          },
        ],
      },
      {
        OR: mergedCombinations?.map((combination) => {
          let sizeDeltaUsdCondition = {};

          if (
            combination.orderType !== undefined &&
            [OrderType.MarketDecrease, OrderType.MarketIncrease].includes(combination.orderType)
          ) {
            if (combination.isDepositOrWithdraw) {
              sizeDeltaUsdCondition = { sizeDeltaUsd_eq: 0 };
            } else {
              sizeDeltaUsdCondition = { sizeDeltaUsd_not_eq: 0 };
            }
          }

          return merge(
            {
              eventName_eq: combination.eventName,
              orderType_eq: combination.orderType,
              twapGroupId_isNull: !combination.isTwap,
            },
            sizeDeltaUsdCondition
          );
        }),
      },
      {
        // We do not show create liquidation orders in the trade history, thus we filter it out
        // ... && not (liquidation && orderCreated) === ... && (not liquidation || not orderCreated)
        OR: [{ orderType_not_eq: OrderType.Liquidation }, { eventName_not_eq: TradeActionType.OrderCreated }],
      },
      // not request market increase, market decrease, market swap, (deposit, withdraw are included in increase, decrease)
      ...(showDebugValues
        ? []
        : [
            {
              OR: [{ orderType_not_eq: OrderType.MarketIncrease }, { eventName_not_eq: TradeActionType.OrderCreated }],
            },
            {
              OR: [{ orderType_not_eq: OrderType.MarketDecrease }, { eventName_not_eq: TradeActionType.OrderCreated }],
            },
            {
              OR: [{ orderType_not_eq: OrderType.MarketSwap }, { eventName_not_eq: TradeActionType.OrderCreated }],
            },
          ]),
    ],
  });

  const whereClause = `where: ${filtersStr}`;

  const query = gql(`{
        tradeActions(
            offset: ${offset},
            limit: ${limit},
            orderBy: timestamp_DESC,
            ${whereClause}
        ) {
            id
            eventName

            srcChainId
            account
            marketAddress
            swapPath
            initialCollateralTokenAddress

            initialCollateralDeltaAmount
            sizeDeltaUsd
            sizeDeltaInTokens
            triggerPrice
            acceptablePrice
            executionPrice
            minOutputAmount
            executionAmountOut

            swapImpactUsd
            collateralTotalCostAmount
            priceImpactUsd
            priceImpactDiffUsd
            positionFeeAmount
            borrowingFeeAmount
            fundingFeeAmount
            liquidationFeeAmount
            pnlUsd
            basePnlUsd

            collateralTokenPriceMax
            collateralTokenPriceMin

            indexTokenPriceMin
            indexTokenPriceMax

            orderType
            orderKey
            isLong
            shouldUnwrapNativeToken
            twapGroupId
            numberOfParts
            totalImpactUsd
            proportionalPendingImpactUsd
            decreasePositionSwapType

            reason
            reasonBytes
            timestamp
            transaction {
                hash
            }
        }
      }`);

  const result = await client!.query({ query, fetchPolicy: "no-cache" });

  const rawTradeActions = (result.data?.tradeActions || []) as SubsquidTradeAction[];

  return rawTradeActions;
}
