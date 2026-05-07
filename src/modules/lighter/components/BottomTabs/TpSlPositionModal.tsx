import { Trans, t } from "@lingui/macro";
import { useLingui } from "@lingui/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSWRConfig } from "swr";
import { useAccount } from "wagmi";

import { getPositionTpSl, setPositionTpSl } from "@/modules/lighter/api/custom/client";
import type { TpSlRequest, TpSlResponse } from "@/modules/lighter/api/types";
import { useChainId } from "lib/chains";
import { helperToast } from "lib/helperToast";

import Modal from "components/Modal/Modal";

import styles from "./TpSlPositionModal.module.scss";
import type { LighterPosition } from "../../adapters/usePositionsAdapter";
import { Checkbox } from "../Checkbox/Checkbox";

type Props = {
  position?: LighterPosition;
  onClose: () => void;
};

type PositionMode = "entire" | "partial";

function parseNullableNumber(value: string | number | null | undefined) {
  if (value == null || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * 后端返回的价格字符串通常是 18 位 decimal 填 0 的格式(如 "76000.000000000000000000")。
 * 直接塞进 input 会被 ellipsis 截掉,且用户看不出真实值。
 * 这里把末尾 0 去掉,纯整数时把 "." 也去掉。非数字字符串保持原样。
 */
function trimTrailingZeros(value: string | number | null | undefined): string {
  if (value == null || value === "") return "";
  const str = typeof value === "number" ? String(value) : value;
  if (!/^-?\d+(\.\d+)?$/.test(str)) return str;
  return str.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}

function formatNumber(value: number, maximumFractionDigits = 6) {
  if (!Number.isFinite(value)) return "-";
  const text = value.toFixed(maximumFractionDigits);
  return text
    .replace(/(\.\d*?[1-9])0+$/u, "$1")
    .replace(/\.0+$/u, "")
    .replace(/^0$/, "0");
}

function formatPrice(value: number | null | undefined, maximumFractionDigits = 6) {
  if (value == null || !Number.isFinite(value) || value <= 0) return "-";
  return formatNumber(value, maximumFractionDigits);
}

function parseLeverage(raw: string | null | undefined): number {
  if (!raw) return 1;
  const parsed = parseFloat(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

/**
 * 通过"相对保证金 ROI 百分比"反推 TP / SL 触发价。
 * - longSign 约定:TP 时 long=+1 / short=-1(盈利方向价格变化);SL 时 long=-1 / short=+1。
 * - 公式假设:保证金收益率 = 价格变化率 × 杠杆。leverage=0 或 entry<=0 时返回 null。
 */
function priceFromPercent(entry: number, leverage: number, percent: number, directionSign: 1 | -1): number | null {
  if (!Number.isFinite(entry) || entry <= 0 || leverage <= 0) return null;
  const pct = Number.isFinite(percent) ? percent : 0;
  const priceMovePct = pct / 100 / leverage;
  const next = entry * (1 + directionSign * priceMovePct);
  return Number.isFinite(next) && next > 0 ? next : null;
}

/** 反向:价格 → 相对保证金 ROI 百分比(0-100 会被切回到 0-100,供滑块使用)。 */
function percentFromPrice(entry: number, leverage: number, priceText: string, directionSign: 1 | -1): number | null {
  const price = Number(priceText);
  if (!Number.isFinite(entry) || entry <= 0 || leverage <= 0) return null;
  if (!Number.isFinite(price) || price <= 0) return null;
  const priceMovePct = (price / entry - 1) * directionSign;
  const roiPct = priceMovePct * leverage * 100;
  return Number.isFinite(roiPct) ? roiPct : null;
}

function formatPercent(percent: number): string {
  if (!Number.isFinite(percent)) return "0.00 %";
  return `${percent.toFixed(2)} %`;
}

function CaretIcon() {
  return (
    <span className={styles.caretIcon}>
      <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 256 256">
        <path d="M213.66,101.66l-80,80a8,8,0,0,1-11.32,0l-80-80A8,8,0,0,1,53.66,90.34L128,164.69l74.34-74.35a8,8,0,0,1,11.32,11.32Z" />
      </svg>
    </span>
  );
}

function Slider({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  useEffect(() => {
    const handleMove = (event: MouseEvent) => {
      if (!draggingRef.current || !trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const next = Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100));
      onChange(Math.round(next));
    };

    const handleUp = () => {
      draggingRef.current = false;
    };

    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleUp);

    return () => {
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleUp);
    };
  }, [onChange]);

  const rangeStyle = useMemo(() => ({ width: `${value}%` }), [value]);
  const thumbStyle = useMemo(() => ({ left: `calc(${value}% - 4px)` }), [value]);

  return (
    <div
      ref={trackRef}
      className={styles.slider}
      onMouseDown={(event) => {
        draggingRef.current = true;
        const rect = event.currentTarget.getBoundingClientRect();
        const next = Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100));
        onChange(Math.round(next));
      }}
    >
      <div className={styles.sliderTrack} />
      <div className={styles.sliderTicks}>
        {Array.from({ length: 5 }).map((_, index) => (
          <span key={index} className={styles.sliderTick} />
        ))}
      </div>
      <div className={styles.sliderRange} style={rangeStyle} />
      <div className={styles.sliderThumb} style={thumbStyle} />
    </div>
  );
}

