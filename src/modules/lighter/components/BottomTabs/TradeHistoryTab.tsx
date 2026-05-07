import { Trans } from "@lingui/macro";
import { useLingui } from "@lingui/react";
import { useMemo } from "react";

import type { BottomTabFilterMode } from "./BottomTabs";
import styles from "./TradeHistoryTab.module.scss";
import { type LighterTradeHistoryRow, useTradeHistoryAdapter } from "../../adapters/useTradeHistoryAdapter";

type Row = {
  market: string;
  side: string;
  /** Locale-independent direction key for color/class lookup ("Long" | "Short" | "--"). */
  direction: string;
  /** Numeric PnL for color classification (positive = gain, negative = loss). */
  closedPnlValue: number | null;
  date: string;
  tradeValue: string;
  size: string;
  price: string;
  closedPnl: string;
  fee: string;
  role: string;
  type: string;
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
  return Number(value).toFixed(Math.min(maximumFractionDigits, 6));
}

function formatUsd(value: number | null | undefined, fractionDigits = 2) {
  if (value == null || !Number.isFinite(value)) return "--";
  return `$${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value)}`;
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
 * Trade History 的 Role / Type 两列也走静态映射,避开 Lingui catalog 冲突
 * (跟 OrderHistoryTab 同套路:短词在 catalog 里会跟项目内其他条目撞 id,
 * 切到 en 时被 zh 翻译盖掉)。zh 用繁体跟项目风格保持一致。
 */
type Locale = "en" | "zh" | string;
const TRADE_HISTORY_LABELS = {
  taker: { en: "Taker", zh: "吃單" },
  maker: { en: "Maker", zh: "掛單" },
  trade: { en: "Trade", zh: "成交" },
  liquidation: { en: "Liquidation", zh: "強平" },
  deleverage: { en: "Deleverage", zh: "自動減倉" },
  marketSettlement: { en: "Market Settlement", zh: "市場結算" },
  openLong: { en: "Open Long", zh: "開多" },
  openShort: { en: "Open Short", zh: "開空" },
  closeLong: { en: "Close Long", zh: "平多" },
  closeShort: { en: "Close Short", zh: "平空" },
} as const;

function pickTradeLabel(key: keyof typeof TRADE_HISTORY_LABELS, locale: Locale): string {
  const entry = TRADE_HISTORY_LABELS[key];
  if (locale.startsWith("zh")) return entry.zh;
  return entry.en;
}

function toRoleLabel(role: string, locale: Locale): string {
  const key = role.trim().toLowerCase();
  if (key === "taker") return pickTradeLabel("taker", locale);
  if (key === "maker") return pickTradeLabel("maker", locale);
  return role || "--";
}

function toTypeLabel(type: string, locale: Locale): string {
  const key = type
    .trim()
    .toLowerCase()
    .replace(/[_\s-]+/g, "");
  if (key === "trade") return pickTradeLabel("trade", locale);
  if (key === "liquidation") return pickTradeLabel("liquidation", locale);
  if (key === "deleverage") return pickTradeLabel("deleverage", locale);
  if (key === "marketsettlement") return pickTradeLabel("marketSettlement", locale);
  return type || "--";
}

function toSideLabel(side: string, isClose: boolean, locale: Locale): string {
  if (side === "Long") return pickTradeLabel(isClose ? "closeLong" : "openLong", locale);
  if (side === "Short") return pickTradeLabel(isClose ? "closeShort" : "openShort", locale);
  return side || "--";
}

function toRow(trade: LighterTradeHistoryRow, locale: Locale): Row {
  return {
    market: trade.market,
    side: toSideLabel(trade.side, trade.isClose, locale),
    direction: trade.side,
    closedPnlValue: trade.closedPnl,
    date: formatDate(trade.date),
    tradeValue: formatUsd(trade.tradeValue),
    size: formatNumber(trade.size, 4),
    price: formatPrice(trade.price),
    closedPnl: formatUsd(trade.closedPnl, 4),
    fee: formatUsd(trade.fee),
    role: trade.role ? toRoleLabel(trade.role, locale) : "--",
    type: trade.type ? toTypeLabel(trade.type, locale) : "--",
  };
}

export function TradeHistoryTab({
  mode = "all",
  trades: providedTrades,
}: {
  mode?: BottomTabFilterMode;
  /** 由父级提供的(已按 Type / Aggregate 预处理的)交易行。省略时走自身 adapter 兼容 /accounts 等独立用法。 */
  trades?: LighterTradeHistoryRow[];
}) {
  const { i18n } = useLingui();
  const adapterTrades = useTradeHistoryAdapter();
  const trades = providedTrades ?? adapterTrades;
  const rows = useMemo(() => {
    const filteredTrades = trades.filter((trade) => {
      if (mode === "all") return true;
      if (mode === "asks") return trade.side.includes("Short");
      return trade.side.includes("Long");
    });
    return filteredTrades.map((trade) => toRow(trade, i18n.locale));
  }, [i18n.locale, mode, trades]);

  return (
    <div className={styles.root}>
      <table className={styles.table}>
        <colgroup>
          <col className={styles.colMarket} />
          <col className={styles.colSide} />
          <col className={styles.colDate} />
          <col className={styles.colTradeValue} />
          <col className={styles.colSize} />
          <col className={styles.colPrice} />
          <col className={styles.colClosedPnl} />
          <col className={styles.colFee} />
          <col className={styles.colRole} />
          <col className={styles.colType} />
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
              <Trans>Trade Value</Trans>
            </th>
            <th>
              <Trans>Size</Trans>
            </th>
            <th>
              <Trans>Price</Trans>
            </th>
            <th>
              <Trans>Closed PnL</Trans>
            </th>
            <th>
              <Trans>Fee</Trans>
            </th>
            <th>
              <Trans>Role</Trans>
            </th>
            <th>
              <Trans>Type</Trans>
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
                      row.direction === "Short"
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
                <td className={row.direction === "Long" ? styles.sideLong : styles.sideShort}>{row.side}</td>
                <td className={`${styles.mono} ${row.date === "--" ? styles.placeholder : ""}`}>{row.date}</td>
                <td className={`${styles.mono} ${row.tradeValue === "--" ? styles.placeholder : ""}`}>
                  {row.tradeValue}
                </td>
                <td className={`${styles.mono} ${row.size === "--" ? styles.placeholder : ""}`}>{row.size}</td>
                <td className={`${styles.mono} ${row.price === "--" ? styles.placeholder : ""}`}>{row.price}</td>
                <td
                  className={`${styles.mono} ${
                    row.closedPnl === "--"
                      ? styles.placeholder
                      : row.closedPnlValue != null && row.closedPnlValue > 0
                        ? styles.pnlGain
                        : row.closedPnlValue != null && row.closedPnlValue < 0
                          ? styles.pnlLoss
                          : ""
                  }`}
                >
                  {row.closedPnl}
                </td>
                <td className={`${styles.mono} ${row.fee === "--" ? styles.placeholder : ""}`}>{row.fee}</td>
                <td className={row.role === "--" ? styles.placeholder : ""}>{row.role}</td>
                <td className={row.type === "--" ? styles.placeholder : ""}>{row.type}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
