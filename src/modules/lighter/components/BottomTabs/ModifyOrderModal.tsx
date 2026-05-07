import { Trans, t } from "@lingui/macro";
import { useLingui } from "@lingui/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSWRConfig } from "swr";
import { useAccount } from "wagmi";

import { updateOrder } from "@/modules/lighter/api/custom/client";
import { useApiOrders } from "@/modules/lighter/api/custom/useApiOrders";
import { symbolToMarket } from "@/modules/lighter/adapters/lighterOpenOrders";
import { useChainId } from "lib/chains";
import { helperToast } from "lib/helperToast";

import Modal from "components/Modal/Modal";

import { AmountUnit, convertAmountValue, formatAmountValue } from "./modifyOrderAmount";
import styles from "./OpenOrdersTab.module.scss";

type SimpleOrderTypeKey = "limit" | "market" | "trigger";

function getSimpleOrderTypeKey(orderType?: string): SimpleOrderTypeKey {
  switch ((orderType || "").toLowerCase()) {
    case "limit":
    case "take_profit":
    case "take_profit_limit":
      return "limit";
    case "market":
      return "market";
    case "stop_market":
    case "stop_limit":
      return "trigger";
    default:
      return "limit";
  }
}

type Props = {
  orderId?: string;
  onClose: () => void;
};