export function TpSlPositionModal({ position, onClose }: Props) {
  const { i18n } = useLingui();
  const { chainId } = useChainId();
  const { address } = useAccount();
  const { mutate } = useSWRConfig();
  const [mode, setMode] = useState<PositionMode>("entire");
  const [partialPercent, setPartialPercent] = useState(0);
  const [tpPercent, setTpPercent] = useState(0);
  const [slPercent, setSlPercent] = useState(0);
  const [tpPrice, setTpPrice] = useState("");
  const [tpLimitPrice, setTpLimitPrice] = useState("");
  const [slPrice, setSlPrice] = useState("");
  const [slLimitPrice, setSlLimitPrice] = useState("");
  const [tpLimit, setTpLimit] = useState(false);
  const [slLimit, setSlLimit] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 持仓的 USD 大小会随 SWR 轮询持续变化,但 applyTpSl 只需要最新的值做换算,不应触发重渲染/副作用。
  // 用 ref 持有最新 size,避免把 position.size 放进 useEffect 依赖数组导致状态被反复重置。
  const positionSizeRef = useRef(position?.size ?? 0);
  useEffect(() => {
    positionSizeRef.current = position?.size ?? 0;
  }, [position?.size]);

  // 表单重置只发生在"切换到另一个持仓"时(positionId 不同),而不是整个 position 对象引用变更。
  // 之前依赖 [position] 会让 SWR 每次 refetch 生成新对象 → useEffect 重跑 → 把用户刚点的 "Partial" 拨回 "Entire"。
  useEffect(() => {
    if (!position?.positionId) return;
    setMode("entire");
    setPartialPercent(0);
    setTpPercent(0);
    setSlPercent(0);
    setTpPrice("");
    setTpLimitPrice("");
    setSlPrice("");
    setSlLimitPrice("");
    setTpLimit(false);
    setSlLimit(false);
  }, [position?.positionId]);

  useEffect(() => {
    if (!position?.positionId || !chainId || !address) return;

    let cancelled = false;

    const applyTpSl = (data: TpSlResponse) => {
      if (cancelled) return;

      const nextTpPrice = data.take_profit_price ?? "";
      const nextSlPrice = data.stop_loss_price ?? "";
      const nextTpLimitPrice = data.take_profit_limit_price ?? "";
      const nextSlLimitPrice = data.stop_loss_limit_price ?? "";
      const nextTpSize = parseNullableNumber(data.take_profit_size);
      const nextSlSize = parseNullableNumber(data.stop_loss_size);
      const nextPartialUsdSize = [nextTpSize, nextSlSize].find((value) => value != null && value > 0) ?? null;

      setTpPrice(trimTrailingZeros(nextTpPrice));
      setSlPrice(trimTrailingZeros(nextSlPrice));
      setTpLimitPrice(trimTrailingZeros(nextTpLimitPrice));
      setSlLimitPrice(trimTrailingZeros(nextSlLimitPrice));
      setTpLimit(Boolean(nextTpLimitPrice));
      setSlLimit(Boolean(nextSlLimitPrice));

      // 从服务端回填价后,同步滑块百分比,保证 UI 与数据一致(滑块值限制在 0-100)。
      const tpPctDerived = percentFromPrice(entryPrice, leverage, String(nextTpPrice), tpDirection);
      if (tpPctDerived != null) setTpPercent(Math.max(0, Math.min(100, Math.round(tpPctDerived))));
      const slPctDerived = percentFromPrice(entryPrice, leverage, String(nextSlPrice), slDirection);
      if (slPctDerived != null) setSlPercent(Math.max(0, Math.min(100, Math.round(slPctDerived))));

      const latestSize = positionSizeRef.current;
      if (nextPartialUsdSize && latestSize > 0) {
        setMode("partial");
        setPartialPercent(Math.max(0, Math.min(100, Math.round((nextPartialUsdSize / latestSize) * 100))));
      } else {
        setMode("entire");
        setPartialPercent(0);
      }
    };

    const loadTpSl = async () => {
      try {
        const data = await getPositionTpSl(chainId, position.positionId, address);
        applyTpSl(data);
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "";
        if (message.includes("404")) return;
      }
    };

    loadTpSl();

    return () => {
      cancelled = true;
    };
    // 只依赖 positionId,不依赖 position.size —— 避免轮询刷新时把用户已手动切换的 mode 拨回去。
  }, [address, chainId, position?.positionId]);

  // ─── TP/SL 滑块 ↔ 价格 双向同步 ──────────────────────────────────
  // 方向约定:盈利方向 = (long=+1, short=-1);亏损方向 = 相反。
  // 保证金 ROI% 的公式:price = entry * (1 + direction * (roi/100)/leverage)。
  const leverage = parseLeverage(position?.leverage);
  const entryPrice = position?.entryPrice ?? 0;
  const isLong = position?.side === "long";
  const tpDirection: 1 | -1 = isLong ? 1 : -1;
  const slDirection: 1 | -1 = isLong ? -1 : 1;

  const writePriceFromPercent = (
    nextPercent: number,
    directionSign: 1 | -1,
    setPercent: (v: number) => void,
    setPrice: (v: string) => void
  ) => {
    setPercent(nextPercent);
    const derivedPrice = priceFromPercent(entryPrice, leverage, nextPercent, directionSign);
    if (derivedPrice != null) {
      setPrice(formatNumber(derivedPrice, 6));
    }
  };

  const writePercentFromPrice = (
    priceText: string,
    directionSign: 1 | -1,
    setPercent: (v: number) => void,
    setPrice: (v: string) => void
  ) => {
    setPrice(priceText);
    const derivedPct = percentFromPrice(entryPrice, leverage, priceText, directionSign);
    if (derivedPct == null) return;
    // 滑块范围 0-100:负值(越过 entry 反方向)和 >100 都夹到边界,价格输入本身保留用户输入不动
    const clamped = Math.max(0, Math.min(100, derivedPct));
    setPercent(Math.round(clamped));
  };

  const handleTpPercentChange = (nextPct: number) =>
    writePriceFromPercent(nextPct, tpDirection, setTpPercent, setTpPrice);
  const handleSlPercentChange = (nextPct: number) =>
    writePriceFromPercent(nextPct, slDirection, setSlPercent, setSlPrice);
  const handleTpPriceChange = (text: string) => writePercentFromPrice(text, tpDirection, setTpPercent, setTpPrice);
  const handleSlPriceChange = (text: string) => writePercentFromPrice(text, slDirection, setSlPercent, setSlPrice);

  const partialAmount = useMemo(() => {
    if (!position) return "0";
    const amount = (position.sizeTokenAmount * partialPercent) / 100;
    return formatNumber(amount, 6);
  }, [partialPercent, position]);

  const partialUsdSize = useMemo(() => {
    if (!position) return undefined;
    const usdAmount = (position.size * partialPercent) / 100;
    if (!Number.isFinite(usdAmount) || usdAmount <= 0) return undefined;
    return usdAmount;
  }, [partialPercent, position]);

  const submitError = useMemo(() => {
    if (!position?.positionId) return i18n._(t`Unknown position`);
    if (!tpPrice.trim() && !slPrice.trim()) return i18n._(t`Enter TP or SL price`);
    if (tpLimit && !tpPrice.trim()) return i18n._(t`TP limit requires TP price`);
    if (tpLimit && !tpLimitPrice.trim()) return i18n._(t`Enter TP limit price`);
    if (slLimit && !slPrice.trim()) return i18n._(t`SL limit requires SL price`);
    if (slLimit && !slLimitPrice.trim()) return i18n._(t`Enter SL limit price`);
    if (mode === "partial" && (!partialUsdSize || partialUsdSize <= 0)) return i18n._(t`Enter partial size`);
    return undefined;
  }, [
    i18n,
    mode,
    partialUsdSize,
    position?.positionId,
    slLimit,
    slLimitPrice,
    slPrice,
    tpLimit,
    tpLimitPrice,
    tpPrice,
  ]);

  const handleSubmit = async () => {
    if (!chainId || !address || !position?.positionId || submitError) return;

    const payload: TpSlRequest = {};

    // Backend rejects take_profit_size/stop_loss_size = 0(「must be greater than 0」),
    // 整仓时必须显式传完整 USD size;部分平仓传用户设定的 USD 数值。
    // 参考实现:useTradeboxTransactions 用 formatUnits(sizeInUsd, 30) 作为 size。
    const entireUsdSize = String(position.size);

    if (tpPrice.trim()) {
      payload.take_profit_price = tpPrice.trim();
      payload.take_profit_size = mode === "partial" ? String(partialUsdSize) : entireUsdSize;
      if (tpLimit && tpLimitPrice.trim()) {
        payload.take_profit_limit_price = tpLimitPrice.trim();
      }
    }

    if (slPrice.trim()) {
      payload.stop_loss_price = slPrice.trim();
      payload.stop_loss_size = mode === "partial" ? String(partialUsdSize) : entireUsdSize;
      if (slLimit && slLimitPrice.trim()) {
        payload.stop_loss_limit_price = slLimitPrice.trim();
      }
    }

    setIsSubmitting(true);
    try {
      await setPositionTpSl(chainId, position.positionId, payload, address);
      await Promise.all([
        mutate(["api-positions", chainId, address], undefined, { revalidate: true }),
        mutate(["api-orders", chainId, address], undefined, { revalidate: true }),
      ]);
      helperToast.success(t`TP/SL updated`);
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : i18n._(t`Failed to update TP/SL`);
      helperToast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!position) return null;

  return (
    <Modal
      isVisible
      setIsVisible={(visible) => {
        if (!visible) onClose();
      }}
      label={i18n._(t`TP/SL for Position`)}
      contentPadding={false}
      qa="lighter-position-tpsl-modal"
      contentClassName={`${styles.modalContent} ${mode === "entire" ? styles.modalContentEntire : styles.modalContentPartial}`}
      className={styles.modal}
      disableOverflowHandling
    >
      <div className={styles.modeTabsWrap}>
        <div className={styles.modeTabs}>
          <button
            type="button"
            className={`${styles.modeTab} ${mode === "entire" ? styles.modeTabActive : ""}`}
            onClick={() => setMode("entire")}
          >
            <Trans>Entire Position</Trans>
          </button>
          <button
            type="button"
            className={`${styles.modeTab} ${mode === "partial" ? styles.modeTabActive : ""}`}
            onClick={() => setMode("partial")}
          >
            <Trans>Partial Position</Trans>
          </button>
        </div>
      </div>
      <div className={styles.tabsDivider} />

      <div className={`${styles.body} ${mode === "entire" ? styles.bodyEntire : styles.bodyPartial}`}>
        <div
          className={styles.scrollContent}
          data-testid={mode === "entire" ? "modify-entire-position-content" : "modify-partial-position-content"}
        >
          <div className={styles.infoGrid}>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>
                <Trans>Market</Trans>
              </span>
              <span className={styles.infoValue}>{position.market}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>
                <Trans>Size</Trans>
              </span>
              <span className={`${styles.infoValue} ${position.side === "long" ? styles.up : styles.down}`}>
                {formatNumber(position.sizeTokenAmount, 6)}
              </span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>
                <Trans>Entry Price</Trans>
              </span>
              <span className={styles.infoValue}>{formatPrice(position.entryPrice)}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>
                <Trans>Mark Price</Trans>
              </span>
              <span className={styles.infoValue}>{formatPrice(position.markPrice)}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>
                <Trans>Liq. Price</Trans>
              </span>
              <span className={styles.infoValue}>{formatPrice(position.liqPrice)}</span>
            </div>
          </div>

          {mode === "partial" && (
            <>
              <div className={styles.field}>
                <span className={styles.fieldLabel}>
                  <Trans>Amount</Trans>
                </span>
                <div className={styles.fieldValue}>
                  <input value={partialAmount} readOnly className={styles.input} />
                  <span className={styles.trailingText}>{position.market}</span>
                </div>
              </div>
              <Slider value={partialPercent} onChange={setPartialPercent} />
            </>
          )}

          <section className={styles.section}>
            <div className={styles.sectionTitle}>
              <Trans>Take Profit</Trans>
            </div>
            <div className={styles.grid2}>
              <div className={styles.field}>
                <span className={styles.fieldLabel}>
                  <Trans>TP Price</Trans>
                </span>
                <div className={styles.fieldValue}>
                  <input
                    value={tpPrice}
                    onChange={(event) => handleTpPriceChange(event.target.value)}
                    className={styles.input}
                    inputMode="decimal"
                    placeholder="0.000000"
                  />
                </div>
              </div>
              <button type="button" className={`${styles.field} ${styles.selectField}`}>
                <span className={styles.fieldLabel}>
                  <Trans>Gain</Trans>
                </span>
                <div className={styles.fieldValue}>
                  <span className={styles.selectValue}>{formatPercent(tpPercent)}</span>
                  <CaretIcon />
                </div>
              </button>
            </div>
            <Slider value={tpPercent} onChange={handleTpPercentChange} />
            <div className={styles.checkboxRow}>
              <Checkbox checked={tpLimit} onChange={setTpLimit} label={i18n._(t`Limit`)} />
            </div>
            {tpLimit && (
              <div className={styles.field}>
                <span className={styles.fieldLabel}>
                  <Trans>TP Limit Price</Trans>
                </span>
                <div className={styles.fieldValue}>
                  <input
                    value={tpLimitPrice}
                    onChange={(event) => setTpLimitPrice(event.target.value)}
                    className={styles.input}
                    inputMode="decimal"
                    placeholder="0.000000"
                  />
                </div>
              </div>
            )}
            <div className={styles.infoRow}>
              <span className={`${styles.infoLabel} ${styles.secondaryLabel}`}>
                <Trans>Estimated PnL</Trans>
              </span>
              <span className={`${styles.infoValue} ${styles.lightValue}`}>
                <Trans>N/A</Trans>
              </span>
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionTitle}>
              <Trans>Stop Loss</Trans>
            </div>
            <div className={styles.grid2}>
              <div className={styles.field}>
                <span className={styles.fieldLabel}>
                  <Trans>SL Price</Trans>
                </span>
                <div className={styles.fieldValue}>
                  <input
                    value={slPrice}
                    onChange={(event) => handleSlPriceChange(event.target.value)}
                    className={styles.input}
                    inputMode="decimal"
                    placeholder="0.000000"
                  />
                </div>
              </div>
              <button type="button" className={`${styles.field} ${styles.selectField}`}>
                <span className={styles.fieldLabel}>
                  <Trans>Loss</Trans>
                </span>
                <div className={styles.fieldValue}>
                  <span className={styles.selectValue}>{formatPercent(slPercent)}</span>
                  <CaretIcon />
                </div>
              </button>
            </div>
            <Slider value={slPercent} onChange={handleSlPercentChange} />
            <div className={styles.checkboxRow}>
              <Checkbox checked={slLimit} onChange={setSlLimit} label={i18n._(t`Limit`)} />
            </div>
            {slLimit && (
              <div className={styles.field}>
                <span className={styles.fieldLabel}>
                  <Trans>SL Limit Price</Trans>
                </span>
                <div className={styles.fieldValue}>
                  <input
                    value={slLimitPrice}
                    onChange={(event) => setSlLimitPrice(event.target.value)}
                    className={styles.input}
                    inputMode="decimal"
                    placeholder="0.000000"
                  />
                </div>
              </div>
            )}
            <div className={styles.infoRow}>
              <span className={`${styles.infoLabel} ${styles.secondaryLabel}`}>
                <Trans>Estimated PnL</Trans>
              </span>
              <span className={`${styles.infoValue} ${styles.lightValue}`}>
                <Trans>N/A</Trans>
              </span>
            </div>
          </section>

          <button
            type="button"
            className={styles.submitButton}
            disabled={Boolean(submitError) || isSubmitting}
            onClick={handleSubmit}
          >
            {isSubmitting ? <Trans>Submitting...</Trans> : <Trans>Submit</Trans>}
          </button>
        </div>
      </div>
    </Modal>
  );
}
