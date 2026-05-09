import { Trans, t } from "@lingui/macro";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useCopyToClipboard } from "react-use";
import useSWR from "swr";

import { getOnChainReferralDashboard } from "@/modules/lighter/api/custom/client";
import { useBindReferralCode } from "@/modules/lighter/api/custom/useReferralCode";
import { useReferralDashboard } from "@/modules/lighter/api/custom/useReferralDashboard";
import { useReferralLeaderboard } from "@/modules/lighter/api/custom/useReferralLeaderboard";
import { useReferralStatus } from "@/modules/lighter/api/custom/useReferralStatus";
import type {
  OnChainDashboardResponse,
  ReferralDashboardResponse,
  ReferralTier,
} from "@/modules/lighter/api/types";
import type { ContractsChainId } from "config/chains";
import type { ReferralCodeStats, TotalReferralsStats } from "domain/referrals";
import { useReferralCodeFromUrl } from "domain/referrals/hooks/useReferralCodeFromUrl";
import { helperToast } from "lib/helperToast";
import { parseValue } from "lib/numbers";
import { formatUsd } from "lib/numbers";
import { userAnalytics } from "lib/userAnalytics";
import type { ReferralShareEvent } from "lib/userAnalytics/types";
import { useDesignSystem } from "shared/context/DesignSystemContext/DesignSystemContext";
import { Button, ExchangeTabs, PrimaryActionButton, ZanbaraCornerBracketFrame } from "shared/ui";

import { AffiliateCodeCreateButton } from "components/Referrals/AddAffiliateCode";
import { getReferralCodeTradeUrl } from "components/Referrals/referralsHelper";

import { refFigmaAsset } from "./zanbaraReferralsFigmaAssets";
import { ReferralTierBadge16 } from "./ReferralTierBadge16";
import { REFERRAL_OFFCHAIN_MIN_CLAIM_USDT, useReferralRebateClaim } from "../../hooks/useReferralRebateClaim";
import "./ZanbaraReferralsPage.css";

/** Figma Zanbara-Website v1.0 · Referrals 156:2400 — tier ladder (invitees + volume + display rate) */
const FIGMA_TIER_ROWS: ReadonlyArray<{
  id: string;
  displayName: string;
  minInvitees: number;
  minVolumeUsd: number;
  displayRatePct: number;
  tierBadge: "none" | "crownGold" | "crownTeal" | "crownYellow" | "diamond";
  nameColor: "muted" | "gold" | "silver" | "yellow" | "cyan";
}> = [
  { id: "starter", displayName: "Starter", minInvitees: 1, minVolumeUsd: 1_000, displayRatePct: 10, tierBadge: "none", nameColor: "muted" },
  { id: "bronze", displayName: "Bronze", minInvitees: 5, minVolumeUsd: 10_000, displayRatePct: 12, tierBadge: "crownGold", nameColor: "gold" },
  { id: "silver", displayName: "Silver", minInvitees: 20, minVolumeUsd: 100_000, displayRatePct: 17, tierBadge: "crownTeal", nameColor: "silver" },
  { id: "gold", displayName: "Gold", minInvitees: 50, minVolumeUsd: 500_000, displayRatePct: 22, tierBadge: "crownYellow", nameColor: "yellow" },
  { id: "diamond", displayName: "Diamond", minInvitees: 100, minVolumeUsd: 2_000_000, displayRatePct: 25, tierBadge: "diamond", nameColor: "cyan" },
];
/** 再次绑定不同推荐码的最短间隔 */
const REFERRAL_REBIND_COOLDOWN_MS = 90 * 24 * 60 * 60 * 1000;

type InvitePanelTab = "invite" | "bind";

function formatUsdCompact(s: string | number | undefined): string {
  if (s === undefined || s === "") return "—";
  const v = typeof s === "number" ? s : parseFloat(String(s));
  if (!Number.isFinite(v)) return "—";
  /* 固定 en-US + narrowSymbol，避免 en-CA 等环境出现「US$」前缀 */
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: 2,
  }).format(v);
}

function formatVolShort(usd: number): string {
  if (!Number.isFinite(usd) || usd <= 0) return "—";
  if (usd >= 1_000_000) {
    const m = usd / 1_000_000;
    const t = m >= 10 ? m.toFixed(0) : m.toFixed(1).replace(/\.0$/, "");
    return `$${t}M`;
  }
  if (usd >= 1_000) {
    return `$${Math.round(usd / 1_000)}K`;
  }
  return formatUsdCompact(usd);
}

