import { Trans } from "@lingui/macro";
import type { ReactNode } from "react";

import styles from "./AccountsPanel.module.scss";
import { useUnifiedAccountAdapter } from "../../adapters/useUnifiedAccountAdapter";

function Row({ label, value }: { label: ReactNode; value: string }) {
  return (
    <div className={styles.row}>
      <span className={styles.label}>{label}</span>
      <span className={`${styles.value} ltr-mono`}>{value}</span>
    </div>
  );
}

function formatUsd(value: number | null | undefined) {
  if (value == null) return "-";
  return `$${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)}`;
}

function formatPercent(value: number | null | undefined) {
  if (value == null) return "-";
  return `${(value * 100).toFixed(2)}%`;
}

function formatLeverage(value: number | null | undefined) {
  if (value == null) return "-";
  return `${value.toFixed(2)}x`;
}

export function AccountsPanel() {
  const account = useUnifiedAccountAdapter();

  return (
    <div className={styles.root}>
      <div className={styles.section}>
        <div className={styles.head}>
          <Trans>Accounts</Trans>
        </div>
        <Row label={<Trans>Perpetuals Equity</Trans>} value={formatUsd(account.perpetualsEquity)} />
        {/* Spot 账户暂未接入,先下线 Spot Equity 行,保留 JSX 供后续打开。
        <Row label={<Trans>Spot Equity</Trans>} value={formatUsd(account.spotEquity)} />
        */}
      </div>
      <div className={styles.section}>
        <div className={styles.head}>
          <Trans>Perpetuals Overview</Trans>
        </div>
        <Row label={<Trans>Unrealized PnL</Trans>} value={formatUsd(account.unrealizedPnl)} />
        <Row label={<Trans>Cross Leverage</Trans>} value={formatLeverage(account.crossLeverage)} />
        <Row label={<Trans>Cross Margin Usage</Trans>} value={formatUsd(account.crossMarginUsage)} />
        <Row label={<Trans>Maintenance Margin</Trans>} value={formatUsd(account.maintenanceMargin)} />
        <Row label={<Trans>Cross Margin Ratio</Trans>} value={formatPercent(account.crossMarginRatio)} />
      </div>
    </div>
  );
}