export function ModifyOrderModal({ orderId, onClose }: Props) {
  const { i18n } = useLingui();
  const { chainId } = useChainId();
  const { address } = useAccount();
  const { mutate } = useSWRConfig();
  const { apiOrders } = useApiOrders(chainId, address);

  const apiOrder = useMemo(() => {
    if (!orderId || !apiOrders) return undefined;
    return apiOrders.find((item) => String(item.id) === orderId);
  }, [apiOrders, orderId]);

  const [priceInputValue, setPriceInputValue] = useState("");
  const [amountInputValue, setAmountInputValue] = useState("");
  const [amountUnit, setAmountUnit] = useState<AmountUnit>("symbol");
  const [isAmountUnitMenuOpen, setIsAmountUnitMenuOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const amountUnitMenuRef = useRef<HTMLDivElement>(null);

  const marketSymbol = apiOrder?.symbol ? symbolToMarket(apiOrder.symbol) : "-";
  const markPriceText = apiOrder?.mark_price ? formatAmountValue(apiOrder.mark_price) : "-";
  const orderTypeKey = getSimpleOrderTypeKey(apiOrder?.order_type);
  const orderTypeLabel =
    orderTypeKey === "limit" ? i18n._(t`Limit`) : orderTypeKey === "market" ? i18n._(t`Market`) : i18n._(t`Trigger`);

  useEffect(() => {
    if (!apiOrder) return;

    setPriceInputValue(formatAmountValue(apiOrder.price ?? apiOrder.trigger_price ?? ""));
    // 后端 Order 只返回 `size`(USD),没有 `amount`(BTC)。默认用 USD 展示,避免把 USD 数值挂成 BTC 单位。
    // 用户可在 dropdown 切到 symbol,由 convertAmountValue 用 price 做换算。
    setAmountUnit("usd");
    setAmountInputValue(formatAmountValue(apiOrder.size ?? ""));
  }, [apiOrder]);

  useEffect(() => {
    if (!isAmountUnitMenuOpen) return undefined;

    function handlePointerDown(event: MouseEvent) {
      if (amountUnitMenuRef.current?.contains(event.target as Node)) return;
      setIsAmountUnitMenuOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isAmountUnitMenuOpen]);

  const normalizedPrice = priceInputValue.trim();
  const normalizedAmount = amountInputValue.trim();
  const currentAmountUnitLabel = amountUnit === "symbol" ? marketSymbol : "USD";
  const effectivePrice = normalizedPrice || apiOrder?.price || apiOrder?.mark_price || "";
  const originalAmountValue = amountUnit === "symbol" ? String(apiOrder?.amount ?? "") : String(apiOrder?.size ?? "");

  const error = useMemo(() => {
    if (!apiOrder) return i18n._(t`Unknown order`);
    if (!normalizedPrice) return i18n._(t`Enter a price`);
    if (!normalizedAmount) return i18n._(t`Enter an amount`);

    const isPriceChanged = normalizedPrice !== String(apiOrder.price ?? apiOrder.trigger_price ?? "");
    const isAmountChanged = normalizedAmount !== originalAmountValue;

    if (!isPriceChanged && !isAmountChanged) return i18n._(t`Enter a new size or price`);

    return undefined;
  }, [apiOrder, i18n, normalizedAmount, normalizedPrice, originalAmountValue]);

  const handleMidClick = useCallback(() => {
    if (!apiOrder?.mark_price) return;
    setPriceInputValue(apiOrder.mark_price);
  }, [apiOrder?.mark_price]);

  const handleAmountUnitChange = useCallback(
    (nextUnit: AmountUnit) => {
      if (nextUnit === amountUnit) {
        setIsAmountUnitMenuOpen(false);
        return;
      }

      setAmountInputValue((currentValue) => convertAmountValue(currentValue, amountUnit, nextUnit, effectivePrice));
      setAmountUnit(nextUnit);
      setIsAmountUnitMenuOpen(false);
    },
    [amountUnit, effectivePrice]
  );

  const handleSubmit = useCallback(async () => {
    if (!chainId || !address || !apiOrder?.id || error) return;

    const submittedAmount =
      amountUnit === "symbol"
        ? normalizedAmount
        : convertAmountValue(normalizedAmount, "usd", "symbol", effectivePrice);
    const submittedSize =
      amountUnit === "usd" ? normalizedAmount : convertAmountValue(normalizedAmount, "symbol", "usd", effectivePrice);

    setIsSubmitting(true);

    try {
      await updateOrder(
        chainId,
        apiOrder.id,
        {
          price: normalizedPrice,
          size: submittedSize,
          amount: submittedAmount,
        },
        address
      );

      await Promise.all([
        mutate(["api-orders", chainId, address], undefined, { revalidate: true }),
        mutate(["api-positions", chainId, address], undefined, { revalidate: true }),
      ]);

      helperToast.success(t`Order updated`);
      onClose();
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : i18n._(t`Failed to update order`);
      helperToast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    address,
    amountUnit,
    apiOrder?.id,
    chainId,
    effectivePrice,
    error,
    i18n,
    mutate,
    normalizedAmount,
    normalizedPrice,
    onClose,
  ]);

  if (!orderId || !apiOrder) {
    return null;
  }

  return (
    <Modal
      isVisible
      setIsVisible={(visible) => {
        if (!visible) onClose();
      }}
      label={i18n._(t`Modify Order`)}
      contentPadding={false}
      qa="lighter-modify-order-modal"
      contentClassName={styles.modifyOrderModalContent}
      className={styles.modifyOrderModal}
      disableOverflowHandling
    >
      <div className={styles.modifyOrderBody}>
        <div className={styles.modifyOrderInfoGrid}>
          <div className={styles.modifyOrderInfoRow}>
            <span className={styles.modifyOrderLabel}>
              <Trans>Order Type</Trans>
            </span>
            <span className={styles.modifyOrderValue}>{orderTypeLabel}</span>
          </div>
          <div className={styles.modifyOrderInfoRow}>
            <span className={styles.modifyOrderLabel}>
              <Trans>Market</Trans>
            </span>
            <span className={styles.modifyOrderValue}>{marketSymbol}</span>
          </div>
          <div className={styles.modifyOrderInfoRow}>
            <span className={styles.modifyOrderLabel}>
              <Trans>Mark Price</Trans>
            </span>
            <span className={styles.modifyOrderValue}>{markPriceText}</span>
          </div>
        </div>

        <div className={styles.modifyOrderField}>
          <span className={styles.modifyOrderFieldLabel}>
            <Trans>Price</Trans>
          </span>
          <div className={styles.modifyOrderFieldValue}>
            <input
              value={priceInputValue}
              onChange={(event) => setPriceInputValue(event.target.value)}
              className={styles.modifyOrderInput}
              inputMode="decimal"
            />
            <button type="button" className={styles.modifyOrderHint} onClick={handleMidClick}>
              <Trans>Mid</Trans>
            </button>
          </div>
        </div>

        <div className={styles.modifyOrderField} ref={amountUnitMenuRef}>
          <span className={styles.modifyOrderFieldLabel}>
            <Trans>Amount</Trans>
          </span>
          <div className={styles.modifyOrderFieldValue}>
            <input
              value={amountInputValue}
              onChange={(event) => setAmountInputValue(event.target.value)}
              className={styles.modifyOrderInput}
              inputMode="decimal"
            />
            <button
              type="button"
              className={styles.modifyOrderUnitButton}
              onClick={() => setIsAmountUnitMenuOpen((prev) => !prev)}
              aria-expanded={isAmountUnitMenuOpen}
            >
              <span>{currentAmountUnitLabel}</span>
              <span className={styles.modifyOrderUnitCaret}>
                <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 256 256">
                  <path d="M213.66,101.66l-80,80a8,8,0,0,1-11.32,0l-80-80A8,8,0,0,1,53.66,90.34L128,164.69l74.34-74.35a8,8,0,0,1,11.32,11.32Z" />
                </svg>
              </span>
            </button>
            {isAmountUnitMenuOpen && (
              <div className={styles.modifyOrderUnitMenu}>
                <button
                  type="button"
                  className={styles.modifyOrderUnitOption}
                  onClick={() => handleAmountUnitChange("symbol")}
                >
                  <span>{marketSymbol}</span>
                  {amountUnit === "symbol" && (
                    <span className={styles.modifyOrderUnitCheck}>
                      <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 256 256">
                        <path d="M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z" />
                      </svg>
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  className={styles.modifyOrderUnitOption}
                  onClick={() => handleAmountUnitChange("usd")}
                >
                  <span>USD</span>
                  {amountUnit === "usd" && (
                    <span className={styles.modifyOrderUnitCheck}>
                      <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 256 256">
                        <path d="M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z" />
                      </svg>
                    </span>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          className={styles.modifyOrderSubmit}
          disabled={Boolean(error) || isSubmitting}
          onClick={handleSubmit}
        >
          {isSubmitting ? <Trans>Submitting...</Trans> : <Trans>Modify Order</Trans>}
        </button>
      </div>
    </Modal>
  );
}
