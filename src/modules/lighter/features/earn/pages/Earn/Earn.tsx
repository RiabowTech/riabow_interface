import { Trans, t } from "@lingui/macro";
import { useState, useMemo, useEffect } from "react";
import { usePublicClient } from "wagmi";
import { formatUnits } from "viem";
import useSWR from "swr";

import AppPageLayout from "shared/components/AppPageLayout/AppPageLayout";
import { LighterShell } from "@/modules/lighter/components/LighterShell/LighterShell";
import { ChainContentHeader } from "components/ChainContentHeader/ChainContentHeader";
import { useChainId } from "lib/chains";
import { getExplorerUrl, type ContractsChainId } from "config/chains";
import Button from "components/Button/Button";
import { SectionLabel, TooltipWithPortal } from "shared/ui";
import { useDesignSystem } from "shared/context/DesignSystemContext/DesignSystemContext";
import Loader from "components/Loader/Loader";
import useWallet from "lib/wallets/useWallet";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import {
  formatSubscriptionPeriod,
  formatSubscriptionPeriodCompact,
  formatDateRangeCompact,
  formatMaturityDate,
  formatIsoToCompactDateTime,
} from "lib/dates/formatDate";
import { useEarnProducts, useEarnSubscriptions } from "@/modules/lighter/api/custom/useEarn";
import type { EarnProduct, EarnSubscription } from "@/modules/lighter/api/types";
import { getEarnContractAddress, getTradingUsdtAddress } from "config/custom/contracts";

import UsdtIcon from "img/tokens/ic_usdt.svg?react";
import InfoIcon from "img/ic_info_circle.svg?react";
import InfoHelpIcon from "img/ic_info_help.svg?react";
import CalendarIcon from "img/ic_calendar.svg?react";

import { SubscriptionModal } from "../../components/SubscriptionModal";
import { PastPerformanceChart } from "../../components/PastPerformanceChart";
import { Countdown } from "../../components/Countdown/Countdown";
import { ClaimModal } from "../../components/ClaimModal";
import { ScanningEffect } from "../../components/ScanningEffect";
import { EarnTitle } from "../../components/EarnTitle";
import { EarnErrorBoundary } from "../../components/EarnErrorBoundary";

import "./Earn.css";

// Divider component for reusability
const Divider = ({ className = "" }: { className?: string }) => (
  <div className={`w-1 bg-white/10  max-md:hidden ${className}`}></div>
);

// USDT has 6 decimals
const USDT_DECIMALS = 6;

// Convert USDT from smallest unit to human-readable and format with thousand separators
function formatUsdtAmount(value: number | string | undefined | null): string {
  try {
    if (value === undefined || value === null || value === "") return "0";
    const num = typeof value === "string" ? parseFloat(value.replace(/,/g, "")) : value;
    if (!isFinite(num) || isNaN(num)) return "0";
    // Convert from smallest unit (divide by 10^6)
    const converted = num / Math.pow(10, USDT_DECIMALS);
    if (!isFinite(converted)) return "0";
    // Use more decimal places for very small amounts (e.g. short-term interest)
    const maxDecimals = converted !== 0 && Math.abs(converted) < 0.01 ? 6 : 2;
    return converted.toLocaleString("en-US", { maximumFractionDigits: maxDecimals, minimumFractionDigits: 0 });
  } catch (error) {
    console.error("[formatUsdtAmount] Error formatting value:", value, error);
    return "0";
  }
}

// Format number with thousand separators (e.g., 1000 → 1,000) - for non-USDT values
function formatNumber(value: number | string | undefined | null): string {
  try {
    if (value === undefined || value === null || value === "") return "0";
    const num = typeof value === "string" ? parseFloat(value.replace(/,/g, "")) : value;
    if (!isFinite(num) || isNaN(num)) return "0";
    return num.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 0 });
  } catch (error) {
    console.error("[formatNumber] Error formatting value:", value, error);
    return "0";
  }
}

// 直接使用 API 类型，不再定义额外的 UI 类型

// 辅助函数：计算策略的结束时间（用于倒计时）
function getStrategyEndTime(strategy: EarnProduct | null | undefined): number | undefined {
  try {
    if (!strategy) return undefined;
    // Backend status: subscribing (申购期), active (运行中)
    if (strategy.status === "subscribing" && strategy.subscribe_end_time) {
      const endTime = new Date(strategy.subscribe_end_time).getTime();
      return isNaN(endTime) ? undefined : endTime;
    }
    if (strategy.status === "active" && strategy.settle_time) {
      const endTime = new Date(strategy.settle_time).getTime();
      return isNaN(endTime) ? undefined : endTime;
    }
    return undefined;
  } catch (error) {
    console.error("[getStrategyEndTime] Error calculating end time:", error);
    return undefined;
  }
}

// 辅助函数：获取策略名称（直接使用 name 字段）
function getStrategyBaseName(name: string | null | undefined): string {
  try {
    return name && typeof name === "string" && name.trim() ? name.trim() : "Zanbara Strategy";
  } catch (error) {
    console.error("[getStrategyBaseName] Error:", error);
    return "Zanbara Strategy";
  }
}

