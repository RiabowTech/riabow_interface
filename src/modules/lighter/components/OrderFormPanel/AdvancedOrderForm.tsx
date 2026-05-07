import { Trans, t } from "@lingui/macro";
import { useLingui } from "@lingui/react";
import { useEffect, useMemo, useState } from "react";

import { CoinSelect, Row } from "./MarketOrderForm";
import { getCurrentOrderFormPosition, getProjectedOrderFormPositionValue } from "./orderFormPosition";
import { formatPreviewFeeRatePercent } from "./orderPreviewFeeFormat";
import { useAvailableBalanceAdapter } from "../../adapters/useAvailableBalanceAdapter";
import { useMarketInfoAdapter } from "../../adapters/useMarketInfoAdapter";
import { useOrderPreviewAdapter, usePreviewErrorMessage } from "../../adapters/useOrderPreviewAdapter";
import { usePlaceOrderAdapter } from "../../adapters/usePlaceOrderAdapter";
import { usePositionsAdapter } from "../../adapters/usePositionsAdapter";
import { getLatestLimitPrice, subscribeLimitPrice } from "../../state/limitPriceBus";
import { Checkbox } from "../Checkbox/Checkbox";
import { PercentSlider } from "../PercentSlider/PercentSlider";

export type AdvancedType = "Stop Market" | "Stop Limit" | "Take Profit Market" | "Take Profit Limit";

type Props = {
  side: "buy" | "sell";
  type?: AdvancedType;
  isConnected: boolean;
  leverage: number;
  marginMode: "cross" | "isolated";
};

