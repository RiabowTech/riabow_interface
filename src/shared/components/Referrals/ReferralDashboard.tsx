import { Trans, t } from "@lingui/macro";
import { useCallback } from "react";
import { useCopyToClipboard } from "react-use";

import { useReferralDashboard } from "@/modules/lighter/api/custom/useReferralDashboard";
import {
  REFERRAL_OFFCHAIN_MIN_CLAIM_USDT,
  useReferralRebateClaim,
} from "@/modules/lighter/api/custom/useReferralRebateClaim";
import { ContractsChainId } from "config/chains";
import { getExplorerUrl } from "config/chains";
import { formatDate } from "lib/dates";
import { helperToast } from "lib/helperToast";
import { shortenAddress } from "lib/legacy";
import { formatUsd } from "lib/numbers";
import { parseValue } from "lib/numbers";
import { userAnalytics } from "lib/userAnalytics";
import { ReferralShareEvent } from "lib/userAnalytics/types";
/**
 * 格式化金额为 USD，使用截断而非四舍五入
 * @param value - 字符串形式的金额（如 "0.246501089890600000"）
 * @param decimals - 显示的小数位数（默认 2）
 */
function formatUsdTruncated(value: string | undefined, decimals = 2): string {
  if (!value) return "$0.00";

  const num = parseFloat(value);
  if (isNaN(num)) return "$0.00";

  // 使用 Math.floor 截断而非四舍五入
  const multiplier = Math.pow(10, decimals);
  const truncated = Math.floor(num * multiplier) / multiplier;

  return `$${truncated.toFixed(decimals)}`;
}

/** 接口 `commission_rate` 为小数（如 "0.12"）；兼容已是百分数的字符串或仅用 bps */
function formatReferralCommissionDisplay(tier: { commission_rate: string; rate_bps?: number }): string {
  const bps = tier.rate_bps;
  if (typeof bps === "number" && bps > 0 && Number.isFinite(bps)) {
    return `${(bps / 100).toFixed(0)}%`;
  }
  const raw = tier.commission_rate?.trim();
  if (!raw) return "—";
  const n = parseFloat(raw);
  if (!Number.isFinite(n)) return raw;
  if (n > 0 && n <= 1) return `${(n * 100).toFixed(0)}%`;
  if (n > 1) return `${n}%`;
  return raw;
}

import Button from "components/Button/Button";
import ExternalLink from "components/ExternalLink/ExternalLink";
import { TableTd, TableTh, TableTheadTr, TableTr } from "components/Table/Table";
import { TableScrollFadeContainer } from "components/TableScrollFade/TableScrollFade";
import { TrackingLink } from "components/TrackingLink/TrackingLink";

import CopyIcon from "img/ic_copy.svg?react";
import TwitterIcon from "img/ic_x.svg?react";

import ReferralInfoCard from "./ReferralInfoCard";
import { getReferralCodeTradeUrl, getTwitterShareUrl } from "./referralsHelper";
import Card from "../Card/Card";
import Loader from "../Loader/Loader";


type Props = {
  chainId: ContractsChainId;
};

