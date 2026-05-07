import { Trans } from "@lingui/macro";
import { useMemo } from "react";
import useSWR from "swr";

import { useChainId } from "lib/chains";
import { getFundingFeeHistory } from "modules/lighter/api/custom/client";
import { useTradeState } from "modules/lighter/store/TradeStateContext";

import type { BottomTabFilterMode } from "./BottomTabs";
import styles from "./BottomTabs.module.scss";
import { formatFundingFeeHistoryRows } from "./fundingFeeHistory";

export function FundingHistoryTab({ mode = "all" }: { mode?: BottomTabFilterMode }) {
  const { chainId } = useChainId();
  const { selectedSymbol } = useTradeState();

  const { data, isLoading } = useSWR(
    chainId ? ["lighter-funding-fee-history", chainId, selectedSymbol] : null,
    () =>
      getFundingFeeHistory(chainId!, {
        symbol: selectedSymbol ? selectedSymbol.replace(/[-/]?USD[T]?$/i, "") : undefined,
        limit: 100,
      }),
    {
      revalidateOnFocus: false,
      refreshInterval: 30000,
    }
  );

  const rows = useMemo(() => {
    const allRows = formatFundingFeeHistoryRows(data ?? []);
    return allRows.filter((row) => {
      if (mode === "all") return true;
      if (mode === "asks") return row.paymentValue < 0;
      return row.paymentValue >= 0;
    });
  }, [data, mode]);

  if (isLoading) {
    return (
      <div className={styles.empty}>
        <Trans>Loading funding history...</Trans>
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className={styles.empty}>
        <Trans>No funding history.</Trans>
      </div>
    );
  }

  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th className={styles.th}>
            <Trans>Time</Trans>
          </th>
          <th className={styles.th}>
            <Trans>Market</Trans>
          </th>
          <th className={styles.th}>
            <Trans>Rate</Trans>
          </th>
          <th className={styles.th}>
            <Trans>Position</Trans>
          </th>
          <th className={styles.th}>
            <Trans>Size</Trans>
          </th>
          <th className={styles.th}>
            <Trans>Payment</Trans>
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <td className={styles.td}>{row.time}</td>
            <td className={styles.td}>{row.market}</td>
            <td className={styles.td}>{row.rate}</td>
            <td className={styles.td}>{row.position}</td>
            <td className={styles.td}>{row.size}</td>
            <td className={styles.td}>
              <span className={row.paymentValue >= 0 ? "ltr-up" : "ltr-down"}>{row.payment}</span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
