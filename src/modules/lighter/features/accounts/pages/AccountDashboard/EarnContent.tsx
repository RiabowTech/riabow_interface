import { Trans } from "@lingui/macro";
import { useMemo } from "react";
import { Address } from "viem";

import { Table, TableTd, TableTh, TableTheadTr, TableTr } from "components/Table/Table";
import { TableScrollFadeContainer } from "components/TableScrollFade/TableScrollFade";
import Loader from "components/Loader/Loader";
import { formatIsoToCompactDateTime } from "lib/dates/formatDate";
import { useEarnSubscriptions } from "@/modules/lighter/api/custom/useEarn";
import type { EarnSubscription } from "@/modules/lighter/api/types";
import type { ContractsChainId } from "config/chains";

import "./EarnContent.css";

// USDT has 6 decimals
const USDT_DECIMALS = 6;

// Convert USDT from smallest unit to human-readable format with thousand separators
function formatUsdtAmount(value: string | undefined): string {
  if (!value) return "0.00";
  const num = parseFloat(value.replace(/,/g, ""));
  if (isNaN(num)) return "0.00";
  const converted = num / Math.pow(10, USDT_DECIMALS);
  return converted.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface EarnContentProps {
  chainId: ContractsChainId;
  account: Address;
}

export function EarnContent({ chainId, account }: EarnContentProps) {
  // Fetch real subscriptions from API
  const { subscriptions, isLoading } = useEarnSubscriptions(chainId);

  // Separate subscriptions into in-progress and completed
  const { inProgressSubscriptions, completedSubscriptions } = useMemo(() => {
    const inProgress: EarnSubscription[] = [];
    const completed: EarnSubscription[] = [];

    for (const sub of subscriptions) {
      // nft_status: "active" means in progress, "matured" or "redeemed" means completed
      if (sub.nft_status === "active") {
        inProgress.push(sub);
      } else {
        completed.push(sub);
      }
    }

    return { inProgressSubscriptions: inProgress, completedSubscriptions: completed };
  }, [subscriptions]);

  // Calculate totals from completed subscriptions
  const { totalInterestIncome, totalParticipations } = useMemo(() => {
    const interestSum = completedSubscriptions.reduce((sum, sub) => {
      // Use actual_return if available, otherwise use expected_return
      const returnValue = sub.actual_return || sub.expected_return;
      const interest = parseFloat(returnValue?.replace(/,/g, "") || "0") / Math.pow(10, USDT_DECIMALS);
      return sum + interest;
    }, 0);

    return {
      totalInterestIncome: interestSum,
      totalParticipations: subscriptions.length,
    };
  }, [completedSubscriptions, subscriptions.length]);

  // Show loading state
  if (isLoading) {
    return (
      <div className="earn-content flex items-center justify-center min-h-[200px]">
        <Loader />
      </div>
    );
  }

  return (
    <div className="earn-content">
      {/* Summary Cards */}
      <div className="earn-summary">
        <div className="earn-summary-card">
          <div className="earn-summary-label">
            <Trans>Total Interest Income</Trans>
          </div>
          <div className="earn-summary-value">$ {totalInterestIncome.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>

        <div className="earn-summary-card">
          <div className="earn-summary-label">
            <Trans>Total Participations</Trans>
          </div>
          <div className="earn-summary-value">{totalParticipations}</div>
        </div>
      </div>

      {/* In Progress Section */}
      {inProgressSubscriptions.length > 0 && (
        <div className="earn-section">
          <h2 className="earn-section-title">
            <Trans>In Progress</Trans>
          </h2>

          <div className="subscription-table-container">
            {inProgressSubscriptions.map((sub) => (
              <div key={sub.id} className="subscription-row">
                <div className="subscription-status-wrapper">
                  <span className="subscription-field-label">
                    <Trans>Product</Trans>
                  </span>
                  <span className="subscription-product-name">{sub.product_name}</span>
                </div>

                <div className="subscription-divider" />

                <div className="subscription-field-wrapper">
                  <span className="subscription-field-label">
                    <Trans>Subscription Amount</Trans>
                  </span>
                  <div className="flex items-baseline gap-4">
                    <span className="subscription-field-value">
                      {formatUsdtAmount(sub.amount)}
                    </span>
                    <span className="info-label">USDT</span>
                  </div>
                </div>

                <div className="subscription-divider" />

                <div className="subscription-field-wrapper">
                  <span className="subscription-field-label">
                    <Trans>Estimated Interest</Trans>
                  </span>
                  <div className="flex items-baseline gap-8">
                    <span className="subscription-field-value">
                      {formatUsdtAmount(sub.expected_return)}
                    </span>
                    <span className="info-label">USDT</span>
                    {sub.period_rate && (
                      <span className="subscription-interest">+{sub.period_rate}</span>
                    )}
                  </div>
                </div>

                <div className="subscription-divider" />

                <div className="subscription-field-wrapper">
                  <span className="subscription-field-label">
                    <Trans>Subscription Date (UTC)</Trans>
                  </span>
                  <span className="subscription-field-value">{formatIsoToCompactDateTime(sub.subscribed_at)}</span>
                </div>

                <div className="subscription-divider" />

                <div className="subscription-field-wrapper">
                  <span className="subscription-field-label">
                    <Trans>Maturity Date (UTC)</Trans>
                  </span>
                  <span className="subscription-field-value">{formatIsoToCompactDateTime(sub.settle_time)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* History Section */}
      {completedSubscriptions.length > 0 && (
        <div className="earn-section">
          <h2 className="earn-section-title">
            <Trans>History</Trans>
          </h2>

          <div className="earn-history-table-container">
            <TableScrollFadeContainer className="flex grow flex-col">
              <Table className="earn-history-table">
                <thead>
                  <TableTheadTr>
                    <TableTh>
                      <Trans>Earn</Trans>
                    </TableTh>
                    <TableTh>
                      <Trans>Subscription</Trans>
                    </TableTh>
                    <TableTh>
                      <Trans>Interest</Trans>
                    </TableTh>
                    <TableTh>
                      <Trans>APY</Trans>
                    </TableTh>
                    <TableTh>
                      <Trans>Subscription Date (UTC)</Trans>
                    </TableTh>
                    <TableTh>
                      <Trans>Maturity Date (UTC)</Trans>
                    </TableTh>
                  </TableTheadTr>
                </thead>
                <tbody>
                  {completedSubscriptions.map((sub) => (
                    <TableTr key={sub.id}>
                      <TableTd>{sub.product_name}</TableTd>
                      <TableTd>{formatUsdtAmount(sub.amount)} USDT</TableTd>
                      <TableTd>{formatUsdtAmount(sub.actual_return || sub.expected_return)} USDT</TableTd>
                      <TableTd className="earn-apr-value">{sub.annual_rate}</TableTd>
                      <TableTd>{formatIsoToCompactDateTime(sub.subscribed_at)}</TableTd>
                      <TableTd>{formatIsoToCompactDateTime(sub.settle_time)}</TableTd>
                    </TableTr>
                  ))}
                </tbody>
              </Table>
            </TableScrollFadeContainer>
          </div>
        </div>
      )}
    </div>
  );
}
