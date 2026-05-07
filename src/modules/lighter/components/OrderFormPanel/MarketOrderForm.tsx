import { Trans, t } from "@lingui/macro";
import { useLingui } from "@lingui/react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { getCurrentOrderFormPosition, getProjectedOrderFormPositionValue } from "./orderFormPosition";
import { formatPreviewFeeRatePercent } from "./orderPreviewFeeFormat";
import { useAvailableBalanceAdapter } from "../../adapters/useAvailableBalanceAdapter";
import { useMarketInfoAdapter } from "../../adapters/useMarketInfoAdapter";
import { useOrderPreviewAdapter, usePreviewErrorMessage } from "../../adapters/useOrderPreviewAdapter";
import { usePlaceOrderAdapter } from "../../adapters/usePlaceOrderAdapter";
import { usePositionsAdapter } from "../../adapters/usePositionsAdapter";
import { Checkbox } from "../Checkbox/Checkbox";
import { PercentSlider } from "../PercentSlider/PercentSlider";

/** slippage override 超过该阈值时展示一条黄色警示(只提示,不阻断)。*/
const SLIPPAGE_WARN_THRESHOLD_PCT = 3;

type Props = {
  side: "buy" | "sell";
  isConnected: boolean;
  leverage: number;
  marginMode: "cross" | "isolated";
};