// 辅助函数：根据 chain_product_id 生成期数信息
function getStrategyTerm(chainProductId: number | null | undefined): string {
  try {
    if (
      chainProductId === null ||
      chainProductId === undefined ||
      typeof chainProductId !== "number" ||
      !isFinite(chainProductId)
    ) {
      return t`N/A Term`;
    }
    const n = Math.floor(chainProductId);
    return t`${n}th Term`;
  } catch (error) {
    console.error("[getStrategyTerm] Error:", error);
    return t`N/A Term`;
  }
}

// 辅助函数：将秒数转换为天数
function getDurationDays(durationSeconds: number | null | undefined): number {
  try {
    if (durationSeconds === null || durationSeconds === undefined || typeof durationSeconds !== "number") {
      return 0;
    }
    if (!isFinite(durationSeconds) || durationSeconds < 0) {
      return 0;
    }
    return Math.ceil(durationSeconds / 86400); // 86400 = 60 * 60 * 24
  } catch (error) {
    console.error("[getDurationDays] Error:", error);
    return 0;
  }
}

// 辅助函数：计算 shares 信息 (1 share = min_amount USDT)
function getSharesInfo(
  totalQuota: string | null | undefined,
  minAmount: string | null | undefined
): { totalShares: number; sharePrice: number } {
  try {
    const totalQuotaNum = parseFloat(String(totalQuota || "0").replace(/,/g, "")) / Math.pow(10, USDT_DECIMALS);
    const minAmountNum = parseFloat(String(minAmount || "100000000").replace(/,/g, "")) / Math.pow(10, USDT_DECIMALS);

    if (!isFinite(totalQuotaNum) || !isFinite(minAmountNum) || minAmountNum <= 0) {
      return { totalShares: 0, sharePrice: 0 };
    }

    const totalShares = Math.floor(totalQuotaNum / minAmountNum);
    return {
      totalShares: isFinite(totalShares) ? totalShares : 0,
      sharePrice: isFinite(minAmountNum) ? minAmountNum : 0,
    };
  } catch (error) {
    console.error("[getSharesInfo] Error:", error);
    return { totalShares: 0, sharePrice: 0 };
  }
}

