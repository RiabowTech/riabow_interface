import { Trans } from "@lingui/macro";

import styles from "./AssetsTab.module.scss";
import type { BottomTabFilterMode } from "./BottomTabs";
import { useAssetsAdapter } from "../../adapters/useAssetsAdapter";

function formatAsset(value: number | null, symbol: string) {
  if (value == null) return "--";
  return `${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  }).format(value)} ${symbol}`;
}

function formatUsd(value: number | null) {
  if (value == null) return "--";
  return `$${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)}`;
}

export function AssetsTab({ mode: _mode = "all" }: { mode?: BottomTabFilterMode }) {
  const rows = useAssetsAdapter();

  return (
    <div className={styles.root}>
      <table className={styles.table}>
        <colgroup>
          <col className={styles.colAsset} />
          <col className={styles.colTotal} />
          <col className={styles.colAvailable} />
          <col className={styles.colPnl} />
          <col className={styles.colValue} />
        </colgroup>
        <thead>
          <tr>
            <th>
              <Trans>Asset</Trans>
            </th>
            <th>
              <Trans>Total Balance</Trans>
            </th>
            <th>
              <Trans>Available Balance</Trans>
            </th>
            <th>
              <Trans>PnL</Trans>
            </th>
            <th>
              <span className={styles.sortHeader}>
                <span>
                  <Trans>USDC Value</Trans>
                </span>
                <span className={styles.sortCaret}>⌄</span>
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            return (
              <tr key={`${row.asset}-${index}`}>
                <td>
                  <span className={`${styles.assetCell} ${styles.assetCellFilled}`}>
                    <span className={styles.assetStripe} />
                    <span className={styles.assetContent}>
                      <span className={styles.assetIcon}>$</span>
                      <span className={styles.assetLabel}>{row.asset}</span>
                      <span className={styles.assetSlash}>/</span>
                      <span className={styles.assetScope}>{row.scope}</span>
                    </span>
                  </span>
                </td>
                <td
                  className={`${styles.mono} ${styles.numeric} ${row.totalBalance == null ? styles.placeholder : ""}`}
                >
                  {formatAsset(row.totalBalance, row.asset)}
                </td>
                <td
                  className={`${styles.mono} ${styles.numeric} ${row.availableBalance == null ? styles.placeholder : ""}`}
                >
                  {formatAsset(row.availableBalance, row.asset)}
                </td>
                <td className={`${styles.mono} ${styles.numeric} ${row.pnl == null ? styles.placeholder : ""}`}>
                  {row.pnl == null ? "--" : formatUsd(row.pnl)}
                </td>
                <td className={`${styles.mono} ${styles.numeric} ${row.usdcValue == null ? styles.placeholder : ""}`}>
                  {formatUsd(row.usdcValue)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