function formatUsd(value?: string) {
  if (!value) return "-";
  return `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatTrimmed(value: number, maxDecimals = 6) {
  if (!Number.isFinite(value) || value <= 0) return "-";
  return parseFloat(value.toFixed(maxDecimals)).toString();
}

export function AdvancedOrderForm({ side, type = "Stop Market", isConnected, leverage, marginMode }: Props) {
  const { i18n } = useLingui();
  const [triggerPrice, setTriggerPrice] = useState("");
  const [limitPrice, setLimitPrice] = useState("");
  const [amount, setAmount] = useState("");
  const [amountUnit, setAmountUnit] = useState<"SYMBOL" | "USD">("USD");
  const [pct, setPct] = useState(0);
  const [reduceOnly, setReduceOnly] = useState(false);

  const { placeOrder, submitting } = usePlaceOrderAdapter();
  const { available } = useAvailableBalanceAdapter();
  const market = useMarketInfoAdapter();
  const positions = usePositionsAdapter();
  const baseSymbol = market.symbol || "BTC";
  const currentPosition = getCurrentOrderFormPosition(positions, baseSymbol);

  const triggerLabel = type.startsWith("Take Profit") ? i18n._(t`TP Trigger Price`) : i18n._(t`Trigger Price`);
  const submitLabelMap: Record<AdvancedType, string> = {
    "Stop Market": "S/L Market",
    "Stop Limit": "S/L Limit",
    "Take Profit Market": "T/P Market",
    "Take Profit Limit": "T/P Limit",
  };
  const hasLimitPrice = type === "Stop Limit" || type === "Take Profit Limit";
  const requestTypeMap: Record<AdvancedType, "stop_market" | "stop_limit" | "take_profit" | "take_profit_limit"> = {
    "Stop Market": "stop_market",
    "Stop Limit": "stop_limit",
    "Take Profit Market": "take_profit",
    "Take Profit Limit": "take_profit_limit",
  };
  const previewOrderType = hasLimitPrice ? "limit" : "market";
  const amountUnitOptions = useMemo(() => [baseSymbol, "USD"], [baseSymbol]);

  const rawAmount = Number(amount) || 0;
  const triggerPriceNum = Number(triggerPrice) || 0;
  const limitPriceNum = Number(limitPrice) || 0;

  // market.markPrice 来自 ticker 轮询,每 2s 会微动。当用户还没填 trigger/limit 价格时,
  // refPrice 会回退到 market.markPrice —— 这会让 amountNum 每 2s 抖一下尾数,
  // 继而 preview SWR key 变化 → 每 2s 重发 /orders/preview → Order Size/Value 刷屏。
  // 解法:首次拿到 markPrice 时快照一份,之后 ticker 抖动不更新;
  // 用户在下方 onAmountInput / onPctChange / onUnitChange 中显式改动时才重新快照。
  const [conversionPrice, setConversionPrice] = useState<number | null>(null);
  useEffect(() => {
    if (conversionPrice == null && market.markPrice != null && market.markPrice > 0) {
      setConversionPrice(market.markPrice);
    }
  }, [conversionPrice, market.markPrice]);
  const resnapConversionPrice = () => {
    if (market.markPrice != null && market.markPrice > 0) setConversionPrice(market.markPrice);
  };

  const refPrice = (hasLimitPrice ? limitPriceNum : triggerPriceNum) || conversionPrice || 0;
  const amountNum = amountUnit === "USD" ? (refPrice > 0 ? rawAmount / refPrice : 0) : rawAmount;
  const preview = useOrderPreviewAdapter({
    side,
    orderType: previewOrderType,
    amount: amountNum,
    leverage,
    marginMode,
    reduceOnly,
    price: hasLimitPrice ? limitPriceNum : undefined,
  });
  const p = preview.data;
  const availableBalance = p?.available_balance ? Number(p.available_balance) : available ?? 0;
  const buyingPowerUsd = availableBalance > 0 ? availableBalance * leverage : 0;
  const previewErrorMessage = usePreviewErrorMessage(preview);

  const availableValue =
    p?.available_balance != null
      ? formatUsd(p.available_balance)
      : available != null
        ? `$${available.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : "-";
  const currentPositionAmount = currentPosition?.sizeTokenAmount ?? 0;
  const currentPositionValue =
    amountNum > 0
      ? `${formatTrimmed(amountNum, 4)} ${baseSymbol}`
      : currentPositionAmount > 0
        ? `${formatTrimmed(currentPositionAmount, 4)} ${baseSymbol}`
        : "-";

  // 止損限價單 / 止盈限價單 的限價输入框也接 OrderBook 行点击推送。
  // 订单类型不是 Limit 变种时 hasLimitPrice=false,输入框根本不渲染,setState 无副作用。
  useEffect(() => {
    if (!hasLimitPrice) return;
    const latest = getLatestLimitPrice();
    if (latest != null) setLimitPrice(String(latest));
    return subscribeLimitPrice((next) => setLimitPrice(String(next)));
  }, [hasLimitPrice]);

  useEffect(() => {
    if (amount || currentPositionAmount <= 0 || !market.markPrice || market.markPrice <= 0) return;

    if (amountUnit === "USD") {
      setAmount(parseFloat((currentPositionAmount * market.markPrice).toFixed(6)).toString());
    } else {
      setAmount(parseFloat(currentPositionAmount.toFixed(4)).toString());
    }
  }, [amount, amountUnit, currentPositionAmount, market.markPrice]);

  const onAmountInput = (nextRaw: string) => {
    setAmount(nextRaw);
    // 用户显式改 amount:刷一次 conversionPrice 快照,让后续 USD↔token 换算用最新行情
    resnapConversionPrice();
    const typed = Number(nextRaw) || 0;
    if (buyingPowerUsd > 0 && refPrice > 0) {
      const usdValue = amountUnit === "USD" ? typed : typed * refPrice;
      setPct(Math.max(0, Math.min(100, Math.round((usdValue / buyingPowerUsd) * 100))));
    } else {
      setPct(0);
    }
  };

  const onPctChange = (nextPct: number) => {
    setPct(nextPct);
    if (buyingPowerUsd > 0 && refPrice > 0) {
      const nextAmount =
        amountUnit === "USD"
          ? (buyingPowerUsd * (nextPct / 100)).toFixed(2)
          : ((buyingPowerUsd * (nextPct / 100)) / refPrice).toFixed(5);
      setAmount(nextAmount);
    }
    resnapConversionPrice();
  };

  const onUnitChange = (nextValue: string) => {
    const nextUnit = nextValue === "USD" ? "USD" : "SYMBOL";
    if (nextUnit !== amountUnit && rawAmount > 0 && refPrice > 0) {
      const converted = nextUnit === "USD" ? rawAmount * refPrice : rawAmount / refPrice;
      setAmount(converted.toFixed(nextUnit === "USD" ? 2 : 5));
    }
    resnapConversionPrice();
    setAmountUnit(nextUnit);
  };

  const canSubmit = triggerPriceNum > 0 && amountNum > 0;
  const orderValueText =
    amountNum > 0 && refPrice > 0
      ? `$${(amountNum * refPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : "-";
  const maximumOrderValueText = p?.order_value ? formatUsd(p.order_value) : "-";

  const submit = () =>
    placeOrder({
      side,
      type: requestTypeMap[type],
      amount: amountNum,
      price: hasLimitPrice ? limitPriceNum || undefined : undefined,
      triggerPrice: triggerPriceNum || undefined,
      leverage,
      marginMode,
      reduceOnly,
      timeInForce: hasLimitPrice ? "GTC" : undefined,
      workingType: "MARK_PRICE",
    });

  return (
    <div className="ltr-form">
      <div className="ltr-form__section">
        <Row label={<Trans>Available to Trade</Trans>} value={availableValue} />
        <Row
          label={<Trans>Position</Trans>}
          value={getProjectedOrderFormPositionValue(currentPosition, baseSymbol, amountNum, side, reduceOnly)}
        />
      </div>

      <div className="ltr-form__section">
        <div className="ltr-form__field">
          <label className="ltr-form__label">{triggerLabel}</label>
          <input
            className="ltr-form__input"
            value={triggerPrice}
            onChange={(e) => setTriggerPrice(e.target.value)}
            placeholder="0.000000"
            inputMode="decimal"
          />
        </div>

        {hasLimitPrice && (
          <div className="ltr-form__field">
            <label className="ltr-form__label">
              <Trans>Limit Price</Trans>
            </label>
            <input
              className="ltr-form__input"
              value={limitPrice}
              onChange={(e) => setLimitPrice(e.target.value)}
              placeholder="0.000000"
              inputMode="decimal"
            />
            <button
              type="button"
              className="ltr-form__trailing ltr-form__trailing--link"
              onClick={() => {
                if (market.markPrice) setLimitPrice(market.markPrice.toString());
              }}
            >
              <Trans>Mid</Trans>
            </button>
          </div>
        )}

        <div className="ltr-form__field">
          <label className="ltr-form__label">
            <Trans>Amount</Trans>
          </label>
          <input
            className="ltr-form__input"
            value={amount}
            onChange={(e) => onAmountInput(e.target.value)}
            placeholder={amountUnit === "USD" ? "0.00" : "0.00000"}
            inputMode="decimal"
          />
          <CoinSelect
            value={amountUnit === "USD" ? "USD" : baseSymbol}
            options={amountUnitOptions}
            onChange={onUnitChange}
          />
        </div>

        <PercentSlider value={pct} onChange={onPctChange} side={side} />

        <Checkbox checked={reduceOnly} onChange={setReduceOnly} label={i18n._(t`Reduce Only`)} />
      </div>

      <div className="ltr-form__section">
        {hasLimitPrice && <Row label={<Trans>Maximum Order Value</Trans>} value={maximumOrderValueText} />}
        <Row label={<Trans>Order Size</Trans>} value={currentPositionValue} />
        {hasLimitPrice && <Row label={<Trans>Order Value</Trans>} value={orderValueText} />}
        <Row
          label={<Trans>Fees</Trans>}
          value={
            <Trans>
              Taker: {formatPreviewFeeRatePercent(p?.taker_fee_rate)} | Maker:{" "}
              {formatPreviewFeeRatePercent(p?.maker_fee_rate)}
            </Trans>
          }
        />
        {previewErrorMessage && <div className="ltr-form__note ltr-form__note--error">{previewErrorMessage}</div>}
      </div>

      {isConnected && (
        <button
          onClick={submit}
          disabled={submitting || !canSubmit}
          className={`ltr-form__submit ltr-form__submit--${side}`}
        >
          {canSubmit ? submitLabelMap[type] : i18n._(t`Enter ${triggerLabel}`)}
        </button>
      )}
    </div>
  );
}