function StrategyCard({
  strategy,
  isWalletConnected,
  openConnectModal,
  onSubscribeClick,
  contractAddress,
}: {
  strategy: EarnProduct;
  isWalletConnected: boolean;
  openConnectModal?: () => void;
  onSubscribeClick?: (strategy: EarnProduct) => void;
  contractAddress?: string;
}) {
  const { chainId } = useChainId();
  // Check if current time is within subscription period
  const isWithinSubscriptionPeriod = useMemo(() => {
    try {
      if (!strategy?.subscribe_start_time || !strategy?.subscribe_end_time) {
        return false;
      }
      const now = new Date().getTime();
      const startTime = new Date(strategy.subscribe_start_time).getTime();
      const endTime = new Date(strategy.subscribe_end_time).getTime();

      if (isNaN(startTime) || isNaN(endTime)) {
        return false;
      }

      return now >= startTime && now <= endTime;
    } catch (error) {
      console.error("[isWithinSubscriptionPeriod] Error:", error);
      return false;
    }
  }, [strategy?.subscribe_start_time, strategy?.subscribe_end_time]);

  // Status flags based on backend enum AND time validation
  const isSubscribing = strategy.status === "subscribing" && isWithinSubscriptionPeriod; // 申购期，可申购，且在订阅时间范围内
  // const isSubscribing = true; // 申购期，可申购，且在订阅时间范围内
  const isActive = strategy.status === "active"; // 运行中（锁仓期）
  const isSettling = strategy.status === "settling"; // 结算中
  const isSettled = strategy.status === "settled"; // 已结算
  const isCancelled = strategy.status === "cancelled"; // 已取消
  const isEnded = strategy.status === "ended"; // 已取消
  const isCompleted = isSettling || isSettled || isCancelled || isEnded; // 已完成（结算中、已结算或取消）

  // OPEN 卡：绿色描边 + 整卡高亮背景；其他状态保持默认
  const cardBorderClass = isSubscribing ? "strategy-card-active-border" : "border-1/2 border-slate-700";
  const cardStateClass = isSubscribing ? "strategy-card-active-bg" : "";

  return (
    <div className={`strategy-card ${cardBorderClass} ${cardStateClass} relative`}>
      {/* Status Badge - Top Right Corner */}
      {(isSubscribing || isActive) && (
        <div className={`status-badge-corner ${isSubscribing ? "status-badge-open" : "status-badge-live"}`}>
          {isSubscribing ? <Trans>OPEN</Trans> : <Trans>LIVE</Trans>}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-12 p-20 max-md:p-16">
        <div className="flex items-start justify-between gap-16 max-md:flex-col">
          {isCompleted ? (
            // Completed: Stacked title layout
            <div className="flex min-w-0 flex-1 flex-col gap-0">
              <h2 className="earn-accent-text font-zanbaraTitle text-h3 m-0 truncate tracking-wider max-md:text-body-large">
                {getStrategyBaseName(strategy.name)}
              </h2>
              <span className="font-zanbaraTitle text-body-medium truncate tracking-wider">
                {getStrategyTerm(strategy.chain_product_id)}
              </span>
            </div>
          ) : (
            // Active: Inline layout with FAQ tooltip
            <div className="flex min-w-0 flex-1 items-center gap-10">
              <h2 className="earn-accent-text font-zanbaraTitle text-h3 m-0 whitespace-nowrap tracking-wider max-md:text-body-large">
                {getStrategyBaseName(strategy.name)}
              </h2>
              {isSubscribing ? (
                <TooltipWithPortal
                  position="bottom"
                  maxAllowedWidth={300}
                  variant="none"
                  handle={
                    <span className="text-body-medium cursor-help whitespace-nowrap">
                      {getStrategyTerm(strategy.chain_product_id)} <Trans>Now Open</Trans>
                    </span>
                  }
                  renderContent={() => (
                    <div className="flex flex-col gap-4">
                      <span className="text-body-small">
                        <Trans>Subscription Period (UTC):</Trans>
                      </span>
                      <span className="text-body-small text-typography-primary">
                        {formatSubscriptionPeriodCompact(strategy.subscribe_start_time, strategy.subscribe_end_time)}
                      </span>
                    </div>
                  )}
                />
              ) : (
                <span className="text-body-medium whitespace-nowrap">{getStrategyTerm(strategy.chain_product_id)}</span>
              )}
              {!isActive && isSubscribing && (
                <TooltipWithPortal
                  position="right-start"
                  maxAllowedWidth={400}
                  variant="none"
                  handle={<InfoHelpIcon className="h-20 w-20 cursor-help" />}
                  renderContent={() => (
                    <div className="flex flex-col gap-12">
                      <h4 className="faq-title m-0 mb-8">
                        <Trans>FAQs</Trans>
                      </h4>
                      <div className="flex flex-col gap-12">
                        <div>
                          <p className="faq-question m-0 mb-4">
                            <Trans>1. Who's eligible to join Zanbara Strategy?</Trans>
                          </p>
                          <p className="faq-answer m-0">
                            <Trans>All Zanbara users are eligible.</Trans>
                          </p>
                        </div>
                        <div>
                          <p className="faq-question m-0 mb-4">
                            <Trans>2. How do I redeem my funds?</Trans>
                          </p>
                          <p className="faq-answer m-0">
                            <Trans>
                              Zanbara Strategy is a fixed-term product that's automatically redeemed to your account at
                              maturity.
                            </Trans>
                          </p>
                        </div>
                        <div>
                          <p className="faq-question m-0 mb-4">
                            <Trans>3. How do I claim my Interest Income?</Trans>
                          </p>
                          <p className="faq-answer m-0">
                            <Trans>
                              Interest Income is automatically distributed with the principal upon redemption.
                            </Trans>
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                />
              )}
            </div>
          )}
          <div className="flex shrink-0 items-center gap-8">
            {(isSubscribing || isActive) && getStrategyEndTime(strategy) && (
              <Countdown endTime={getStrategyEndTime(strategy)!} showDays={isActive} />
            )}

            {isCompleted && (
              <div className="subscription-period-badge flex items-center gap-6">
                <CalendarIcon className="h-18 w-18" />
                <span>{formatDateRangeCompact(strategy.subscribe_start_time, strategy.subscribe_end_time)}</span>
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Main Content */}
      <div className={`flex flex-col p-20 max-md:p-16 ${isCompleted ? "gap-30" : "gap-24"}`}>
        {isCompleted ? (
          // Completed: Simplified layout
          <>
            {/* Token and APR row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                <UsdtIcon className="h-20 w-20" />
                <span className="text-body-medium font-normal text-typography-primary">USDT</span>
              </div>
              <div className="flex items-baseline gap-8">
                <span className="info-label">APR</span>
                <span className="earn-accent-text font-outfit text-[20px] tracking-wider">{strategy.annual_rate}</span>
              </div>
            </div>

            {/* Three columns info */}
            <div className="flex items-center justify-between gap-16 max-md:flex-col max-md:items-start">
              <div className="info-field items-start">
                <span className="info-label">
                  <Trans>Total Quota</Trans>
                </span>
                <div className="value-number">
                  {formatUsdtAmount(strategy.total_quota)} <span className="info-label">USDT</span>
                </div>
              </div>
              <Divider className="h-40" />
              <div className="info-field items-start">
                <span className="info-label whitespace-nowrap">
                  <Trans>Total Interest Distributed</Trans>
                </span>
                <div className="value-number whitespace-nowrap">
                  {(() => {
                    try {
                      // Calculate interest: subscribed_amount * (annual_rate / 100) * (duration_seconds / seconds_per_year)
                      const subscribedAmount =
                        parseFloat(String(strategy.subscribed_amount || "0").replace(/,/g, "")) /
                        Math.pow(10, USDT_DECIMALS);
                      const annualRate =
                        parseFloat(
                          String(strategy.annual_rate || "0")
                            .replace("%", "")
                            .trim()
                        ) / 100;
                      const durationYears = (strategy.duration_seconds || 0) / (365 * 24 * 60 * 60);

                      if (!isFinite(subscribedAmount) || !isFinite(annualRate) || !isFinite(durationYears)) {
                        return "0.00";
                      }

                      const totalInterest = subscribedAmount * annualRate * durationYears;
                      if (!isFinite(totalInterest)) {
                        return "0.00";
                      }

                      return totalInterest.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      });
                    } catch (error) {
                      console.error("[StrategyCard] Error calculating interest:", error);
                      return "0.00";
                    }
                  })()}{" "}
                  <span className="info-label">USDT</span>
                </div>
              </div>
              <Divider className="h-40" />
              <div className="info-field items-start">
                <span className="info-label">
                  <Trans>Term</Trans>
                </span>
                <div className="value-number">
                  {getDurationDays(strategy.duration_seconds)}{" "}
                  <span className="info-label">
                    <Trans>days</Trans>
                  </span>
                </div>
              </div>
            </div>

            {/* Bottom info */}
            <div className="flex flex-col gap-10">
              <p className="info-label m-0">
                <Trans>Participating Addresses:</Trans>{" "}
                <span className="font-normal text-typography-primary">{formatNumber(strategy.subscriber_count)}</span>
              </p>
              <div className="flex items-center gap-8">
                <p className="info-label m-0">
                  <Trans>Contract Address:</Trans>{" "}
                  {contractAddress ? (
                    <a
                      href={`${getExplorerUrl(chainId)}address/${contractAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-light text-typography-primary underline hover:text-[color:var(--earn-accent)]"
                    >
                      {contractAddress}
                    </a>
                  ) : (
                    <span className="font-light text-typography-primary">
                      <Trans>N/A</Trans>
                    </span>
                  )}
                </p>
                <TooltipWithPortal
                  variant="none"
                  handle={<InfoIcon className="faq-icon h-18 w-18 cursor-help" />}
                  renderContent={() => (
                    <Trans>The subscription window is closed. Please check back for the next opening.</Trans>
                  )}
                />
              </div>
            </div>
          </>
        ) : (
          // Active strategy layout
          <>
            {/* Quota Section */}
            <div className="flex flex-col gap-20">
              {/* Top Cards - Remaining Quota/Total Quota & Estimated APR */}
              <div className="grid grid-cols-2 gap-50 max-md:grid-cols-1 max-md:gap-16">
                <div className="apr-card">
                  <span className="apr-card-label">
                    {isActive ? <Trans>Total Quota</Trans> : <Trans>Remaining Quota</Trans>}
                  </span>
                  <span className="apr-card-value">
                    {formatUsdtAmount(isActive ? strategy.total_quota : strategy.available_quota)}{" "}
                    <span className="apr-card-unit">USDT</span>
                  </span>
                </div>
                <div className={`apr-card apr-card-center ${isActive ? "apr-card-live" : ""}`}>
                  <div className="flex items-center gap-8">
                    <span className="apr-card-label">
                      <Trans>Estimated APR</Trans>
                    </span>
                    <TooltipWithPortal
                      position="top"
                      maxAllowedWidth={300}
                      variant="none"
                      handle={<InfoIcon className="faq-icon h-16 w-16 cursor-help" />}
                      renderContent={() => <Trans>Actual APR is determined by the final settlement rate.</Trans>}
                    />
                  </div>
                  <span className="apr-card-value">{strategy.annual_rate}</span>
                </div>
              </div>

              {/* Bottom Info Grid with Button */}
              <div className="flex items-end justify-between gap-40 max-md:flex-col max-md:items-start max-md:gap-20">
                <div className="flex flex-1 items-stretch max-md:w-full max-md:flex-col">
                  <Divider className="mr-16" />
                  {isActive ? (
                    // Active status: Contract Address, Term, Redemption Time
                    <>
                      <div className="info-field" style={{ flex: "0 0 auto", maxWidth: "450px" }}>
                        <div className="flex items-center gap-8">
                          <span className="info-label">
                            <Trans>Contract Address</Trans>
                          </span>
                          <TooltipWithPortal
                            variant="none"
                            handle={<InfoIcon className="faq-icon h-14 w-14 cursor-help" />}
                            renderContent={() => <Trans>Smart contract address for this strategy</Trans>}
                          />
                        </div>
                        <div className="value-number text-left">
                          {contractAddress ? (
                            <a
                              href={`${getExplorerUrl(chainId)}address/${contractAddress}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline hover:text-[color:var(--earn-accent)]"
                            >
                              {contractAddress.slice(0, 6)}...{contractAddress.slice(-4)}
                            </a>
                          ) : (
                            <Trans>N/A</Trans>
                          )}
                        </div>
                      </div>
                      <Divider className="mx-16" />
                      <div className="info-field" style={{ flex: "0 0 auto", maxWidth: "100px" }}>
                        <span className="info-label">
                          <Trans>Term</Trans>
                        </span>
                        <div className="value-number text-left">
                          {getDurationDays(strategy.duration_seconds)}{" "}
                          <span className="info-label">
                            <Trans>days</Trans>
                          </span>
                        </div>
                      </div>
                      <Divider className="mx-16" />
                      <div className="info-field" style={{ flex: "0 0 auto", maxWidth: "300px" }}>
                        <span className="info-label">
                          <Trans>Redemption Time (UTC)</Trans>
                        </span>
                        <span className="value-number text-left">
                          {formatIsoToCompactDateTime(strategy.settle_time)}
                        </span>
                      </div>
                    </>
                  ) : (
                    // Open/Countdown status: Total Quota, Term, Subscription Period
                    <>
                      <div className="info-field" style={{ flex: "0 0 auto", maxWidth: "450px" }}>
                        <span className="info-label">
                          <Trans>Total Quota</Trans>
                        </span>
                        <div className="value-number text-left">
                          {formatUsdtAmount(strategy.total_quota)} <span className="info-label">USDT</span>
                          {(() => {
                            const { totalShares, sharePrice } = getSharesInfo(
                              strategy.total_quota,
                              strategy.min_amount
                            );
                            return (
                              <span className="info-label ml-4">
                                <Trans>
                                  ({totalShares.toLocaleString()} Shares, 1 Share = {sharePrice} USDT)
                                </Trans>
                              </span>
                            );
                          })()}
                        </div>
                      </div>
                      <Divider className="mx-16" />
                      <div className="info-field" style={{ flex: "0 0 auto", maxWidth: "100px" }}>
                        <span className="info-label">
                          <Trans>Term</Trans>
                        </span>
                        <div className="value-number text-left">
                          {getDurationDays(strategy.duration_seconds)}{" "}
                          <span className="info-label">
                            <Trans>days</Trans>
                          </span>
                        </div>
                      </div>
                      <Divider className="mx-16" />
                      <div className="info-field" style={{ flex: "0 0 auto", maxWidth: "350px" }}>
                        <span className="info-label">
                          <Trans>Subscription Period (UTC0)</Trans>
                        </span>
                        <span className="value-number text-left">
                          {formatSubscriptionPeriodCompact(strategy.subscribe_start_time, strategy.subscribe_end_time)}
                        </span>
                      </div>
                    </>
                  )}
                  <Divider className="ml-8" />
                </div>

                {/* Subscribe Button - Only show during subscribing period */}
                {isSubscribing && (
                  <Button
                    variant="primary-action"
                    className="whitespace-nowrap px-20 py-8 uppercase max-md:w-full"
                    onClick={() => (isWalletConnected ? onSubscribeClick?.(strategy) : openConnectModal?.())}
                  >
                    {isWalletConnected ? <Trans>SUBSCRIBE NOW</Trans> : <Trans>CONNECT WALLET</Trans>}
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SubscriptionsTable({
  subscriptions,
  walletAddress,
  chainId,
  mutateSubscriptions,
}: {
  subscriptions: EarnSubscription[];
  walletAddress?: string;
  chainId?: ContractsChainId;
  mutateSubscriptions?: () => void;
}) {
  const [isClaimModalVisible, setIsClaimModalVisible] = useState(false);
  const [selectedSubscription, setSelectedSubscription] = useState<EarnSubscription | null>(null);

  // Validate subscriptions array
  const validSubscriptions = useMemo(() => {
    try {
      if (!Array.isArray(subscriptions)) return [];
      return subscriptions.filter((sub) => sub && typeof sub === "object" && sub.id);
    } catch (error) {
      console.error("[SubscriptionsTable] Error validating subscriptions:", error);
      return [];
    }
  }, [subscriptions]);

  const hasData = validSubscriptions.length > 0;

  const handleClaimClick = (subscription: EarnSubscription) => {
    setSelectedSubscription(subscription);
    setIsClaimModalVisible(true);
  };

  // 空数据时的占位行
  const renderEmptyRow = () => (
    <div className="subscription-row">
      <div className="subscription-status-wrapper">
        <span className="subscription-field-label">
          <Trans>In Progress</Trans>
        </span>
        <span className="subscription-product-name text-typography-tertiary">
          <Trans>N/A</Trans>
        </span>
      </div>

      <Divider className="h-48" />

      <div className="subscription-field-wrapper">
        <span className="subscription-field-label">
          <Trans>Subscription Amount</Trans>
        </span>
        <span className="subscription-field-value text-typography-tertiary">
          <Trans>N/A</Trans>
        </span>
      </div>

      <Divider className="h-48" />

      <div className="subscription-field-wrapper">
        <span className="subscription-field-label">
          <Trans>Estimated Interest</Trans>
        </span>
        <span className="subscription-field-value text-typography-tertiary">
          <Trans>N/A</Trans>
        </span>
      </div>

      <Divider className="h-48" />

      <div className="subscription-field-wrapper">
        <span className="subscription-field-label">
          <Trans>Maturity Date (UTC)</Trans>
        </span>
        <span className="subscription-field-value text-typography-tertiary">
          <Trans>N/A</Trans>
        </span>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-16">
      <h2 className="earn-accent-text font-zanbaraTitle text-h3 m-0 max-md:text-body-large">
        <Trans>My Subscriptions</Trans>
      </h2>
      <div className="subscription-table-container">
        {hasData
          ? validSubscriptions.map((sub) => {
              try {
                return (
                  <div key={sub.id || `sub-${Math.random()}`} className="subscription-row">
                    <div className="subscription-status-wrapper">
                      <span className="subscription-field-label">
                        {sub.nft_status === "matured" ? (
                          <Trans>Matured</Trans>
                        ) : sub.claimed ? (
                          <Trans>Claimed</Trans>
                        ) : (
                          <Trans>In Progress</Trans>
                        )}
                      </span>
                      <span className="subscription-product-name">{sub.product_name}</span>
                    </div>

                    <Divider className="h-48" />

                    <div className="subscription-field-wrapper">
                      <span className="subscription-field-label">
                        <Trans>Subscription Amount</Trans>
                      </span>
                      <div className="flex items-baseline gap-4">
                        <span className="subscription-field-value">{formatUsdtAmount(sub.amount)}</span>
                        <span className="info-label">USDT</span>
                      </div>
                    </div>

                    <Divider className="h-48" />

                    <div className="subscription-field-wrapper">
                      <span className="subscription-field-label">
                        <Trans>Estimated Interest</Trans>
                      </span>
                      <div className="flex items-baseline gap-8">
                        <span className="subscription-field-value">
                          {formatUsdtAmount(sub.actual_return || sub.expected_return)}
                        </span>
                        <span className="info-label">USDT</span>
                        {sub.period_rate && <span className="subscription-interest">+{sub.period_rate}</span>}
                      </div>
                    </div>

                    <Divider className="h-48" />

                    <div className="subscription-field-wrapper">
                      <span className="subscription-field-label">
                        <Trans>Maturity Date (UTC)</Trans>
                      </span>
                      <span className="subscription-field-value">{formatIsoToCompactDateTime(sub.settle_time)}</span>
                    </div>

                    {/* Claim Button - Show if matured and not claimed */}
                    {sub.nft_status === "matured" && !sub.claimed && (
                      <>
                        <Divider className="h-48" />
                        <div className="subscription-field-wrapper">
                          <Button
                            variant="primary-action"
                            className="claim-button"
                            onClick={() => handleClaimClick(sub)}
                          >
                            <Trans>Claim</Trans>
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                );
              } catch (error) {
                console.error("[SubscriptionsTable] Error rendering subscription:", sub?.id, error);
                return null;
              }
            })
          : renderEmptyRow()}
      </div>

      {/* Claim Modal */}
      {selectedSubscription && (
        <ClaimModal
          isVisible={isClaimModalVisible}
          onClose={() => {
            setIsClaimModalVisible(false);
            setSelectedSubscription(null);
          }}
          subscription={selectedSubscription}
          walletAddress={walletAddress}
          chainId={chainId}
          onSuccess={() => {
            mutateSubscriptions?.();
          }}
        />
      )}
    </div>
  );
}

// ERC20 balanceOf ABI
const ERC20_BALANCE_ABI = [
  {
    name: "balanceOf",
    type: "function",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
] as const;

export default function Earn() {
  const { isZanbara } = useDesignSystem();
  const { chainId } = useChainId();
  const { active: isWalletConnected, account } = useWallet();
  const { openConnectModal } = useConnectModal();
  const [isSubscriptionModalVisible, setIsSubscriptionModalVisible] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState<EarnProduct | null>(null);

  const publicClient = usePublicClient({ chainId });

  // Fetch products from API
  const { products, isLoading: isLoadingProducts } = useEarnProducts(chainId);

  // Fetch user subscriptions (only when wallet connected)
  const {
    subscriptions: apiSubscriptions,
    isLoading: isLoadingSubscriptions,
    mutate: mutateSubscriptions,
  } = useEarnSubscriptions(chainId);

  // Get earn contract address and USDT address
  const earnContractAddress = chainId ? getEarnContractAddress(chainId) : undefined;
  const usdtAddress = chainId ? getTradingUsdtAddress(chainId) : undefined;

  // Fetch real USDT balance from wallet
  const { data: usdtBalanceRaw, error: usdtBalanceError } = useSWR(
    isWalletConnected && account && usdtAddress && publicClient
      ? ["usdt-balance", chainId, account, usdtAddress]
      : null,
    async () => {
      try {
        if (!publicClient || !usdtAddress || !account) return null;
        const balance = await publicClient.readContract({
          address: usdtAddress as `0x${string}`,
          abi: ERC20_BALANCE_ABI,
          functionName: "balanceOf",
          args: [account as `0x${string}`],
        });
        return balance;
      } catch (error) {
        console.error("[Earn] Error fetching USDT balance:", error);
        return null;
      }
    },
    {
      refreshInterval: 30000,
      shouldRetryOnError: false,
      onError: (err) => {
        console.error("[Earn] USDT balance fetch error:", err);
      },
    }
  );

  // Format USDT balance (6 decimals)
  const usdtBalance = useMemo(() => {
    try {
      if (usdtBalanceRaw === undefined || usdtBalanceRaw === null) return "0.00";
      const formatted = formatUnits(usdtBalanceRaw, 6);
      const num = parseFloat(formatted);
      if (!isFinite(num) || isNaN(num)) return "0.00";
      return num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } catch (error) {
      console.error("[Earn] Error formatting USDT balance:", error);
      return "0.00";
    }
  }, [usdtBalanceRaw]);

  // 直接使用 API 数据，不再需要映射 / mock
  // Add safety checks for array data
  const strategies: EarnProduct[] = useMemo(() => {
    try {
      return Array.isArray(products) ? products : [];
    } catch (error) {
      console.error("[Earn] Error processing products:", error);
      return [];
    }
  }, [products]);

  const subscriptions: EarnSubscription[] = useMemo(() => {
    try {
      return Array.isArray(apiSubscriptions) ? apiSubscriptions : [];
    } catch (error) {
      console.error("[Earn] Error processing subscriptions:", error);
      return [];
    }
  }, [apiSubscriptions]);

  // Active strategies: subscribing (can subscribe), active (running)
  // Note: "created" status products are not shown (waiting for backend to open subscription)
  const activeStrategies = useMemo(() => {
    try {
      return strategies.filter((s) => s && (s.status === "subscribing" || s.status === "active"));
    } catch (error) {
      console.error("[Earn] Error filtering active strategies:", error);
      return [];
    }
  }, [strategies]);

  // Completed strategies: settling, settled, cancelled, ended
  const completedStrategies = useMemo(() => {
    try {
      return strategies.filter(
        (s) =>
          s && (s.status === "settling" || s.status === "settled" || s.status === "cancelled" || s.status === "ended")
      );
    } catch (error) {
      console.error("[Earn] Error filtering completed strategies:", error);
      return [];
    }
  }, [strategies]);

  // Check if there are any subscriptions that are not fully redeemed
  // Hide "My Subscriptions" section if all subscriptions are redeemed
  const hasNonRedeemedSubscriptions = useMemo(() => {
    try {
      return subscriptions.some((sub) => sub && sub.nft_status !== "redeemed");
    } catch (error) {
      console.error("[Earn] Error checking subscriptions:", error);
      return false;
    }
  }, [subscriptions]);

  /** 数据拉取中：先铺遮罩（与 Scanning 同区域），下一帧再出 Loader，避免先闪转圈再出蒙层 */
  const [showEarnDataLoader, setShowEarnDataLoader] = useState(false);

  useEffect(() => {
    if (!isLoadingProducts) {
      setShowEarnDataLoader(false);
      return;
    }
    setShowEarnDataLoader(false);
    let raf1 = 0;
    let raf2 = 0;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setShowEarnDataLoader(true));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [isLoadingProducts]);

  useEffect(() => {
    if (!isLoadingProducts) return;

    const detectDimensions = () => {
      const sidebar = document.querySelector(".zanbara-sidenav");
      if (sidebar) {
        const w = sidebar.getBoundingClientRect().width;
        document.documentElement.style.setProperty("--detected-sidebar-width", `${w > 0.5 ? w : 0}px`);
      } else {
        document.documentElement.style.setProperty("--detected-sidebar-width", "0px");
      }

      const header = document.querySelector('[data-qa="header"]') ?? document.querySelector("header");
      if (header) {
        const height = header.getBoundingClientRect().height;
        document.documentElement.style.setProperty("--detected-header-height", `${height}px`);
      }
    };

    detectDimensions();
    window.addEventListener("resize", detectDimensions);

    const sidebar = document.querySelector(".zanbara-sidenav");
    const sidebarObserver = sidebar ? new MutationObserver(detectDimensions) : null;
    if (sidebarObserver && sidebar) {
      sidebarObserver.observe(sidebar, { attributes: true, attributeFilter: ["class"] });
    }

    const headerEl = document.querySelector('[data-qa="header"]') ?? document.querySelector("header");
    const ro = headerEl ? new ResizeObserver(() => detectDimensions()) : null;
    if (ro && headerEl) {
      ro.observe(headerEl);
    }

    return () => {
      window.removeEventListener("resize", detectDimensions);
      sidebarObserver?.disconnect();
      ro?.disconnect();
      document.documentElement.style.removeProperty("--detected-sidebar-width");
      document.documentElement.style.removeProperty("--detected-header-height");
    };
  }, [isLoadingProducts]);

  const inner = (
    <>
      <EarnErrorBoundary>
        <div className="earn-page-wrapper">
          {isLoadingProducts ? (
            <>
              <div className="earn-initial-loading-mask" aria-hidden />
              {showEarnDataLoader ? (
                <div className="earn-initial-loading-loader">
                  <Loader />
                </div>
              ) : null}
            </>
          ) : (
            <>
              {/* Scanning Effect - Only covers content area */}
              <ScanningEffect duration={3500} />

              <div className="earn-page flex w-full flex-col gap-24 max-md:gap-20">
                {/* Earn Title Component */}
                <EarnTitle />

                {/* Active Strategy Cards */}
                {activeStrategies.length > 0 ? (
                  activeStrategies.map((strategy) => {
                    try {
                      if (!strategy || !strategy.id) {
                        console.warn("[Earn] Invalid strategy in activeStrategies:", strategy);
                        return null;
                      }
                      return (
                        <StrategyCard
                          key={strategy.id}
                          strategy={strategy}
                          isWalletConnected={isWalletConnected}
                          openConnectModal={openConnectModal}
                          contractAddress={earnContractAddress}
                          onSubscribeClick={(strategy) => {
                            setSelectedStrategy(strategy);
                            setIsSubscriptionModalVisible(true);
                          }}
                        />
                      );
                    } catch (error) {
                      console.error("[Earn] Error rendering active strategy:", strategy?.id, error);
                      return null;
                    }
                  })
                ) : (
                  <div className="strategy-card border-1/2 border-slate-700 p-40 max-md:p-24">
                    <div className="flex flex-col items-center justify-center gap-16 text-center">
                      <h3 className="text-h3 m-0 text-typography-secondary">
                        <Trans>No Active Strategies</Trans>
                      </h3>
                      <p className="text-typography-tertiary text-body-medium m-0 max-w-[400px]">
                        <Trans>
                          There are currently no active earn strategies available. Please check back later for new
                          opportunities.
                        </Trans>
                      </p>
                    </div>
                  </div>
                )}

                {/* Past Performance Card */}
                <PastPerformanceChart completedStrategies={completedStrategies} />

                {/* My Subscriptions Card - Hide if all subscriptions are redeemed */}
                {isWalletConnected && hasNonRedeemedSubscriptions && (
                  <div className="strategy-card border-1/2 border-slate-700 p-24 max-md:p-16">
                    <SubscriptionsTable
                      subscriptions={subscriptions}
                      walletAddress={account}
                      chainId={chainId}
                      mutateSubscriptions={mutateSubscriptions}
                    />
                  </div>
                )}

                {/* Completed strategies section */}
                {completedStrategies.length > 0 && (
                  <div className="flex flex-col gap-20">
                    {/* COMPLETED Badge - centered above the grid */}
                    <div className="flex justify-center">
                      {isZanbara ? (
                        <SectionLabel>
                          <Trans>COMPLETED</Trans>
                        </SectionLabel>
                      ) : (
                        <div className="completed-badge">
                          <span>
                            <Trans>COMPLETED</Trans>
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Grid layout for completed strategies */}
                    <div className="grid grid-cols-2 gap-50 max-md:grid-cols-1 max-md:gap-16">
                      {(() => {
                        try {
                          return [...completedStrategies].reverse().map((strategy) => {
                            try {
                              if (!strategy || !strategy.id) {
                                console.warn("[Earn] Invalid strategy in completedStrategies:", strategy);
                                return null;
                              }
                              return (
                                <StrategyCard
                                  key={strategy.id}
                                  strategy={strategy}
                                  isWalletConnected={isWalletConnected}
                                  openConnectModal={openConnectModal}
                                  contractAddress={earnContractAddress}
                                />
                              );
                            } catch (error) {
                              console.error("[Earn] Error rendering completed strategy:", strategy?.id, error);
                              return null;
                            }
                          });
                        } catch (error) {
                          console.error("[Earn] Error processing completed strategies:", error);
                          return null;
                        }
                      })()}
                    </div>
                  </div>
                )}
              </div>

              {/* Subscription Modal */}
              {selectedStrategy && (
                <SubscriptionModal
                  isVisible={isSubscriptionModalVisible}
                  onClose={() => {
                    setIsSubscriptionModalVisible(false);
                    setSelectedStrategy(null);
                  }}
                  strategy={selectedStrategy}
                  walletAddress={account}
                  balance={usdtBalance}
                  chainId={chainId}
                  earnContractAddress={earnContractAddress}
                  onSuccess={() => {
                    // Refresh subscriptions after successful subscription
                    mutateSubscriptions();
                  }}
                />
              )}
            </>
          )}
        </div>
      </EarnErrorBoundary>
    </>
  );

  if (isZanbara) {
    return (
      <LighterShell>
        <div className="mx-auto flex w-full max-w-[1512px] grow flex-col gap-1 pb-8 pt-0 max-md:px-1">{inner}</div>
      </LighterShell>
    );
  }

  return <AppPageLayout header={<ChainContentHeader title={t`Earn`} />}>{inner}</AppPageLayout>;
}