export function MarketOrderForm({ side, isConnected, leverage, marginMode }: Props) {
  const { i18n } = useLingui();
  const [amount, setAmount] = useState("");
  const [amountUnit, setAmountUnit] = useState<"SYMBOL" | "USD">("USD");
  const [pct, setPct] = useState(0);
  const [reduceOnly, setReduceOnly] = useState(false);
  const [tpsl, setTpsl] = useState(false);
  const [tpPrice, setTpPrice] = useState("");
  const [tpGain, setTpGain] = useState("");
  const [slPrice, setSlPrice] = useState("");
  const [slLoss, setSlLoss] = useState("");
  const [slippageOverride, setSlippageOverride] = useState("");
  const { placeOrder, submitting } = usePlaceOrderAdapter();
  const market = useMarketInfoAdapter();
  const { available } = useAvailableBalanceAdapter();
  const positions = usePositionsAdapter();
  const baseSymbol = market.symbol || "BTC";
  const currentPosition = getCurrentOrderFormPosition(positions, baseSymbol);
  const amountUnitOptions = useMemo(() => [baseSymbol, "USD"] as const, [baseSymbol]);
  // 用户输入的数值;根据 amountUnit 换算为合约数量(BTC)作为 amountNum
  const rawAmount = Number(amount) || 0;
  const markPrice = market.markPrice ?? null;

  // USD↔token 换算用的价格快照 —— 首次拿到 markPrice 时锁定,之后 ticker 抖动不更新。
  // 为什么要这么做:markPrice 实际上来自 ticker.last_price,每 2s 轮询都会微动(73922.45↔73923.12);
  // 原实现直接用 live markPrice 做换算,rawAmount/markPrice 每 2s 变一个尾数,
  // toAmountString 固化 8 位小数后仍不同,导致 preview SWR key 每 2s 变一次、重发 /orders/preview,
  // UI 上 Order Size / Order Value / Position Margin 随之每秒跳动一下。
  // 用户显式改 amount / 单位 / 百分比时,由对应 onChange 调用 resnapConversionPrice 重新快照。
  const [conversionPrice, setConversionPrice] = useState<number | null>(null);
  useEffect(() => {
    if (conversionPrice == null && markPrice != null && markPrice > 0) {
      setConversionPrice(markPrice);
    }
  }, [conversionPrice, markPrice]);
  const resnapConversionPrice = () => {
    if (markPrice != null && markPrice > 0) setConversionPrice(markPrice);
  };

  // tentativeAmountNum 只看 conversionPrice,不再读 markPriceStale。
  // 为什么:ticker 2s 轮询,markPriceReceivedAt 只在"数值变化"时打戳(useMarketInfoAdapter),
  // 静止盘连续两次同价就会让 markPriceStale 周期性翻 true,从而让本行在
  // "rawAmount / conversionPrice" ↔ "rawAmount (USD 当 BTC)" 之间来回切,
  // tentativePreview 请求参数翻倍差异,Order Size/Value/Margin 在正常值和 ~marketPrice 倍的离谱值之间闪。
  // conversionPrice 本身是快照:首次拿到 markPrice 时锁定,用户显式改 amount/单位/百分比时才刷新,
  // 与 ticker 静止/活跃无关 —— 所以拿它做换算天生稳定。
  // conversionPrice 还没拿到时用 0 而不是 rawAmount,让 preview 闸(amount > 0)跳过发请求,
  // 而不是把 USD 数值当 BTC 发出去。
  const tentativeAmountNum =
    amountUnit === "USD" ? (conversionPrice && conversionPrice > 0 ? rawAmount / conversionPrice : 0) : rawAmount;
  const tentativePreview = useOrderPreviewAdapter({
    side,
    orderType: "market",
    amount: tentativeAmountNum,
    leverage,
    marginMode,
    reduceOnly,
  });
  const previewEstPrice = tentativePreview.data?.est_price ? Number(tentativePreview.data.est_price) : null;
  // submit 用的换算价:conversionPrice 优先,实在没有(WS 从没连上)才回退后端 est_price。
  // 不再挂 markPriceStale —— 那个信号在静止盘会翻,会让 effectivePrice 跟着翻、amountNum 抖。
  const effectivePrice = conversionPrice ?? (previewEstPrice && previewEstPrice > 0 ? previewEstPrice : null);
  // submit 用的 BTC 量:USD 模式下必须能换算出价格,换算不出就置 0(按钮禁用);SYMBOL 模式直接用输入。
  // 不再在 USD 换算失败时回退成 rawAmount —— 那会把 USD 数值当成 BTC 发出去(曾让 /orders 发出 amount=13.70 "BTC")
  const amountNum = amountUnit === "USD" ? (effectivePrice && effectivePrice > 0 ? rawAmount / effectivePrice : 0) : rawAmount;
  const amountReady = amountNum > 0;
  const p = tentativePreview.data;
  const availableBalance = p?.available_balance ? Number(p.available_balance) : available ?? 0;
  const buyingPowerUsd = availableBalance > 0 ? availableBalance * leverage : 0;
  const previewErrorMessage = usePreviewErrorMessage(tentativePreview);
  const fmtUsd = (s?: string) =>
    s ? `$${Number(s).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "-";
  const fmtPct = (s?: string) => (s ? `${(Number(s) * 100).toFixed(2)}%` : "-");

  // 解析 slippage override(用户输入的是百分比,后端吃 0~1 的 decimal)。
  // 空 / 非法 → undefined,回退到后端默认。
  const slippageOverridePct = Number(slippageOverride);
  const slippageOverrideValid =
    slippageOverride !== "" &&
    Number.isFinite(slippageOverridePct) &&
    slippageOverridePct > 0 &&
    slippageOverridePct <= 50;
  const effectiveMaxSlippage = slippageOverrideValid
    ? slippageOverridePct / 100
    : p?.max_slippage
      ? Number(p.max_slippage)
      : undefined;
  const slippageWarn = slippageOverrideValid && slippageOverridePct > SLIPPAGE_WARN_THRESHOLD_PCT;

  const submit = () =>
    placeOrder({
      side,
      type: "market",
      amount: amountNum,
      leverage,
      marginMode,
      reduceOnly,
      tpPrice: tpsl && tpPrice ? Number(tpPrice) : undefined,
      slPrice: tpsl && slPrice ? Number(slPrice) : undefined,
      maxSlippage: effectiveMaxSlippage,
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
        <FormField label={<Trans>Amount</Trans>}>
          <input
            className="ltr-form__input"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              // 用户显式改 amount:按当前 markPrice 刷一次换算快照,保证下单意图反映最新价
              resnapConversionPrice();
              // 手动修改 amount 后,按当前余额+价格重算百分比(整数)
              const typed = Number(e.target.value) || 0;
              const price = markPrice ?? (p?.est_price ? Number(p.est_price) : null);
              if (buyingPowerUsd > 0) {
                const usdValue = amountUnit === "USD" ? typed : price ? typed * price : 0;
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
              // 切换单位时,按当前 markPrice 换算数值,避免丢失输入
              if (next !== amountUnit && rawAmount > 0 && markPrice && markPrice > 0) {
                const newVal = next === "USD" ? rawAmount * markPrice : rawAmount / markPrice;
                setAmount(newVal.toFixed(next === "USD" ? 2 : 5));
              }
              // 同步刷新换算快照,让后续 USD↔token 基于同一个价格
              resnapConversionPrice();
              setAmountUnit(next);
            }}
          />
        </FormField>

        <PercentSlider
          value={pct}
          onChange={(next) => {
            setPct(next);
            const price = market.markPrice ?? (p?.est_price ? Number(p.est_price) : null);
            if (buyingPowerUsd > 0 && price != null && price > 0) {
              // 余额是 USD;USD 模式直接用 bal×pct,SYMBOL 模式换算为代币数量
              const newAmount =
                amountUnit === "USD"
                  ? (buyingPowerUsd * (next / 100)).toFixed(2)
                  : ((buyingPowerUsd * (next / 100)) / price).toFixed(5);
              setAmount(newAmount);
            }
            // 百分比滑动即视作一次显式改动,刷新换算快照
            resnapConversionPrice();
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
            <FormField label={<Trans>TP Price</Trans>}>
              <input
                className="ltr-form__input"
                value={tpPrice}
                onChange={(e) => setTpPrice(e.target.value)}
                placeholder="0.0"
                inputMode="decimal"
              />
            </FormField>
            <FormField label={<Trans>Gain</Trans>}>
              <input
                className="ltr-form__input"
                value={tpGain}
                onChange={(e) => setTpGain(e.target.value)}
                placeholder="0.00"
                inputMode="decimal"
              />
              <UnitSelect unit="%" />
            </FormField>
            <FormField label={<Trans>SL Price</Trans>}>
              <input
                className="ltr-form__input"
                value={slPrice}
                onChange={(e) => setSlPrice(e.target.value)}
                placeholder="0.0"
                inputMode="decimal"
              />
            </FormField>
            <FormField label={<Trans>Loss</Trans>}>
              <input
                className="ltr-form__input"
                value={slLoss}
                onChange={(e) => setSlLoss(e.target.value)}
                placeholder="0.00"
                inputMode="decimal"
              />
              <UnitSelect unit="%" />
            </FormField>
          </div>
        )}
      </div>

      <div className="ltr-form__section">
        <Row label={<Trans>Order Size</Trans>} value={p?.order_size_symbol ?? "-"} />
        <Row label={<Trans>Order Value</Trans>} value={fmtUsd(p?.order_value)} />
        <Row
          label={<Trans>Est. Liq. Price</Trans>}
          value={p?.est_liq_price ? Number(p.est_liq_price).toLocaleString() : "-"}
        />
        <Row
          label={<Trans>Position Margin</Trans>}
          value={fmtUsd(p?.position_margin_after) === "-" ? "$0.00" : fmtUsd(p?.position_margin_after)}
        />
        <Row label={<Trans>Est. Price</Trans>} value={p?.est_price ? Number(p.est_price).toLocaleString() : "-"} />
        {/* 去掉"Mark price is stale"黄色提示:静止盘会被误判为 stale,刷屏不传递有效信号。
            真正需要警示的场景(换算失败)已由 submit 按钮禁用 + 红色错误行承担。 */}
        <Row
          label={<Trans>Slippage</Trans>}
          value={
            <Trans>
              Est: {fmtPct(p?.est_slippage) || "0.00%"} | Max: {fmtPct(p?.max_slippage) || "1.00%"}
            </Trans>
          }
          valueLink
        />
        <div className="ltr-form__field">
          <label className="ltr-form__label">
            <Trans>Max Slippage (%)</Trans>
          </label>
          <input
            className="ltr-form__input"
            value={slippageOverride}
            onChange={(e) => setSlippageOverride(e.target.value.replace(/[^0-9.]/g, ""))}
            placeholder={p?.max_slippage ? (Number(p.max_slippage) * 100).toFixed(2) : "1.00"}
            inputMode="decimal"
            aria-label={i18n._(t`Max Slippage override (%)`)}
          />
          <span className="ltr-form__trailing ltr-form__trailing--plain">%</span>
        </div>
        {slippageWarn && (
          <div className="ltr-form__note ltr-form__note--warn">
            <Trans>
              Slippage tolerance above {SLIPPAGE_WARN_THRESHOLD_PCT}% is aggressive — the executed price may deviate
              significantly from the estimate.
            </Trans>
          </div>
        )}
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
          disabled={submitting || !amountReady}
          className={`ltr-form__submit ltr-form__submit--${side}`}
        >
          {side === "buy" ? <Trans>Buy / Long</Trans> : <Trans>Sell / Short</Trans>}
        </button>
      )}
    </div>
  );
}

function FormField({ label, children }: { label: ReactNode; children: React.ReactNode }) {
  return (
    <div className="ltr-form__field">
      <label className="ltr-form__label">{label}</label>
      {children}
    </div>
  );
}

export function CoinSelect({
  value,
  options,
  onChange,
}: {
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);
  return (
    <div className="ltr-form__coin-wrap" ref={wrapRef}>
      <button
        className="ltr-form__trailing"
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <span>{value}</span>
        <Caret />
      </button>
      {open && (
        <div className="ltr-form__coin-menu">
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              className="ltr-form__coin-item"
              onClick={() => {
                onChange(opt);
                setOpen(false);
              }}
            >
              <span>{opt}</span>
              {opt === value && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function UnitSelect({ unit }: { unit: string }) {
  return (
    <button className="ltr-form__trailing" type="button">
      <span>{unit}</span>
      <Caret />
    </button>
  );
}

function Caret() {
  return (
    <svg width="10" height="10" viewBox="0 0 256 256" fill="currentColor">
      <path d="M213.66,101.66l-80,80a8,8,0,0,1-11.32,0l-80-80A8,8,0,0,1,53.66,90.34L128,164.69l74.34-74.35a8,8,0,0,1,11.32,11.32Z" />
    </svg>
  );
}

export function Row({ label, value, valueLink }: { label: ReactNode; value: React.ReactNode; valueLink?: boolean }) {
  return (
    <div className="ltr-form__row">
      <p className="ltr-form__row-label">{label}</p>
      <span className={valueLink ? "ltr-form__row-link" : "ltr-form__row-value"}>{value}</span>
    </div>
  );
}
