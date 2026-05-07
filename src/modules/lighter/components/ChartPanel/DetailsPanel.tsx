import { Trans } from "@lingui/macro";
import { useMemo, type ReactNode } from "react";

import { useChainId } from "lib/chains";
import { useApiMarketDetails } from "modules/lighter/api/hooks";
import { useTradeState } from "modules/lighter/store/TradeStateContext";

import TokenIcon from "components/TokenIcon/TokenIcon";

import { buildDetailsViewModel } from "./detailsMock";
import styles from "./DetailsPanel.module.scss";

function SummaryRow({ label, value }: { label: ReactNode; value: string }) {
  return (
    <div className={styles.summaryRow}>
      <span className={styles.summaryLabel}>{label}</span>
      <span className={styles.summaryValue}>{value}</span>
    </div>
  );
}

export function DetailsPanel() {
  const { chainId } = useChainId();
  const { selectedSymbol } = useTradeState();
  const { details } = useApiMarketDetails(chainId, selectedSymbol ?? undefined);
  const model = useMemo(() => buildDetailsViewModel(details), [details]);

  if (!model) {
    return (
      <div className={styles.root}>
        <section className={styles.card}>
          <div className={styles.description}>
            <Trans>Loading…</Trans>
          </div>
        </section>
        <section className={styles.card} />
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <section className={styles.card}>
        <div className={styles.assetHeader}>
          <TokenIcon symbol={model.assetSymbol} displaySize={24} className={styles.assetIcon} />
          <div className={styles.assetTitle}>
            <span className={styles.assetSymbol}>{model.assetSymbol}</span>
            <span className={styles.assetName}>{model.assetName}</span>
          </div>
        </div>

        <div className={styles.bodyDivider} />

        <p className={styles.description}>{model.description}</p>
      </section>

      <section className={styles.card}>
        <div className={styles.summaryList}>
          <SummaryRow label={<Trans>Market Name:</Trans>} value={model.summary.marketName} />
          <SummaryRow label={<Trans>Min {model.assetSymbol} Amount:</Trans>} value={model.summary.minBtcAmount} />
          <SummaryRow label={<Trans>Min USD Amount:</Trans>} value={model.summary.minUsdAmount} />
          <SummaryRow label={<Trans>Price Steps:</Trans>} value={model.summary.priceSteps} />
          <SummaryRow label={<Trans>Max Leverage:</Trans>} value={model.summary.maxLeverage} />
          <SummaryRow label={<Trans>Initial Margin Fraction:</Trans>} value={model.summary.initialMarginFraction} />
          <SummaryRow
            label={<Trans>Maintenance Margin Fraction:</Trans>}
            value={model.summary.maintenanceMarginFraction}
          />
          <SummaryRow label={<Trans>Close Out Margin Fraction:</Trans>} value={model.summary.closeOutMarginFraction} />
          <SummaryRow label={<Trans>Market Cap:</Trans>} value={model.summary.marketCap} />
          <SummaryRow label={<Trans>FDV:</Trans>} value={model.summary.fdv} />
        </div>
      </section>
    </div>
  );
}
