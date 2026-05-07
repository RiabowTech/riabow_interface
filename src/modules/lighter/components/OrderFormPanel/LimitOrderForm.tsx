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

type Props = {
  side: "buy" | "sell";
  isConnected: boolean;
  leverage: number;
  marginMode: "cross" | "isolated";
};

const FALLBACK_MID_PRICE = 74328.3;

export function LimitOrderForm({ side, isConnected, leverage, marginMode }: Props) {
  const { i18n } = useLingui();
  const [price, setPrice] = useState("");
  const [amount, setAmount] = useState("");
  const [amountUnit, setAmountUnit] = useState<"SYMBOL" | "USD">("USD");
  const [pct, setPct] = useState(0);
  const [reduceOnly, setReduceOnly] = useState(false);
  const [tpsl, setTpsl] = useState(false);
  const [tpPrice, setTpPrice] = useState("");
  const [tpGain, setTpGain] = useState("");
  const [slPrice, setSlPrice] = useState("");
  const [slLoss, setSlLoss] = useState("");
  // 点 OrderBook 行时通过 limitPriceBus 推送价格过来,mount 时也读一次最新值
  // 兜住用户"先点了 book 再切到限價 Tab"的顺序。
  useEffect(() => {
    const latest = getLatestLimitPrice();
    if (latest != null) setPrice(String(latest));
    return subscribeLimitPrice((next) => setPrice(String(next)));
  }, []);
  const { placeOrder, submitting } = usePlaceOrderAdapter();
  const { available } = useAvailableBalanceAdapter();
  const market = useMarketInfoAdapter();
  const positions = usePositionsAdapter();
  useEffect(() => {
    setPrice("");
  }, [market.symbol]);
  const baseSymbol = market.symbol || "BTC";
  const currentPosition = getCurrentOrderFormPosition(positions, baseSymbol);
  const marketMidPrice = market.markPrice && market.markPrice > 0 ? market.markPrice : FALLBACK_MID_PRICE;
  const amountUnitOptions = useMemo(() => [baseSymbol, "USD"], [baseSymbol]);
  const rawAmount = Number(amount) || 0;
  const priceNum = Number(price) || 0;
  const refPrice = priceNum || marketMidPrice;
  const amountNum = amountUnit === "USD" && refPrice > 0 ? rawAmount / refPrice : rawAmount;
  const preview = useOrderPreviewAdapter({
    side,
    orderType: "limit",
    amount: amountNum,
    leverage,
    marginMode,
    reduceOnly,
    price: priceNum,
  });
  const p = preview.data;
  const availableBalance = p?.available_balance ? Number(p.available_balance) : available ?? 0;
  const buyingPowerUsd = availableBalance > 0 ? availableBalance * leverage : 0;
  const previewErrorMessage = usePreviewErrorMessage(preview);
  const fmtUsd = (s?: string) =>
    s ? `$${Number(s).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "-";
  const submit = () =>
    placeOrder({
      side,
      type: "limit",
      amount: amountNum,
      price: priceNum || undefined,
      leverage,
      marginMode,
      reduceOnly,
      tpPrice: tpsl && tpPrice ? Number(tpPrice) : undefined,
      slPrice: tpsl && slPrice ? Number(slPrice) : undefined,
    });

  return (
    <div className="ltr-form">
      <div className="ltr-form__section">
        <Row
          label={<Trans>Available to Trade</Trans>}
          value={
            p?.available_balance
              ? fmtUsd(p.available_balance)
              : available != null
                ? `$${available.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : "-"
          }
        />
        <Row
          label={<Trans>Position</Trans>}
          value={getProjectedOrderFormPositionValue(currentPosition, baseSymbol, amountNum, side, reduceOnly)}
        />
      </div>

      <div className="ltr-form__section">
        <div className="ltr-form__field">
          <label className="ltr-form__label">
            <Trans>Limit Price</Trans>
          </label>
          <input
            className="ltr-form__input"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder={marketMidPrice.toFixed(1)}
            inputMode="decimal"
          />
          <button
            type="button"
            className="ltr-form__trailing ltr-form__trailing--link"
            onClick={() => setPrice(marketMidPrice.toFixed(1))}
          >
            <Trans>Mid</Trans>
          </button>
        </div>

        <div className="ltr-form__field">
          <label className="ltr-form__label">
            <Trans>Amount</Trans>
          </label>
          <input
            className="ltr-form__input"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              const typed = Number(e.target.value) || 0;
              if (buyingPowerUsd > 0 && refPrice > 0) {
                const usdValue = amountUnit === "USD" ? typed : typed * refPrice;
                const nextPct = Math.max(0, Math.min(100, Math.round((usdValue / buyingPowerUsd) * 100)));
                setPct(nextPct);
              } else {
                setPct(0);
              }
            }}
            placeholder={amountUnit === "USD" ? "0.00" : "0.00000"}
            inputMode="decimal"
          />
          <CoinSelect
          value={amountUnit === "USD" ? "USD" : baseSymbol}
          options={amountUnitOptions}
          onChange={(v) => {
            const next = v === "USD" ? "USD" : "SYMBOL";
            if (next !== amountUnit && rawAmount > 0 && refPrice > 0) {
                const newVal = next === "USD" ? rawAmount * refPrice : rawAmount / refPrice;
                setAmount(newVal.toFixed(next === "USD" ? 2 : 5));
              }
              setAmountUnit(next);
            }}
          />
        </div>

        <PercentSlider
          value={pct}
          onChange={(next) => {
            setPct(next);
            const ref = priceNum || marketMidPrice;
            if (buyingPowerUsd > 0 && ref > 0) {
              const newAmount =
                amountUnit === "USD"
                  ? (buyingPowerUsd * (next / 100)).toFixed(2)
                  : ((buyingPowerUsd * (next / 100)) / ref).toFixed(5);
              setAmount(newAmount);
            }
          }}
          side={side}
        />

        <Checkbox
          checked={reduceOnly}
          onChange={(checked) => {
            setReduceOnly(checked);
            if (checked) setTpsl(false);
          }}
          label={i18n._(t`Reduce Only`)}
        />
        {!reduceOnly && (
          <Checkbox
            checked={tpsl}
            onChange={(checked) => {
              setTpsl(checked);
              if (checked) setReduceOnly(false);
            }}
            label={i18n._(t`Take Profit / Stop Loss`)}
          />
        )}

        {tpsl && (
          <div className="ltr-form__grid2">
            <div className="ltr-form__field">
              <label className="ltr-form__label">
                <Trans>TP Price</Trans>
              </label>
              <input
                className="ltr-form__input"
                value={tpPrice}
                onChange={(e) => setTpPrice(e.target.value)}
                placeholder="0.0"
                inputMode="decimal"
              />
            </div>
            <div className="ltr-form__field">
              <label className="ltr-form__label">
                <Trans>Gain</Trans>
              </label>
              <input
                className="ltr-form__input"
                value={tpGain}
                onChange={(e) => setTpGain(e.target.value)}
                placeholder="0.00"
                inputMode="decimal"
              />
              <button className="ltr-form__trailing" type="button">
                <span>%</span>
                <Caret />
              </button>
            </div>
            <div className="ltr-form__field">
              <label className="ltr-form__label">
                <Trans>SL Price</Trans>
              </label>
              <input
                className="ltr-form__input"
                value={slPrice}
                onChange={(e) => setSlPrice(e.target.value)}
                placeholder="0.0"
                inputMode="decimal"
              />
            </div>
            <div className="ltr-form__field">
              <label className="ltr-form__label">
                <Trans>Loss</Trans>
              </label>
              <input
                className="ltr-form__input"
                value={slLoss}
                onChange={(e) => setSlLoss(e.target.value)}
                placeholder="0.00"
                inputMode="decimal"
              />
              <button className="ltr-form__trailing" type="button">
                <span>%</span>
                <Caret />
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="ltr-form__section">
        <Row label={<Trans>Maximum Order Value</Trans>} value={fmtUsd(p?.order_value)} />
        <Row label={<Trans>Order Size</Trans>} value={p?.order_size_symbol ?? "-"} />
        <Row label={<Trans>Order Value</Trans>} value={fmtUsd(p?.order_value)} />
        <Row label={<Trans>Limit Price</Trans>} value={price || marketMidPrice.toLocaleString()} />
        <Row
          label={<Trans>Est. Liq. Price</Trans>}
          value={p?.est_liq_price ? Number(p.est_liq_price).toLocaleString() : "-"}
        />
        <Row
          label={<Trans>Position Margin</Trans>}
          value={p?.position_margin_after ? fmtUsd(p.position_margin_after) : "$0.00"}
        />
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
        <button onClick={submit} disabled={submitting} className={`ltr-form__submit ltr-form__submit--${side}`}>
          {side === "buy" ? <Trans>Buy / Long</Trans> : <Trans>Sell / Short</Trans>}
        </button>
      )}
    </div>
  );
}

function Caret() {
  return (
    <svg width="10" height="10" viewBox="0 0 256 256" fill="currentColor">
      <path d="M213.66,101.66l-80,80a8,8,0,0,1-11.32,0l-80-80A8,8,0,0,1,53.66,90.34L128,164.69l74.34-74.35a8,8,0,0,1,11.32,11.32Z" />
    </svg>
  );
}
