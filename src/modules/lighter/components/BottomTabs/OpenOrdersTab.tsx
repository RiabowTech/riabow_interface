import { Trans, t } from "@lingui/macro";
import { useLingui } from "@lingui/react";
import { useCallback, useMemo, useState } from "react";

import type { BottomTabFilterMode, OpenOrdersMarketFilter, OpenOrdersTypeFilter } from "./BottomTabs";
import { ModifyOrderModal } from "./ModifyOrderModal";
import styles from "./OpenOrdersTab.module.scss";
import { useOpenOrdersAdapter, type LighterOpenOrder } from "../../adapters/useOpenOrdersAdapter";
import { useCancelApiOrder } from "../../hooks/useCancelApiOrder";

type OpenOrderRow = {
  market: string;
  side: "long" | "short" | "-";
  date: string;
  type: string;
  amount: string;
  filled: string;
  price: string;
  markPrice: string;
  reduceOnly: string;
  margin: string;
  triggerConditions: string;
  expiresIn: string;
  tpSl: string;
};

const OPEN_ORDER_TYPE_LABELS: Record<
  "S/L Market" | "S/L Limit" | "T/P Market" | "T/P Limit",
  { en: string; zh: string }
> = {
  "S/L Market": { en: "S/L Market", zh: "止損市價單" },
  "S/L Limit": { en: "S/L Limit", zh: "止損限價單" },
  "T/P Market": { en: "T/P Market", zh: "止盈市價單" },
  "T/P Limit": { en: "T/P Limit", zh: "止盈限價單" },
};

function pickOpenOrderTypeLabel(
  type: keyof typeof OPEN_ORDER_TYPE_LABELS,
  locale: string
) {
  const entry = OPEN_ORDER_TYPE_LABELS[type];
  return locale.startsWith("zh") ? entry.zh : entry.en;
}