function formatAddrMid(address: string): string {
  if (!address) return "";
  if (address.length <= 14) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function normalizeTierToken(s: string | undefined | null): string {
  return (s ?? "").trim().toLowerCase();
}

/** 邀请人数 + 成交量均已满足的阶梯中最高一档（与表格门槛一致）。 */
function resolveCurrentTierIdFromProgress(totalReferrals: number, volumeUsd: number): string | null {
  let best: string | null = null;
  for (const row of FIGMA_TIER_ROWS) {
    if (totalReferrals >= row.minInvitees && volumeUsd >= row.minVolumeUsd) {
      best = row.id;
    }
  }
  return best;
}

/** 接口 / 链上 tier 名或 current_tier 索引 → 表格 row.id（优先 REST `dashboard.tier`，与控制台看到的 tier 对象一致） */
function resolveCurrentTierIdFromApi(
  apiTier: ReferralTier | undefined,
  onChain: OnChainDashboardResponse | undefined
): string | null {
  const fromChain = normalizeTierToken(onChain?.tier_name);
  const fromApi = normalizeTierToken(apiTier?.name);
  const raw = fromApi || fromChain;
  if (raw) {
    if (raw.includes("diamond")) return "diamond";
    if (raw.includes("platinum")) return "diamond";
    if (raw.includes("gold") || raw.includes("glod")) return "gold";
    if (raw.includes("silver")) return "silver";
    if (raw.includes("bronze")) return "bronze";
    if (raw.includes("starter")) return "starter";
  }
  const idx = onChain?.current_tier;
  if (typeof idx === "number" && idx >= 0 && idx < FIGMA_TIER_ROWS.length) {
    return FIGMA_TIER_ROWS[idx]?.id ?? null;
  }
  return null;
}

/**
 * Recent Tier 行高亮：优先「进度已达标」档位；否则用接口/链上档位；仍无则默认 Starter（避免整表无选中）。
 * 佣金列仍固定为阶梯 displayRatePct，不与接口 rate 混写。
 */
function resolveRecentTierRowId(
  disconnected: boolean | undefined,
  totalReferrals: number,
  volumeUsd: number,
  apiTier: ReferralTier | undefined,
  onChain: OnChainDashboardResponse | undefined
): string | null {
  if (disconnected) return null;
  const fromProgress = resolveCurrentTierIdFromProgress(totalReferrals, volumeUsd);
  if (fromProgress) return fromProgress;
  const fromApi = resolveCurrentTierIdFromApi(apiTier, onChain);
  if (fromApi) return fromApi;
  return "starter";
}

function FigmaHLine({ variant = "line5" }: { variant?: "line2" | "line5" | "line7" }) {
  const src = variant === "line2" ? refFigmaAsset.line2 : variant === "line7" ? refFigmaAsset.line7 : refFigmaAsset.line5;
  return (
    <div className="ref-figma-hr" aria-hidden>
      <img className="ref-figma-hr__img" src={src} alt="" />
    </div>
  );
}

function FigmaVLine({ className }: { className?: string }) {
  return (
    <div className={className ?? "ref-figma-vr"} aria-hidden>
      <img className="ref-figma-vr__img" src={refFigmaAsset.line3} alt="" />
    </div>
  );
}

function CheckIcon({ accent }: { accent?: boolean }) {
  return <img className="ref-tier-check" src={accent ? refFigmaAsset.checkAccent : refFigmaAsset.checkMuted} alt="" width={16} height={16} />;
}

function InviteeBenefitsBlock() {
  return (
    <section className="ref-benefits">
      <div className="ref-benefits__head">
        <h2 className="ref-benefits__title">
          <Trans>Invitee Benefits</Trans>
        </h2>
        <p className="ref-benefits__sub">
          <Trans>Friends who register with your code receive these benefits immediately</Trans>
        </p>
      </div>
      <FigmaHLine variant="line2" />
      <div className="ref-benefits__cols">
        <div className="ref-benefits__col">
          <div className="ref-benefits__k">
            <Trans>Taker Fee</Trans>
          </div>
          <div className="ref-benefits__big ref-benefits__big--discount">
            <Trans>10% discount</Trans>
          </div>
          <div className="ref-benefits__fine-stack">
            <p className="ref-benefits__fine">
              <Trans>First Month Only</Trans>
            </p>
            <p className="ref-benefits__fine">
              <Trans>VIP0: 0.040% → 0.036%</Trans>
            </p>
          </div>
        </div>
        <FigmaVLine className="ref-benefits__vr" />
        <div className="ref-benefits__col">
          <div className="ref-benefits__k">
            <Trans>Maker Fee</Trans>
          </div>
          <div className="ref-benefits__big ref-benefits__big--discount">
            <Trans>20% discount</Trans>
          </div>
          <div className="ref-benefits__fine-stack">
            <p className="ref-benefits__fine">
              <Trans>First Month Only</Trans>
            </p>
            <p className="ref-benefits__fine">
              <Trans>VIP0: 0.040% → 0.032%</Trans>
            </p>
          </div>
        </div>
        <FigmaVLine className="ref-benefits__vr" />
        <div className="ref-benefits__col">
          <div className="ref-benefits__k">
            <Trans>RP Points Bonus</Trans>
          </div>
          <div className="ref-benefits__big ref-benefits__big--discount">
            <Trans>+10 RP</Trans>
          </div>
          <div className="ref-benefits__fine-stack">
            <p className="ref-benefits__fine">
              <Trans>First Qualifying Trade</Trans>
            </p>
            <p className="ref-benefits__fine">
              <Trans>≥ $1,000 trade, both parties receive</Trans>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

type RecentTierProps = {
  disconnected?: boolean;
  totalReferrals: number;
  volumeUsd: number;
  apiTier?: ReferralTier;
  onChain?: OnChainDashboardResponse;
};

function RecentTierSection({ disconnected, totalReferrals, volumeUsd, apiTier, onChain }: RecentTierProps) {
  const currentId = resolveRecentTierRowId(disconnected, totalReferrals, volumeUsd, apiTier, onChain);

  return (
    <section className="ref-panel ref-panel--tier">
      <h2 className="ref-panel__title ref-panel__title--solo">
        <Trans>Recent Tier</Trans>
      </h2>
      <FigmaHLine />
      <div className="ref-tier-grid ref-tier-grid--head">
        <div className="ref-tier-c1">
          <Trans>Tier</Trans>
        </div>
        <div className="ref-tier-c2">
          <Trans>Invitees Required</Trans>
        </div>
        <div className="ref-tier-c3">
          <Trans>Volume Required</Trans>
        </div>
        <div className="ref-tier-c4">
          <Trans>Commission Rate</Trans>
        </div>
      </div>
      <div className="ref-tier-rows">
        {FIGMA_TIER_ROWS.map((row) => {
          const isCurrent = !disconnected && currentId === row.id;
          const invMet = disconnected ? false : totalReferrals >= row.minInvitees;
          const volMet = disconnected ? false : volumeUsd >= row.minVolumeUsd;
          const goldNeedFromSilver = !disconnected && row.id === "gold" && currentId === "silver";
          const rateLabel = `${row.displayRatePct}%`;

          return (
            <div key={row.id} className={`ref-tier-row ${isCurrent ? "is-current" : ""}`}>
              <div className="ref-tier-grid ref-tier-grid--body">
                <div className={`ref-tier-c1 ref-tier-name-wrap ref-tier-name--${row.nameColor}`}>
                  <span
                    className={
                      isCurrent ? "ref-tier-row-bar ref-tier-row-bar--active" : "ref-tier-row-bar ref-tier-row-bar--inactive"
                    }
                    aria-hidden
                  />
                  <span className="ref-tier-name-badge">
                    <ReferralTierBadge16 kind={row.tierBadge} />
                    <span className="ref-tier-name">{row.displayName}</span>
                  </span>
                </div>
                <div className="ref-tier-c2 ref-tier-cell">
                  <span className="ref-tier-threshold">≥ {row.minInvitees}</span>
                  {disconnected ? null : isCurrent ? (
                    <>
                      <span className="ref-tier-progress">
                        {totalReferrals}/{row.minInvitees}
                      </span>
                      {invMet ? <CheckIcon accent /> : null}
                    </>
                  ) : goldNeedFromSilver && totalReferrals < row.minInvitees ? (
                    <span className="ref-tier-need">{t`Need ${row.minInvitees - totalReferrals} more`}</span>
                  ) : goldNeedFromSilver && totalReferrals >= row.minInvitees ? (
                    <CheckIcon accent={false} />
                  ) : invMet ? (
                    <CheckIcon accent={false} />
                  ) : null}
                </div>
                <div className="ref-tier-c3 ref-tier-cell">
                  <span className="ref-tier-threshold">≥ {formatVolShort(row.minVolumeUsd)}</span>
                  {disconnected ? null : isCurrent ? (
                    <>
                      <span className="ref-tier-progress">{formatVolShort(volumeUsd)}</span>
                      {volMet ? <CheckIcon accent /> : null}
                    </>
                  ) : goldNeedFromSilver && volumeUsd < row.minVolumeUsd ? (
                    <span className="ref-tier-need">
                      <Trans>Need</Trans> {formatVolShort(row.minVolumeUsd - volumeUsd)}
                    </span>
                  ) : goldNeedFromSilver && volumeUsd >= row.minVolumeUsd ? (
                    <CheckIcon accent={false} />
                  ) : volMet ? (
                    <CheckIcon accent={false} />
                  ) : null}
                </div>
                <div className={`ref-tier-c4 ref-tier-rate ref-tier-name--${row.nameColor}`}>{rateLabel}</div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** 第三张统计卡：链下领取返佣（`POST /referral/claim`，≥10 USDT）。 */
function ClaimCommissionStatCard({
  dashboard,
  isClaiming,
  onClaim,
}: {
  dashboard: ReferralDashboardResponse;
  isClaiming: boolean;
  onClaim: () => void;
}) {
  const pendingN = parseFloat(dashboard.pending_earnings || "0");
  const hasPendingEarnings = Number.isFinite(pendingN) && pendingN > 0;
  const canClaimOffChain = hasPendingEarnings && pendingN >= REFERRAL_OFFCHAIN_MIN_CLAIM_USDT;
  const pendingBelowMin = hasPendingEarnings && pendingN < REFERRAL_OFFCHAIN_MIN_CLAIM_USDT;
  const mainValue = hasPendingEarnings
    ? formatUsd(parseValue(dashboard.pending_earnings, 30), { fallbackToZero: true })
    : "—";
  const hint = isClaiming ? (
    <Trans>Claiming...</Trans>
  ) : canClaimOffChain ? (
    <Trans>Instant credit to your balance — no on-chain transaction.</Trans>
  ) : pendingBelowMin ? (
    <Trans>Minimum claim is {REFERRAL_OFFCHAIN_MIN_CLAIM_USDT} USDT.</Trans>
  ) : (
    <Trans>No pending commission</Trans>
  );
  return (
    <article className={`ref-stat-card${canClaimOffChain ? " ref-stat-card--claimable" : ""}`}>
      <div className="ref-stat-card__label">
        <Trans>Claim commission</Trans>
      </div>
      <div className={`ref-stat-card__value ${hasPendingEarnings ? "ref-stat-card__value--accent" : ""}`}>{mainValue}</div>
      <div className="ref-stat-card__hint">{hint}</div>
      {canClaimOffChain ? (
        <Button
          type="button"
          appearance="main-40"
          intent="main"
          className="ref-stat-card__claim"
          loading={isClaiming}
          disabled={isClaiming}
          onClick={() => void onClaim()}
        >
          <Trans>Claim rebate</Trans>
        </Button>
      ) : null}
    </article>
  );
}

export type ZanbaraReferralsPageProps = {
  chainId: ContractsChainId;
  account: string | undefined;
  active: boolean;
  loadingLegacy: boolean;
  referralsData?: TotalReferralsStats;
  recentlyAddedCodes: ReferralCodeStats[];
};

export function ZanbaraReferralsPage({
  chainId,
  account,
  active,
  loadingLegacy: _loadingLegacy,
  referralsData: _referralsData,
  recentlyAddedCodes: _recentlyAddedCodes,
}: ZanbaraReferralsPageProps) {
  const { openConnectModal } = useConnectModal();
  const { isZanbara } = useDesignSystem();
  const [, copyToClipboard] = useCopyToClipboard();
  const referralCodeFromUrl = useReferralCodeFromUrl();

  const dashboardEnabled = Boolean(account && active);
  const { dashboard, mutate: mutateDash, isLoading: isDashboardLoading } = useReferralDashboard(chainId, {
    enabled: dashboardEnabled,
  });
  const { bind: bindReferralCode, loading: bindLoading, error: bindError } = useBindReferralCode();
  const { handleClaim, isClaiming } = useReferralRebateClaim(chainId, dashboard, mutateDash);
  const { mutate: mutateStatus } = useReferralStatus(chainId, {
    enabled: dashboardEnabled,
  });
  const { rows: leaderboardApiRows, isLoading: isLeaderboardLoading, n: leaderboardN } = useReferralLeaderboard(chainId);
  const [inviteTab, setInviteTab] = useState<InvitePanelTab>("invite");
  const [bindCodeInput, setBindCodeInput] = useState("");

  const boundAtMs = useMemo(() => {
    const raw = dashboard?.bound_referral?.bound_at;
    if (!raw) return null;
    const asNum = Number(raw);
    if (Number.isFinite(asNum) && asNum > 0) {
      return asNum > 1_000_000_000_000 ? asNum : asNum * 1000;
    }
    const parsed = Date.parse(raw);
    return Number.isNaN(parsed) ? null : parsed;
  }, [dashboard?.bound_referral?.bound_at]);
  const canRebind = useMemo(() => {
    if (!dashboard?.bound_referral?.code) return true;
    if (!boundAtMs) return false;
    return Date.now() - boundAtMs >= REFERRAL_REBIND_COOLDOWN_MS;
  }, [dashboard?.bound_referral?.code, boundAtMs]);
  const rebindDaysLeft = useMemo(() => {
    if (!dashboard?.bound_referral?.code || !boundAtMs) return null;
    const msLeft = REFERRAL_REBIND_COOLDOWN_MS - (Date.now() - boundAtMs);
    if (msLeft <= 0) return 0;
    return Math.ceil(msLeft / (24 * 60 * 60 * 1000));
  }, [dashboard?.bound_referral?.code, boundAtMs]);

  /** 已绑定且未到可重绑时间：输入框只读展示当前绑定码（避免空占位） */
  const boundReferralCodeTrimmed = (dashboard?.bound_referral?.code ?? "").trim();
  const bindInputShowsLockedBoundCode = Boolean(boundReferralCodeTrimmed && !canRebind);
  const bindCodeInputValue = bindInputShowsLockedBoundCode
    ? boundReferralCodeTrimmed.toUpperCase()
    : bindCodeInput;

  useEffect(() => {
    if (!referralCodeFromUrl) return;
    if (dashboard?.bound_referral?.code && !canRebind) return;
    setInviteTab("bind");
    setBindCodeInput(referralCodeFromUrl.toUpperCase());
  }, [referralCodeFromUrl, dashboard?.bound_referral?.code, canRebind]);

  const { data: onChainDash } = useSWR(
    chainId && account ? [`ref-onchain-dash`, chainId, account.toLowerCase()] : null,
    () => getOnChainReferralDashboard(chainId, account as string),
    { revalidateOnFocus: false }
  );

  const volumeUsd = useMemo(() => {
    const rest = dashboard?.total_referred_volume;
    if (rest != null && rest !== "") {
      const n = parseFloat(rest);
      if (Number.isFinite(n)) return n;
    }
    const raw = onChainDash?.total_volume_usd;
    if (raw == null) return 0;
    const n = parseFloat(raw);
    return Number.isFinite(n) ? n : 0;
  }, [dashboard?.total_referred_volume, onChainDash?.total_volume_usd]);

  const referralLink = useMemo(() => {
    if (!dashboard?.code) return "";
    return getReferralCodeTradeUrl(dashboard.code);
  }, [dashboard?.code]);

  const leaderboardRows = useMemo(
    () =>
      leaderboardApiRows.map((row) => ({
        rank: row.rank,
        address: row.referrer_address,
        reward: formatUsdCompact(row.total_commission),
        isSelf: Boolean(account && row.referrer_address?.toLowerCase() === account.toLowerCase()),
      })),
    [leaderboardApiRows, account]
  );

  const selfRowInTop = useMemo(() => leaderboardRows.find((r) => r.isSelf), [leaderboardRows]);

  const rankTone = (rank: number) => {
    if (rank === 1) return "ref-lb-row__rank--gold";
    if (rank === 2) return "ref-lb-row__rank--silver";
    if (rank === 3) return "ref-lb-row__rank--bronze";
    return "ref-lb-row__rank--muted";
  };

  const invitePanelTabOptions = useMemo(
    () =>
      [
        { value: "invite" as InvitePanelTab, label: <Trans>My Invite Link</Trans> },
        { value: "bind" as InvitePanelTab, label: <Trans>Enter Referral Code</Trans> },
      ],
    []
  );

  const handleCopyLink = useCallback(() => {
    if (!referralLink) return;
    userAnalytics.pushEvent<ReferralShareEvent>({ event: "ReferralCodeAction", data: { action: "CopyCode" } }, { instantSend: true });
    copyToClipboard(referralLink);
    helperToast.success(t`Referral link copied`);
  }, [referralLink, copyToClipboard]);

  const handleCopyCodeOnly = useCallback(() => {
    if (!dashboard?.code) return;
    copyToClipboard(dashboard.code);
    helperToast.success(t`Referral code copied`);
  }, [dashboard?.code, copyToClipboard]);

  const handleBindCodeSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const normalizedCode = bindCodeInput.trim().toUpperCase();
      if (!normalizedCode || bindLoading || (dashboard?.bound_referral?.code && !canRebind)) return;
      const result = await bindReferralCode(normalizedCode);
      if (!result) return;
      setBindCodeInput("");
      void mutateDash();
      void mutateStatus();
    },
    [bindCodeInput, bindLoading, dashboard?.bound_referral?.code, canRebind, bindReferralCode, mutateDash, mutateStatus]
  );

  /** `omitHero`：外层已渲染 `ref-hero`（已连接等 dashboard）时不再重复页头 */
  const renderDisconnectedStyleMain = (showConnectWallet: boolean, omitHero?: boolean) => (
    <>
      {!omitHero ? (
        <section className="ref-hero">
          <h1 className="ref-hero__title">
            <Trans>Referral Center</Trans>
          </h1>
          <p className="ref-hero__sub">
            <Trans>Invite friends, earn commissions, accumulate forever</Trans>
          </p>
          {showConnectWallet ? (
            <ZanbaraCornerBracketFrame className="w-fit max-w-full" enabled={isZanbara}>
              <PrimaryActionButton
                type="button"
                className="connect-wallet-cta min-w-[240px]"
                onClick={() => openConnectModal?.()}
              >
                <Trans>Connect Wallet</Trans>
              </PrimaryActionButton>
            </ZanbaraCornerBracketFrame>
          ) : null}
        </section>
      ) : null}

      <div className="ref-stat-grid">
        <article className="ref-stat-card">
          <div className="ref-stat-card__label">
            <Trans>Total Referrals</Trans>
          </div>
          <div className="ref-stat-card__value">—</div>
          <div className="ref-stat-card__hint">
            <Trans>Direct invitees</Trans>
          </div>
        </article>
        <article className="ref-stat-card ref-stat-card--accent">
          <div className="ref-stat-card__label">
            <Trans>Total Commission</Trans>
          </div>
          <div className="ref-stat-card__value ref-stat-card__value--accent">—</div>
          <div className="ref-stat-card__hint">
            <Trans>Cumulative earnings (lifetime)</Trans>
          </div>
        </article>
        <article className="ref-stat-card">
          <div className="ref-stat-card__label">
            <Trans>Claim commission</Trans>
          </div>
          <div className="ref-stat-card__value">—</div>
          <div className="ref-stat-card__hint">—</div>
        </article>
      </div>

      <section className="ref-panel ref-panel--invite">
        <div className="ref-panel__head">
          <h2 className="ref-panel__title">
            <Trans>My Invite Link</Trans>
          </h2>
          {/* Share CTA hidden temporarily by product request */}
        </div>
        <FigmaHLine />
        <div className="ref-invite-grid">
          <div>
            <div className="ref-field-label">
              <Trans>Referral Link</Trans>
            </div>
            <div className="ref-faux-input">
              <span className="ref-faux-input__val ref-faux-input__val--link">—</span>
              <button type="button" className="ref-copy-link" disabled>
                <Trans>Copy</Trans>
              </button>
            </div>
          </div>
          <div>
            <div className="ref-field-label">
              <Trans>My Referral Code</Trans>
            </div>
            <div className="ref-faux-input">
              <span className="ref-faux-input__val">—</span>
              <button type="button" className="ref-copy-link" disabled>
                <Trans>Copy</Trans>
              </button>
            </div>
          </div>
        </div>
      </section>

      <RecentTierSection disconnected totalReferrals={0} volumeUsd={0} />

      <InviteeBenefitsBlock />
    </>
  );

  const renderRewardSide = (disconnected: boolean) => {
    const showLbPlaceholders = isLeaderboardLoading || !leaderboardRows.length;
    return (
    <aside className="ref-side">
      <div className="ref-side__head">
        <div className="ref-side__title">
          <Trans>Reward Leaderboard</Trans>
        </div>
        <div className="ref-side__tag">
          TOP {leaderboardN}
        </div>
      </div>
      <div className="ref-side__table-head">
        <span>
          <Trans>Rank</Trans>
        </span>
        <span className="ref-side__th-mid">
          <Trans>Wallet</Trans>
        </span>
        <span className="ref-side__th-end">
          <Trans>Reward</Trans>
        </span>
      </div>
      <div className="ref-lb-list">
        {showLbPlaceholders
          ? Array.from({ length: leaderboardN }, (_, i) => (
              <div key={i} className="ref-lb-row">
                <span className={`ref-lb-row__rank ${rankTone(i + 1)}`}>{i + 1}</span>
                <span className="ref-lb-row__addr">—</span>
                <span className="ref-lb-row__pts">—</span>
              </div>
            ))
          : leaderboardRows.map((row) => (
              <div key={`${row.rank}-${row.address ?? "x"}`} className={`ref-lb-row ${row.isSelf ? "is-self" : ""}`}>
                <span className={`ref-lb-row__rank ${rankTone(row.rank)}`}>{row.rank}</span>
                <span className="ref-lb-row__addr" title={row.address}>
                  {row.address ? formatAddrMid(row.address) : "—"}
                </span>
                <span className="ref-lb-row__pts">{row.reward}</span>
              </div>
            ))}
      </div>
      <FigmaHLine variant="line7" />
      <div className="ref-your-label">
        <Trans>Your Rank</Trans>
      </div>
      <FigmaHLine variant="line7" />
      <div className="ref-your-bar">
        <div className="ref-your-bar__accent" aria-hidden>
          <img src={refFigmaAsset.line8} width={2} height={40} className="ref-your-bar__accent-img" alt="" />
        </div>
        <div className="ref-your-bar__inner">
          <span className="ref-your-bar__rank">
            {disconnected || isDashboardLoading || !selfRowInTop ? "—" : selfRowInTop.rank}
          </span>
          <div className="ref-your-bar__mid">
            <span className="ref-your-bar__addr" title={account}>
              {account ? formatAddrMid(account) : "—"}
            </span>
            {!disconnected && !isDashboardLoading && dashboard?.tier?.name ? (
              <span className="ref-your-pill">
                <span className="ref-your-pill__txt">{dashboard.tier.name}</span>
              </span>
            ) : null}
          </div>
          <span className="ref-your-bar__amt">
            {disconnected || isDashboardLoading
              ? "—"
              : selfRowInTop
                ? selfRowInTop.reward
                : formatUsdCompact(dashboard?.total_earnings)}
          </span>
        </div>
      </div>
    </aside>
    );
  };

  if (!account || !active) {
    return (
      <div className="ref-page">
        <div className="ref-shell">
          <div className="ref-shell__body">
            <div className="ref-main">{renderDisconnectedStyleMain(true)}</div>
            {renderRewardSide(true)}
          </div>
        </div>
      </div>
    );
  }

  function renderInviteMain() {
    if (dashboard) {
      return (
        <>
          <div className="ref-stat-grid">
            <article className="ref-stat-card">
              <div className="ref-stat-card__label">
                <Trans>Total Referrals</Trans>
              </div>
              <div className="ref-stat-card__value">{dashboard.total_referrals}</div>
              <div className="ref-stat-card__hint">
                <Trans>Direct invitees</Trans>
              </div>
            </article>
            <article className="ref-stat-card ref-stat-card--accent">
              <div className="ref-stat-card__label">
                <Trans>Total Commission</Trans>
              </div>
              <div className="ref-stat-card__value ref-stat-card__value--accent">
                {formatUsd(parseValue(dashboard.total_earnings, 30), { fallbackToZero: true })}
              </div>
              <div className="ref-stat-card__hint">
                <Trans>Cumulative earnings (lifetime)</Trans>
              </div>
            </article>
            <ClaimCommissionStatCard
              dashboard={dashboard}
              isClaiming={isClaiming}
              onClaim={() => void handleClaim()}
            />
          </div>

          <section className="ref-panel ref-panel--invite">
            <div className="ref-panel__head">
              <ExchangeTabs<InvitePanelTab>
                className="ref-invite-tabs"
                qa="zanbara-referrals-invite"
                options={invitePanelTabOptions}
                value={inviteTab}
                onChange={setInviteTab}
              />
              {/* Share CTA hidden temporarily by product request */}
            </div>
            <FigmaHLine />
            <div className="ref-invite-tab-panels">
            {inviteTab === "invite" ? (
              dashboard.code ? (
                <div className="ref-invite-grid">
                  <div>
                    <div className="ref-field-label">
                      <Trans>Referral Link</Trans>
                    </div>
                    <div className="ref-faux-input">
                      <span className="ref-faux-input__val ref-faux-input__val--link">{referralLink || "—"}</span>
                      <button type="button" className="ref-copy-link" onClick={handleCopyLink} disabled={!referralLink}>
                        <Trans>Copy</Trans>
                      </button>
                    </div>
                  </div>
                  <div>
                    <div className="ref-field-label">
                      <Trans>My Referral Code</Trans>
                    </div>
                    <div className="ref-faux-input">
                      <span className="ref-faux-input__val">{dashboard.code}</span>
                      <button type="button" className="ref-copy-link" onClick={handleCopyCodeOnly}>
                        <Trans>Copy</Trans>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="ref-invite-create">
                  <AffiliateCodeCreateButton
                    embedded
                    onSuccess={() => {
                      void mutateDash();
                      void mutateStatus();
                    }}
                  />
                </div>
              )
            ) : (
              <form className="ref-bind-form" onSubmit={handleBindCodeSubmit}>
                <p className="ref-invite-create__hint">
                  <Trans>Bind someone else's invitation code to obtain the benefits of the invitee</Trans>
                </p>
                <div className="ref-bind-row">
                  <input
                    type="text"
                    className="ref-bind-input"
                    placeholder={t`Enter referral code`}
                    value={bindCodeInputValue}
                    readOnly={bindInputShowsLockedBoundCode}
                    disabled={bindLoading}
                    onChange={(event) => setBindCodeInput(event.target.value.toUpperCase())}
                  />
                  <Button
                    type="submit"
                    appearance="main-40"
                    intent="main"
                    className="ref-bind-submit"
                    loading={bindLoading}
                    disabled={Boolean(
                      (dashboard.bound_referral?.code && !canRebind) ||
                        !(bindInputShowsLockedBoundCode ? boundReferralCodeTrimmed : bindCodeInput).trim()
                    )}
                  >
                    {dashboard.bound_referral?.code && !canRebind ? (
                      <Trans>Already Bound</Trans>
                    ) : (
                      <Trans>Submit</Trans>
                    )}
                  </Button>
                </div>
                {dashboard.bound_referral?.code ? (
                  <p className="ref-bind-info">
                    <Trans>Current bound code: {dashboard.bound_referral.code}</Trans>
                    {canRebind ? (
                      <> · <Trans>You can rebind now.</Trans></>
                    ) : rebindDaysLeft != null ? (
                      <> · <Trans>Rebinding available in {rebindDaysLeft} days.</Trans></>
                    ) : null}
                  </p>
                ) : null}
                {bindError ? <p className="ref-bind-error">{bindError}</p> : null}
              </form>
            )}
            </div>
          </section>

          <RecentTierSection
            totalReferrals={dashboard.total_referrals}
            volumeUsd={volumeUsd}
            apiTier={dashboard.tier ?? undefined}
            onChain={onChainDash}
          />

          <InviteeBenefitsBlock />
        </>
      );
    }

    return <>{renderDisconnectedStyleMain(false, true)}</>;
  }

  return (
    <div className="ref-page">
      <div className="ref-shell">
        <section className="ref-hero">
          <h1 className="ref-hero__title">
            <Trans>Referral Center</Trans>
          </h1>
          <p className="ref-hero__sub">
            <Trans>Invite friends, earn commissions, accumulate forever</Trans>
          </p>
        </section>
        <div className="ref-shell__body">
          <div className="ref-main">{renderInviteMain()}</div>
          {renderRewardSide(false)}
        </div>
      </div>
    </div>
  );
}
