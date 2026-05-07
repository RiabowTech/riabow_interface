import { useMemo } from "react";

import { Token } from "domain/tokens";
import { getByKey } from "lib/objects";
import type { ContractsChainId } from "sdk/configs/chains";
import { getWrappedToken } from "sdk/configs/tokens";
import { getOrderInfo, isPositionOrder, isSwapOrder, isTwapPositionOrder, isTwapSwapOrder } from "sdk/utils/orders";
import { getTwapOrderKey } from "sdk/utils/twap/index";
import { decodeTwapUiFeeReceiver } from "sdk/utils/twap/uiFeeReceiver";

import { MarketFilterLongShortItemData } from "components/TableMarketFilter/MarketFilterLongShort";

import { useOrders } from "./useOrders";

// Backend API layer - feature-flag controlled data sources.
import { shouldUseApiOrders, useApiOrders } from "@/modules/lighter/api";
import { MarketsInfoData } from "../markets";
import { TokensData } from "../tokens";
import { OrderTypeFilterValue } from "./ordersFilters";
import { Order, OrdersInfoData, TwapOrderInfo } from "./types";
import { setOrderInfoTitle } from "./utils";

export type AggregatedOrdersDataResult = {
  ordersInfoData?: OrdersInfoData;
  count?: number;
  isLoading: boolean;
};

export function useOrdersInfoRequest(
  chainId: ContractsChainId,
  p: {
    enabled?: boolean;
    marketsInfoData?: MarketsInfoData;
    marketsDirectionsFilter?: MarketFilterLongShortItemData[];
    orderTypesFilter?: OrderTypeFilterValue[];
    tokensData?: TokensData;
    account: string | null | undefined;
  }
): AggregatedOrdersDataResult {
  const { enabled = true, marketsInfoData, tokensData, account, marketsDirectionsFilter, orderTypesFilter } = p;

  // Feature flag: switch between backend API data and multicall data.
  const useApiDataSource = shouldUseApiOrders();

  // Multicall data source.
  const multicallOrdersResult = useOrders(chainId, {
    account,
    enabled,
    marketsDirectionsFilter,
    orderTypesFilter,
    marketsInfoData,
  });

  // Backend API data source.
  const apiOrdersResult = useApiOrders(chainId, account);

  // Select the active data source based on the feature flag.
  const { ordersData, count } = useApiDataSource
    ? { ordersData: apiOrdersResult.ordersData, count: Object.keys(apiOrdersResult.ordersData || {}).length }
    : { ordersData: multicallOrdersResult.ordersData, count: multicallOrdersResult.count };

  const wrappedToken = getWrappedToken(chainId);

  return useMemo(() => {
    if (!account) {
      return {
        isLoading: false,
      };
    }

    if (!marketsInfoData || !ordersData || !tokensData) {
      return {
        isLoading: true,
      };
    }

    const ordersInfoData = Object.keys(ordersData).reduce((acc: OrdersInfoData, orderKey: string) => {
      const order = getByKey(ordersData, orderKey)!;

      const orderInfo = createOrderInfo({
        marketsInfoData,
        tokensData,
        wrappedNativeToken: wrappedToken,
        order,
        acc,
      });

      if (!orderInfo) {
        // Silently skip orders that can't be parsed - this is expected when:
        // 1. Market info hasn't loaded yet (temporary state)
        // 2. Market is not in the supported markets list (normal for API orders)
        // Only log in development mode for debugging
        if (process.env.NODE_ENV === "development") {
          // eslint-disable-next-line no-console
          console.debug(`OrderInfo parsing skipped (market info not available)`, {
            orderKey: order.key,
            marketAddress: order.marketAddress,
          });
        }
        return acc;
      }

      const marketInfo = getByKey(marketsInfoData, order.marketAddress);
      const indexToken = marketInfo?.indexToken;

      setOrderInfoTitle(orderInfo, indexToken);

      acc[orderInfo.key] = orderInfo;

      return acc;
    }, {} as OrdersInfoData);

    return {
      count: count,
      ordersInfoData,
      isLoading: false,
    };
  }, [account, count, marketsInfoData, ordersData, tokensData, wrappedToken]);
}

const createOrderInfo = ({
  order,
  marketsInfoData,
  tokensData,
  wrappedNativeToken,
  acc,
}: {
  order: Order;
  marketsInfoData: MarketsInfoData;
  tokensData: TokensData;
  wrappedNativeToken: Token;
  acc: OrdersInfoData;
}) => {
  const twapParams = decodeTwapUiFeeReceiver(order.uiFeeReceiver);

  const orderInfo = getOrderInfo({
    marketsInfoData,
    tokensData,
    wrappedNativeToken,
    order,
  });

  if (twapParams && orderInfo) {
    const twapOrderKey = getTwapOrderKey({
      twapId: twapParams.twapId,
      orderType: order.orderType,
      pool: order.marketAddress,
      collateralTokenSymbol: orderInfo.targetCollateralToken.symbol,
      isLong: order.isLong,
      swapPath: order.swapPath,
      account: order.account,
      initialCollateralToken: orderInfo.initialCollateralToken.address,
    });

    let twapOrderInfo = getByKey(acc, twapOrderKey);

    if (!twapOrderInfo) {
      const twap: TwapOrderInfo = {
        ...orderInfo,
        isTwap: true,
        key: twapOrderKey,
        orders: [],
        twapId: twapParams.twapId,
        numberOfParts: twapParams.numberOfParts,
        initialCollateralDeltaAmount: orderInfo.initialCollateralDeltaAmount * BigInt(twapParams.numberOfParts),
        sizeDeltaUsd: orderInfo.sizeDeltaUsd * BigInt(twapParams.numberOfParts),
        executionFee: orderInfo.executionFee * BigInt(twapParams.numberOfParts),
      };

      twapOrderInfo = twap;
    }

    if (twapOrderInfo && isTwapSwapOrder(twapOrderInfo) && isSwapOrder(orderInfo)) {
      twapOrderInfo.orders.push(orderInfo);
    }

    if (twapOrderInfo && isTwapPositionOrder(twapOrderInfo) && isPositionOrder(orderInfo)) {
      twapOrderInfo.orders.push(orderInfo);
    }

    return twapOrderInfo;
  }

  return orderInfo;
};