function formatNumber(value: number | null | undefined, maximumFractionDigits = 4) {
  if (value == null || !Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(value);
}

function formatPrice(value: number | null | undefined, maximumFractionDigits = 6) {
  if (value == null || !Number.isFinite(value) || value <= 0) return "-";
  // toFixed 会保留末尾 0(如 "73000.000000") —— 截断 decimal 部分的末尾 0,并去掉空 "."
  const fixed = Number(value).toFixed(Math.min(maximumFractionDigits, 6));
  return fixed.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}

function formatTrigger(value: string | number | null | undefined, maximumFractionDigits = 6) {
  if (value == null || value === "") return "-";
  const n = typeof value === "number" ? value : Number(value);
  return formatPrice(n, maximumFractionDigits);
}

function getTypeLabel(order: LighterOpenOrder, i18n: ReturnType<typeof useLingui>["i18n"]) {
  switch (order.triggerType) {
    case "StopLoss":
      return pickOpenOrderTypeLabel("S/L Market", i18n.locale);
    case "StopLimit":
      return pickOpenOrderTypeLabel("S/L Limit", i18n.locale);
    case "TakeProfit":
      return pickOpenOrderTypeLabel("T/P Market", i18n.locale);
    case "TakeProfitLimit":
      return pickOpenOrderTypeLabel("T/P Limit", i18n.locale);
    case "TrailingStop":
      return pickOpenOrderTypeLabel("S/L Market", i18n.locale);
    default:
      return order.type === "limit" ? i18n._(t`Limit`) : i18n._(t`Market`);
  }
}

function formatUsd(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "-";
  return `$${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)}`;
}

function formatDate(timestamp: number) {
  if (!timestamp) return "-";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "-";
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const year = date.getFullYear();
  const hour = `${date.getHours()}`.padStart(2, "0");
  const minute = `${date.getMinutes()}`.padStart(2, "0");
  const second = `${date.getSeconds()}`.padStart(2, "0");
  return `${month}/${day}/${year} ${hour}:${minute}:${second}`;
}

function EditOrderIcon() {
  return (
    <span className={styles.actionIcon}>
      <svg viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
        <rect width="256" height="256" fill="none" />
        <path
          d="M96,216H48a8,8,0,0,1-8-8V163.31a8,8,0,0,1,2.34-5.65L165.66,34.34a8,8,0,0,1,11.31,0L221.66,79a8,8,0,0,1,0,11.31Z"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="16"
        />
        <line
          x1="216"
          y1="216"
          x2="96"
          y2="216"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="16"
        />
        <line
          x1="136"
          y1="64"
          x2="192"
          y2="120"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="16"
        />
      </svg>
    </span>
  );
}

function CancelOrderIcon() {
  return (
    <span className={styles.actionIcon}>
      <svg viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
        <rect width="256" height="256" fill="none" />
        <line
          x1="200"
          y1="56"
          x2="56"
          y2="200"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="16"
        />
        <line
          x1="200"
          y1="200"
          x2="56"
          y2="56"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="16"
        />
      </svg>
    </span>
  );
}

function LoadingSpinnerIcon() {
  return (
    <span className={styles.actionIcon}>
      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className={styles.loadingSpinner}>
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2" />
        <path d="M12 3a9 9 0 0 1 9 9" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
      </svg>
    </span>
  );
}

function toRow(order: LighterOpenOrder, i18n: ReturnType<typeof useLingui>["i18n"]): OpenOrderRow {
  return {
    market: order.market,
    side: order.side,
    date: formatDate(order.createdAt),
    type: getTypeLabel(order, i18n),
    amount: formatNumber(order.amount, 4),
    filled: order.filled == null || order.filled === 0 ? "-" : formatNumber(order.filled, 4),
    price: formatPrice(order.price),
    markPrice: formatPrice(order.markPrice),
    reduceOnly: order.reduceOnly == null ? "-" : order.reduceOnly ? i18n._(t`Yes`) : i18n._(t`No`),
    margin: formatUsd(order.margin),
    triggerConditions: formatTrigger(order.triggerConditions),
    expiresIn: order.expiresIn ?? "-",
    tpSl:
      order.takeProfit != null || order.stopLoss != null
        ? `${order.takeProfit != null ? formatPrice(order.takeProfit) : "-"} / ${order.stopLoss != null ? formatPrice(order.stopLoss) : "-"}`
        : "- / -",
  };
}

function matchesTypeFilter(order: LighterOpenOrder, filter: OpenOrdersTypeFilter) {
  if (filter === "All") return true;
  if (filter === "Limit") return order.type === "limit" && order.triggerType == null;
  if (filter === "S/L Market") return order.triggerType === "StopLoss" || order.triggerType === "TrailingStop";
  if (filter === "S/L Limit") return order.triggerType === "StopLimit";
  if (filter === "T/P Market") return order.triggerType === "TakeProfit";
  if (filter === "T/P Limit") return order.triggerType === "TakeProfitLimit";
  return false;
}

export function OpenOrdersTab({
  mode = "all",
  marketFilter = "All",
  typeFilter = "All",
}: {
  mode?: BottomTabFilterMode;
  marketFilter?: OpenOrdersMarketFilter;
  typeFilter?: OpenOrdersTypeFilter;
}) {
  const { i18n } = useLingui();
  const [editingOrderId, setEditingOrderId] = useState<string>();
  const [closingOrderId, setClosingOrderId] = useState<string>();
  const orders = useOpenOrdersAdapter();
  const { cancel } = useCancelApiOrder();
  const filteredOrders = useMemo(() => {
    return orders
      .filter((order) => {
        if (mode === "all") return true;
        if (mode === "asks") return order.side === "short";
        return order.side === "long";
      })
      .filter((order) => (marketFilter === "All" ? true : order.market === marketFilter))
      .filter((order) => matchesTypeFilter(order, typeFilter));
  }, [marketFilter, mode, orders, typeFilter]);

  const handleCancelOrder = useCallback(
    async (order: LighterOpenOrder) => {
      if (closingOrderId) return;

      try {
        setClosingOrderId(order.id);
        await cancel({ id: order.id, trigger_type: order.triggerType });
      } catch (error) {
        void error;
      } finally {
        setClosingOrderId(undefined);
      }
    },
    [cancel, closingOrderId]
  );

  return (
    <div className={styles.root}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>
              <Trans>Market</Trans>
            </th>
            <th>
              <Trans>Side</Trans>
            </th>
            <th>
              <span className={styles.sortHeader}>
                <span>
                  <Trans>Date</Trans>
                </span>
                <span className={styles.sortCaret}>⌄</span>
              </span>
            </th>
            <th>
              <Trans>Type</Trans>
            </th>
            <th>
              <Trans>Amount</Trans>
            </th>
            <th>
              <Trans>Filled</Trans>
            </th>
            <th>
              <Trans>Price</Trans>
            </th>
            <th>
              <Trans>Mark Price</Trans>
            </th>
            <th>
              <Trans>Reduce Only</Trans>
            </th>
            <th>
              <Trans>Margin</Trans>
            </th>
            <th>
              <Trans>Trigger Conditions</Trans>
            </th>
            {/* Expires in 列暂时下线:后端未提供到期字段,先保留表头 JSX 供后续打开
            <th>
              <Trans>Expires in</Trans>
            </th>
            */}
            <th>
              <Trans>TP / SL</Trans>
            </th>
            <th className={styles.cancelAllHeader}>
              <Trans>Cancel All</Trans>
            </th>
          </tr>
        </thead>
        <tbody>
          {filteredOrders.map((order, index) => {
            const row = toRow(order, i18n);
            const isClosing = closingOrderId === order.id;
            return (
              <tr key={order.id ?? `${row.market}-${index}`}>
                <td>
                  <span
                    className={
                      row.side === "short"
                        ? `${styles.marketCell} ${styles.marketCellShort}`
                        : `${styles.marketCell} ${styles.marketCellLong}`
                    }
                  >
                    <span className={styles.marketStripe} />
                    <span className={styles.marketContent}>
                      <span className={styles.market}>{row.market}</span>
                    </span>
                  </span>
                </td>
                <td className={row.side === "long" ? styles.sideLong : styles.sideShort}>
                  {row.side === "long" ? <Trans>Long</Trans> : <Trans>Short</Trans>}
                </td>
                <td className={`${styles.mono} ${row.date === "-" ? styles.placeholder : ""}`}>{row.date}</td>
                <td className={row.type === "-" ? styles.placeholder : ""}>{row.type}</td>
                <td className={`${styles.mono} ${row.amount === "-" ? styles.placeholder : ""}`}>{row.amount}</td>
                <td className={`${styles.mono} ${row.filled === "-" ? styles.placeholder : ""}`}>{row.filled}</td>
                <td className={`${styles.mono} ${row.price === "-" ? styles.placeholder : ""}`}>{row.price}</td>
                <td className={`${styles.mono} ${row.markPrice === "-" ? styles.placeholder : ""}`}>{row.markPrice}</td>
                <td className={row.reduceOnly === "-" ? styles.placeholder : ""}>{row.reduceOnly}</td>
                <td className={`${styles.mono} ${row.margin === "-" ? styles.placeholder : ""}`}>{row.margin}</td>
                <td className={row.triggerConditions === "-" ? styles.placeholder : ""}>{row.triggerConditions}</td>
                {/* Expires in 对应数据列下线,配合表头一起注释。
                <td className={row.expiresIn === "-" ? styles.placeholder : ""}>{row.expiresIn}</td>
                */}
                <td className={row.tpSl === "-" ? styles.placeholder : ""}>{row.tpSl}</td>
                <td className={styles.cancelActions}>
                  <button
                    type="button"
                    className={styles.editAction}
                    disabled={isClosing}
                    onClick={() => setEditingOrderId(order.id)}
                  >
                    <EditOrderIcon />
                  </button>
                  <button
                    type="button"
                    className={styles.cancelAction}
                    disabled={isClosing}
                    onClick={() => void handleCancelOrder(order)}
                  >
                    {isClosing ? <LoadingSpinnerIcon /> : <CancelOrderIcon />}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <ModifyOrderModal orderId={editingOrderId} onClose={() => setEditingOrderId(undefined)} />
    </div>
  );
}
