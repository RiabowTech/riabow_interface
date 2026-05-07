import { useCallback } from "react";

import { usePrimitOrderSubmit } from "modules/lighter/api/custom/usePrimitOrderSubmit";
import type { OrderType as ApiOrderType, PositionModeSide, TimeInForce, WorkingType } from "modules/lighter/api/types";
import { useTradeState } from "modules/lighter/store/TradeStateContext";

export type OrderSide = "buy" | "sell";
export type OrderType = ApiOrderType;

export type PlaceOrderParams = {
  side: OrderSide;
  type: OrderType;
  /** 订单数量(代币数量,例 0.001 BTC) */
  amount: number;
  /** 限价单价格(限价时必填) */
  price?: number;
  /** 条件单触发价 */
  triggerPrice?: number;
  /** 杠杆倍数(默认 10) */
  leverage?: number;
  /** 保证金模式 */
  marginMode?: "cross" | "isolated";
  /** 只减仓 */
  reduceOnly?: boolean;
  /** 止盈触发价 */
  tpPrice?: number;
  /** 止损触发价 */
  slPrice?: number;
  /** 最大滑点(例 0.01 = 1%) */
  maxSlippage?: number;
  /** 有效方式 */
  timeInForce?: TimeInForce;
  /** 触发类型 */
  workingType?: WorkingType;
  /** 持仓方向 */
  positionSide?: PositionModeSide;
  /** 是否全平(仅触发单) */
  closePosition?: boolean;
  /** 自定义客户端订单 ID */
  newClientOrderId?: string;
};

// Synthetics OrderType enum 的数字编码(沿用当前 lighter 交易态定义)
// 对应 orderType 解析规则见 usePrimitOrderSubmit:
//   MarketIncrease / MarketDecrease => "market"
//   LimitIncrease / LimitDecrease  => "limit"
// 这里只使用 Market/Limit 两类
const ORDER_TYPE_MARKET_INCREASE = 0;
const ORDER_TYPE_LIMIT_INCREASE = 1;
const ORDER_TYPE_MARKET_DECREASE = 4;
const ORDER_TYPE_LIMIT_DECREASE = 5;

const USD_DECIMALS = 30;
const BASE_TOKEN_DECIMALS = 18; // 对齐 signature amount 编码精度

function toBigIntScaled(value: number, decimals: number): bigint {
  if (!Number.isFinite(value) || value <= 0) return 0n;
  // 用字符串避免浮点精度
  const fixed = value.toFixed(decimals);
  const [intPart, fracPart = ""] = fixed.split(".");
  const padded = (fracPart + "0".repeat(decimals)).slice(0, decimals);
  return BigInt(intPart) * 10n ** BigInt(decimals) + BigInt(padded || "0");
}

function toDecimalString(value: number, fractionDigits = 6): string | undefined {
  if (!Number.isFinite(value) || value <= 0) return undefined;
  return parseFloat(value.toFixed(fractionDigits)).toString();
}

export function usePlaceOrderAdapter() {
  const { submitOrder, isReady } = usePrimitOrderSubmit();
  const { selectedSymbol } = useTradeState();

  const placeOrder = useCallback(
    async (p: PlaceOrderParams) => {
      if (!isReady) {
        throw new Error("钱包未连接或未认证");
      }
      if (!selectedSymbol) throw new Error("未选择交易对");

      const isLimit = p.type === "limit" || p.type === "stop_limit" || p.type === "take_profit_limit";
      const isDecrease = !!p.reduceOnly;
      const orderTypeNum = isLimit
        ? isDecrease
          ? ORDER_TYPE_LIMIT_DECREASE
          : ORDER_TYPE_LIMIT_INCREASE
        : isDecrease
          ? ORDER_TYPE_MARKET_DECREASE
          : ORDER_TYPE_MARKET_INCREASE;

      const sizeDeltaUsd = toBigIntScaled(p.amount, BASE_TOKEN_DECIMALS);
      const limitPrice = isLimit && p.price != null ? toBigIntScaled(p.price, USD_DECIMALS) : undefined;

      return submitOrder({
        symbol: selectedSymbol,
        isLong: p.side === "buy",
        isIncrease: !isDecrease,
        sizeDeltaUsd,
        indexTokenDecimals: BASE_TOKEN_DECIMALS,
        triggerPrice: limitPrice,
        orderType: orderTypeNum,
        apiOrderTypeOverride: p.type,
        reduceOnly: p.reduceOnly,
        leverage: p.leverage ?? 10,
        marginMode: p.marginMode ?? "cross",
        tpPrice: toDecimalString(p.tpPrice ?? NaN),
        slPrice: toDecimalString(p.slPrice ?? NaN),
        maxSlippage: toDecimalString(p.maxSlippage ?? NaN, 4),
        stopPrice: toDecimalString(p.triggerPrice ?? NaN),
        timeInForce: p.timeInForce,
        workingType: p.workingType,
        positionSide: p.positionSide,
        closePosition: p.closePosition,
        clientOrderId: p.newClientOrderId,
      });
    },
    [isReady, selectedSymbol, submitOrder]
  );

  return {
    placeOrder,
    submitting: false, // 如需细粒度 loading 状态可扩展成 useState 追踪
    isReady,
  };
}
