import { Trans } from "@lingui/macro";
import { useLingui } from "@lingui/react";
import { useMemo } from "react";

import type { BottomTabFilterMode, OpenOrdersMarketFilter } from "./BottomTabs";
import styles from "./OrderHistoryTab.module.scss";
import { type LighterOrderHistoryRow, useOrderHistoryAdapter } from "../../adapters/useOrderHistoryAdapter";

type Row = {
  market: string;
  side: "long" | "short" | "--";
  date: string;
  type: string;
  amount: string;
  filled: string;
  price: string;
  average: string;
  reduceOnly: string;
  status: string;
};

function formatNumber(value: number | null | undefined, maximumFractionDigits = 4) {
  if (value == null || !Number.isFinite(value)) return "--";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(value);
}

function formatPrice(value: number | null | undefined, maximumFractionDigits = 6) {
  if (value == null || !Number.isFinite(value) || value <= 0) return "--";
  // toFixed 保留末尾 0(例 74293.050000),统一去尾零并剪掉空 "."
  const fixed = Number(value).toFixed(Math.min(maximumFractionDigits, 6));
  return fixed.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}

function formatDate(timestamp: number) {
  if (!timestamp) return "--";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "--";
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const year = date.getFullYear();
  const hour = `${date.getHours()}`.padStart(2, "0");
  const minute = `${date.getMinutes()}`.padStart(2, "0");
  const second = `${date.getSeconds()}`.padStart(2, "0");
  return `${month}/${day}/${year} ${hour}:${minute}:${second}`;
}

/**
 * Order History 里这几个短词(Yes/No/Filled/Cancelled/Rejected/Expired)
 * 之前走 Lingui 的 t`...` 宏时会跟项目内其他同文本条目合并到同一 catalog 条目,
 * 结果英文 locale 下被 zh 翻译覆盖。这里直接按 locale 选静态映射,绕过 catalog,
 * 保证 en 显英文、zh 显中文,两边都稳。后续要加新语言就在这里加一列。
 */
type Locale = "en" | "zh" | string;
// 项目 zh 包是繁体(已存在条目均为繁體),这里跟随繁体用字,保持整体风格一致。
const ORDER_HISTORY_LABELS = {
  yes: { en: "Yes", zh: "是" },
  no: { en: "No", zh: "否" },
  filled: { en: "Filled", zh: "已成交" },
  cancelled: { en: "Cancelled", zh: "已取消" },
  rejected: { en: "Rejected", zh: "已拒絕" },
  expired: { en: "Expired", zh: "已過期" },
  market: { en: "Market", zh: "市價" },
  limit: { en: "Limit", zh: "限價" },
} as const;

function pickLabel(key: keyof typeof ORDER_HISTORY_LABELS, locale: Locale): string {
  const entry = ORDER_HISTORY_LABELS[key];
  if (locale.startsWith("zh")) return entry.zh;
  return entry.en;
}

function toOrderTypeLabel(type: string, locale: Locale): string {
  const key = type.trim().toLowerCase();
  if (key === "market") return pickLabel("market", locale);
  if (key === "limit") return pickLabel("limit", locale);
  return type || "--";
}

function toRow(order: LighterOrderHistoryRow, i18n: ReturnType<typeof useLingui>["i18n"]): Row {
  const reduceOnlyLabel =
    order.reduceOnly == null ? "--" : order.reduceOnly ? pickLabel("yes", i18n.locale) : pickLabel("no", i18n.locale);

  const statusLabel =
    order.status === "filled" ||
    order.status === "cancelled" ||
    order.status === "rejected" ||
    order.status === "expired"
      ? pickLabel(order.status, i18n.locale)
      : "--";

  return {
    market: order.market,
    side: order.side,
    date: formatDate(order.date),
    type: toOrderTypeLabel(order.type, i18n.locale),
    amount: formatNumber(order.amount, 4),
    filled: formatNumber(order.filled, 4),
    price: formatPrice(order.price),
    average: formatPrice(order.average),
    reduceOnly: reduceOnlyLabel,
    status: statusLabel,
  };
}

export function OrderHistoryTab({
  mode = "all",
  marketFilter = "All",
}: {
  mode?: BottomTabFilterMode;
  marketFilter?: OpenOrdersMarketFilter;
}) {
  const { i18n } = useLingui();
  const orders = useOrderHistoryAdapter();
  const rows = useMemo(() => {
    const filteredOrders = orders.filter((order) => {
      if (marketFilter !== "All" && order.market !== marketFilter) return false;
      if (mode === "all") return true;
      if (mode === "asks") return order.side === "short";
      return order.side === "long";
    });
    return filteredOrders.map((order) => toRow(order, i18n));
  }, [i18n, marketFilter, mode, orders]);

  return (
    <div className={styles.root}>
      <table className={styles.table}>
        <colgroup>
          <col className={styles.colMarket} />
          <col className={styles.colSide} />
          <col className={styles.colDate} />
          <col className={styles.colType} />
          <col className={styles.colAmount} />
          <col className={styles.colFilled} />
          <col className={styles.colPrice} />
          <col className={styles.colAverage} />
          <col className={styles.colReduceOnly} />
          <col className={styles.colStatus} />
        </colgroup>
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
              <Trans>Average</Trans>
            </th>
            <th>
              <Trans>Reduce Only</Trans>
            </th>
            <th>
              <Trans>Status</Trans>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            return (
              <tr key={`${row.market}-${index}`}>
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
                <td className={`${styles.mono} ${row.date === "--" ? styles.placeholder : ""}`}>{row.date}</td>
                <td className={row.type === "--" ? styles.placeholder : ""}>{row.type}</td>
                <td className={`${styles.mono} ${row.amount === "--" ? styles.placeholder : ""}`}>{row.amount}</td>
                <td className={`${styles.mono} ${row.filled === "--" ? styles.placeholder : ""}`}>{row.filled}</td>
                <td className={`${styles.mono} ${row.price === "--" ? styles.placeholder : ""}`}>{row.price}</td>
                <td className={`${styles.mono} ${row.average === "--" ? styles.placeholder : ""}`}>{row.average}</td>
                <td className={row.reduceOnly === "--" ? styles.placeholder : ""}>{row.reduceOnly}</td>
                <td className={`${styles.status} ${row.status === "--" ? styles.placeholder : ""}`}>{row.status}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