export function ReferralDashboard({ chainId }: Props) {
  const [, copyToClipboard] = useCopyToClipboard();

  // useReferralDashboard internally uses useAuthToken() to check for token
  // No need for redundant token check here
  const { dashboard, isLoading, error, mutate } = useReferralDashboard(chainId);
  const { handleClaim, isClaiming } = useReferralRebateClaim(chainId, dashboard, mutate);

  const trackCopyCode = useCallback(() => {
    userAnalytics.pushEvent<ReferralShareEvent>(
      {
        event: "ReferralCodeAction",
        data: {
          action: "CopyCode",
        },
      },
      { instantSend: true }
    );
  }, []);

  const trackShareTwitter = useCallback(() => {
    userAnalytics.pushEvent<ReferralShareEvent>(
      {
        event: "ReferralCodeAction",
        data: {
          action: "ShareTwitter",
        },
      },
      { instantSend: true }
    );
  }, []);

  const handleCopy = useCallback(() => {
    if (!dashboard?.code) return;
    trackCopyCode();
    copyToClipboard(getReferralCodeTradeUrl(dashboard.code));
    helperToast.success(t`Referral link copied to your clipboard`);
  }, [dashboard?.code, trackCopyCode, copyToClipboard]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-40">
        <Loader />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-12 p-40 text-typography-secondary">
        <p>{t`Failed to load dashboard`}</p>
        <Button variant="secondary" onClick={() => mutate()}>
          <Trans>Retry</Trans>
        </Button>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="flex items-center justify-center p-40 text-typography-secondary">
        <Trans>No dashboard data available</Trans>
      </div>
    );
  }

  const pendingN = parseFloat(dashboard.pending_earnings || "0");
  const hasPendingEarnings = Number.isFinite(pendingN) && pendingN > 0;
  const canClaimOffChain = Number.isFinite(pendingN) && pendingN >= REFERRAL_OFFCHAIN_MIN_CLAIM_USDT;
  const tier = dashboard.tier;

  return (
    <div className="flex flex-col gap-16">
      {/* Referral Code Section */}
      {dashboard.code && (
        <div className="referral-card section-center">
          <h2 className="title">
            <Trans>Your Referral Code</Trans>
          </h2>
          <p className="sub-title">
            <Trans>Share your referral code and earn rebates from traders you refer.</Trans>
          </p>
          <div className="card-action">
            <div className="flex items-center justify-center gap-12 mb-16">
              <span className="referral-text text-20 font-mono font-medium">{dashboard.code}</span>
              <div
                onClick={handleCopy}
                className="referral-code-icon size-20 cursor-pointer text-typography-secondary hover:text-typography-primary flex items-center"
              >
                <CopyIcon className="size-20" />
              </div>
              <TrackingLink onClick={trackShareTwitter}>
                <a
                  href={getTwitterShareUrl(dashboard.code)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="referral-code-icon size-20 text-typography-secondary hover:text-typography-primary flex items-center"
                >
                  <TwitterIcon className="size-20" />
                </a>
              </TrackingLink>
            </div>
            <Button variant="primary-action" className="w-full max-w-[400px] mx-auto" onClick={handleCopy}>
              <Trans>Copy Referral Link</Trans>
            </Button>
          </div>
        </div>
      )}

      {/* Stats: referrals, referred volume, earnings */}
      <div className="grid grid-cols-6 max-xl:grid-cols-3 max-md:grid-cols-2 max-sm:grid-cols-1 gap-8">
        <ReferralInfoCard
          value={String(dashboard.total_referrals ?? "N/A")}
          label={t`Total Referrals`}
          labelTooltipText={t`Total number of traders you referred.`}
        />
        <ReferralInfoCard
          value={String(dashboard.active_referrals ?? "N/A")}
          label={t`Active Referrals`}
          labelTooltipText={t`Number of active traders you referred.`}
        />
        <ReferralInfoCard
          value={
            dashboard.total_referred_volume != null
              ? formatUsd(parseValue(dashboard.total_referred_volume, 30), { fallbackToZero: true }) || "N/A"
              : "N/A"
          }
          label={t`Referred Volume`}
          labelTooltipText={t`Cumulative trading volume from all referees (USD).`}
        />
        <ReferralInfoCard
          value={
            dashboard.claimed_earnings
              ? formatUsd(parseValue(dashboard.claimed_earnings, 30), { fallbackToZero: true }) || "N/A"
              : "N/A"
          }
          label={t`Claimed Earnings`}
          labelTooltipText={t`Total earnings that have been claimed.`}
        />
        <ReferralInfoCard
          value={
            dashboard.total_earnings
              ? formatUsd(parseValue(dashboard.total_earnings, 30), { fallbackToZero: true }) || "N/A"
              : "N/A"
          }
          label={t`Total Earnings`}
          labelTooltipText={t`Total earnings from referrals.`}
        />
        <ReferralInfoCard
          value={
            dashboard.pending_earnings
              ? formatUsd(parseValue(dashboard.pending_earnings, 30), { fallbackToZero: true }) || "N/A"
              : "N/A"
          }
          label={t`Pending Earnings`}
          labelTooltipText={t`Earnings available to claim.`}
        />
      </div>

      {/* Tier / 未达门槛说明 + Claim */}
      {tier ? (
        <Card
          title={
            <div className="flex w-full flex-row gap-12">
              <div className="flex w-full items-center justify-between">
                <span>
                  <Trans>Tier: {tier.name}</Trans>
                  <span className="ml-8 text-body-small text-typography-secondary">({t`Commission: ${formatReferralCommissionDisplay(tier)}`})</span>
                </span>
              </div>
              {canClaimOffChain ? (
                <div className="flex justify-end">
                  <Button
                    variant="primary-action"
                    onClick={() => void handleClaim()}
                    disabled={isClaiming}
                    className="min-w-[120px]"
                  >
                    {isClaiming ? <Trans>Claiming...</Trans> : <Trans>Claim</Trans>}
                  </Button>
                </div>
              ) : null}
            </div>
          }
        >
          <div className="flex flex-col gap-8">
            {dashboard.total_referred_volume != null ? (
              <div className="flex items-center justify-between text-body-small">
                <span className="text-typography-secondary">
                  <Trans>Referred volume (USD)</Trans>
                </span>
                <span className="text-typography-primary font-medium">
                  {formatUsd(parseValue(dashboard.total_referred_volume, 30), { fallbackToZero: true })}
                </span>
              </div>
            ) : null}
            <div className="flex items-center justify-between text-body-small">
              <span className="text-typography-secondary">
                <Trans>Claimed Earnings</Trans>
              </span>
              <span className="text-typography-primary font-medium">
                {formatUsd(dashboard.claimed_earnings || "0")}
              </span>
            </div>
            {(tier.next_tier_referrals != null && tier.next_tier_referrals > 0) ||
            (tier.next_tier_requirement != null && tier.next_tier_requirement > 0) ? (
              <div className="flex items-center justify-between text-body-small">
                <span className="text-typography-secondary">
                  <Trans>Next tier referrals</Trans>
                </span>
                <span className="text-typography-primary font-medium">
                  {tier.next_tier_referrals ?? tier.next_tier_requirement ?? "—"}
                </span>
              </div>
            ) : null}
            {tier.next_tier_volume ? (
              <div className="flex items-center justify-between text-body-small">
                <span className="text-typography-secondary">
                  <Trans>Next tier volume (USD)</Trans>
                </span>
                <span className="text-typography-primary font-medium">
                  {formatUsdTruncated(tier.next_tier_volume)}
                </span>
              </div>
            ) : null}
          </div>
        </Card>
      ) : dashboard.tier_note || hasPendingEarnings ? (
        <Card
          title={
            <div className="flex w-full flex-row flex-wrap items-center justify-between gap-12">
              <span>
                <Trans>Referral tier</Trans>
              </span>
              {canClaimOffChain ? (
                <Button
                  variant="primary-action"
                  onClick={() => void handleClaim()}
                  disabled={isClaiming}
                  className="min-w-[120px]"
                >
                  {isClaiming ? <Trans>Claiming...</Trans> : <Trans>Claim</Trans>}
                </Button>
              ) : null}
            </div>
          }
        >
          {dashboard.tier_note ? (
            <p className="text-body-small text-typography-secondary">{dashboard.tier_note}</p>
          ) : (
            <p className="text-body-small text-typography-secondary">
              <Trans>No tier information yet.</Trans>
            </p>
          )}
        </Card>
      ) : null}

      {/* Recent Activity */}
      {dashboard.recent_activity && dashboard.recent_activity.length > 0 && (
        <Card title={<Trans>Recent Activity</Trans>} divider={true} bodyPadding={false}>
          <TableScrollFadeContainer>
            <table className="w-full">
              <thead>
                <TableTheadTr>
                  <TableTh scope="col">
                    <Trans>Referral Address</Trans>
                  </TableTh>
                  <TableTh scope="col">
                    <Trans>Event Type</Trans>
                  </TableTh>
                  <TableTh scope="col">
                    <Trans>Volume</Trans>
                  </TableTh>
                  <TableTh scope="col">
                    <Trans>Commission</Trans>
                  </TableTh>
                  <TableTh scope="col">
                    <Trans>Time</Trans>
                  </TableTh>
                </TableTheadTr>
              </thead>
              <tbody>
                {dashboard.recent_activity.map((activity, index) => (
                  <TableTr key={index}>
                      <TableTd data-label="Referral Address">
                        {activity.referral_address ? (
                          <ExternalLink
                            href={getExplorerUrl(chainId, activity.referral_address)}
                            className="text-primary hover:text-primary-hover"
                          >
                            {shortenAddress(activity.referral_address, 13) || activity.referral_address}
                          </ExternalLink>
                        ) : (
                          <span className="text-typography-secondary">-</span>
                        )}
                      </TableTd>
                    <TableTd data-label="Event Type" className="capitalize">
                      {activity.event_type}
                    </TableTd>
                    <TableTd data-label="Volume">
                      {formatUsd(parseValue(activity.volume, 30), { fallbackToZero: true })}
                    </TableTd>
                    <TableTd data-label="Commission">
                      {formatUsdTruncated(activity.commission)}
                    </TableTd>
                    <TableTd data-label="Time">
                      {(() => {
                        // API returns timestamp in milliseconds, but formatDate expects seconds
                        // So we need to convert milliseconds to seconds
                        const timestampMs =
                          typeof activity.timestamp === "string"
                            ? parseInt(activity.timestamp)
                            : activity.timestamp;
                        // Convert milliseconds to seconds for formatDate
                        const timestampSeconds = Math.floor(timestampMs / 1000);
                        return formatDate(timestampSeconds);
                      })()}
                    </TableTd>
                  </TableTr>
                ))}
              </tbody>
            </table>
          </TableScrollFadeContainer>
        </Card>
      )}
    </div>
  );
}
