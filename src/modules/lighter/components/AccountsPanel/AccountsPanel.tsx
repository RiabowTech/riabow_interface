import { Trans } from "@lingui/macro";
import type { ReactNode } from "react";
import { useMemo } from "react";
import useSWR from "swr";
import { useAccount } from "wagmi";

import styles from "./AccountsPanel.module.scss";
import { getBalances } from "../../api/custom/client";
import { useAuthToken } from "../../api/custom/useAuthToken";
import { useUnifiedAccountAdapter } from "../../adapters/useUnifiedAccountAdapter";
import { useTradeProduct } from "../../store/TradeStateContext/TradeStateContext";
import { DEFAULT_CHAIN_ID } from "config/chains";

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

function formatTokenAmount(value: string | number | null | undefined) {
  if (value === undefined || value === null || value === "") return "-";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return String(value);
  return numeric.toLocaleString(undefined, { maximumFractionDigits: 8 });
}

function normalizeTokenSymbol(symbol: string | null | undefined) {
  return String(symbol || "").trim().toUpperCase();
}

export function AccountsPanel({
  spotBaseSymbol,
  spotQuoteSymbol = "USDT",
}: {
  spotBaseSymbol?: string;
  spotQuoteSymbol?: string;
}) {
  const product = useTradeProduct();
  const account = useUnifiedAccountAdapter();
  const { address } = useAccount();
  const { token: authToken } = useAuthToken(DEFAULT_CHAIN_ID);

  const baseSymbol = normalizeTokenSymbol(spotBaseSymbol);
  const quoteSymbol = normalizeTokenSymbol(spotQuoteSymbol) || "USDT";
  const spotBalancesKey =
    product === "spot" && address && authToken ? ["spot-account-panel-balances", DEFAULT_CHAIN_ID, address, authToken] : null;
  const { data: spotBalancesData } = useSWR(
    spotBalancesKey,
    () => getBalances(DEFAULT_CHAIN_ID, address, "spot"),
    { revalidateOnFocus: true, refreshInterval: 10_000 }
  );

  const spotBalancesBySymbol = useMemo(() => {
    const map = new Map<string, { available: string; frozen: string }>();
    for (const balance of spotBalancesData?.balances ?? []) {
      const symbol = normalizeTokenSymbol(balance.symbol || balance.token);
      if (!symbol) continue;
      map.set(symbol, {
        available: balance.available,
        frozen: balance.frozen,
      });
    }
    return map;
  }, [spotBalancesData?.balances]);

  if (product === "spot") {
    const baseBalance = baseSymbol ? spotBalancesBySymbol.get(baseSymbol) : undefined;
    const quoteBalance = spotBalancesBySymbol.get(quoteSymbol);
    const emptyValue = address && authToken && spotBalancesData ? "0" : "-";
    const getAvailable = (balance?: { available: string }) => balance?.available ?? emptyValue;
    const getFrozen = (balance?: { frozen: string }) => balance?.frozen ?? emptyValue;

    return (
      <div className={styles.root}>
        <div className={styles.section}>
          <div className={styles.head}>
            <Trans>Accounts</Trans>
          </div>
          {baseSymbol ? (
            <>
              <Row
                label={<>{baseSymbol} <Trans>Balance</Trans></>}
                value={`${formatTokenAmount(getAvailable(baseBalance))} ${baseSymbol}`}
              />
              <Row
                label={<>{baseSymbol} <Trans>Frozen</Trans></>}
                value={`${formatTokenAmount(getFrozen(baseBalance))} ${baseSymbol}`}
              />
            </>
          ) : null}
          <Row
            label={<>{quoteSymbol} <Trans>Balance</Trans></>}
            value={`${formatTokenAmount(getAvailable(quoteBalance))} ${quoteSymbol}`}
          />
          <Row
            label={<>{quoteSymbol} <Trans>Frozen</Trans></>}
            value={`${formatTokenAmount(getFrozen(quoteBalance))} ${quoteSymbol}`}
          />
        </div>
      </div>
    );
  }

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
