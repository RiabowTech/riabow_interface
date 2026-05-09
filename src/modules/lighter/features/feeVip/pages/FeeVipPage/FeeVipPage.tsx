import { msg, Trans, t } from "@lingui/macro";
import { useLingui } from "@lingui/react";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { LighterShell } from "@/modules/lighter/components/LighterShell/LighterShell";
import { useChainId } from "lib/chains";
import useWallet from "lib/wallets/useWallet";
import AppPageLayout from "shared/components/AppPageLayout/AppPageLayout";
import SEO from "shared/components/Seo/SEO";
import { useDesignSystem } from "shared/context/DesignSystemContext/DesignSystemContext";

import Loader from "components/Loader/Loader";

import { formatFeeBpsLabel } from "../../api/feeVip.mappers";
import type { FeeVipTierId, FeeVipTierRow, FeeVipVolumeCaptionKey } from "../../api/feeVip.types";
import { useFeeVipSummary } from "../../hooks/useFeeVipSummary";

import "./FeeVipPage.css";

/** 无后端 `tierDisplayLabel` 时的占位文案（Zanbara `fee-info` 的 `label` 仅为 `VIP n`，不含金属名） */
const TIER_LEVEL_MSG: Record<FeeVipTierId, ReturnType<typeof msg>> = {
  0: msg`VIP 0 Bronze`,
  1: msg`VIP 1 Silver`,
  2: msg`VIP 2 Gold`,
  3: msg`VIP 3 Platinum`,
  4: msg`VIP 4 Diamond`,
  5: msg`VIP 5 Legend`,
};

const VOLUME_CAPTION_MSG: Record<FeeVipVolumeCaptionKey, ReturnType<typeof msg>> = {
  lt_5m: msg`< $5,000,000`,
  gte_5m: msg`≥ $5,000,000`,
  gte_25m: msg`≥ $25,000,000`,
  gte_100m: msg`≥ $100,000,000`,
  gte_500m: msg`≥ $500,000,000`,
  gte_2b: msg`≥ $2,000,000,000`,
  points_t1: msg`$0 – $4,999,999`,
  points_t2: msg`$5,000,000 – $99,999,999`,
  points_t3: msg`≥ $100,000,000`,
};

const EMPTY_TIER_ROWS: FeeVipTierRow[] = [];

const FALLBACK_TIER_ROWS: FeeVipTierRow[] = [
  { tier: 0, tierDisplayLabel: "VIP 0", volumeCaptionKey: "lt_5m", makerFeeBps: 1, takerFeeBps: 4 },
  { tier: 1, tierDisplayLabel: "VIP 1", volumeCaptionKey: "gte_5m", makerFeeBps: 0.8, takerFeeBps: 3.6 },
  { tier: 2, tierDisplayLabel: "VIP 2", volumeCaptionKey: "gte_25m", makerFeeBps: 0.4, takerFeeBps: 3.2 },
  { tier: 3, tierDisplayLabel: "VIP 3", volumeCaptionKey: "gte_100m", makerFeeBps: 0, takerFeeBps: 2.8 },
  { tier: 4, tierDisplayLabel: "VIP 4", volumeCaptionKey: "gte_500m", makerFeeBps: 0, takerFeeBps: 2.6 },
  { tier: 5, tierDisplayLabel: "VIP 5", volumeCaptionKey: "gte_2b", makerFeeBps: 0, takerFeeBps: 2.4 },
];

const FALLBACK_USER = {
  currentTier: 0 as FeeVipTierId,
  currentTierLabel: "VIP 0",
  nextTier: 1 as FeeVipTierId,
  nextTierLabel: "VIP 1",
  rolling14dVolumeUsd: 378,
  nextTierVolumeFloorUsd: 5_000_000,
  makerFeeBps: 1,
  takerFeeBps: 4,
  effectiveMakerFeeBps: 0.9,
  effectiveTakerFeeBps: 3.6,
  nextTakerDiscountPercent: 10,
  currentTierDescriptionKey: null,
};

/** 积分系统文档 T1–T3（与 `GET /points/tier` 一致） */
const POINTS_TIER_LEVEL_MSG: Partial<Record<FeeVipTierId, ReturnType<typeof msg>>> = {
  1: msg`Tier T1`,
  2: msg`Tier T2`,
  3: msg`Tier T3`,
};

function formatTpPer1k(n: number | undefined): string {
  if (n === undefined || !Number.isFinite(n)) return "—";
  const s = Number.isInteger(n) ? String(n) : n.toFixed(1);
  return `${s} TP / $1k`;
}

function makerCell(row: FeeVipTierRow): string {
  return row.makerTpPer1kUsd != null ? formatTpPer1k(row.makerTpPer1kUsd) : formatFeeBpsLabel(row.makerFeeBps);
}

function takerCell(row: FeeVipTierRow): string {
  return row.takerTpPer1kUsd != null ? formatTpPer1k(row.takerTpPer1kUsd) : formatFeeBpsLabel(row.takerFeeBps);
}

function formatRollingUsd(n: number): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width={14}
      height={14}
      viewBox="0 0 14 14"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M5.25 3.5L9.75 7L5.25 10.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="7" />
      <path d="M10 6.5v4l2.8 1.6" />
    </svg>
  );
}

function CrownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true">
      <path d="M5.7 24.2h20.6l1.4-13.8-6.1 5.3L16 6.3l-5.6 9.4-6.1-5.3 1.4 13.8Z" />
      <path d="M7.8 27h16.4" />
      <path d="M10.5 20.8h11" />
    </svg>
  );
}

function VolumeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 17V11" />
      <path d="M10 17V7" />
      <path d="M15 17V4" />
      <path d="M20 17V9" />
    </svg>
  );
}

function SparkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" aria-hidden="true">
      <path d="M10 2.5 12.1 8l5.4 2-5.4 2L10 17.5 7.9 12l-5.4-2 5.4-2L10 2.5Z" />
    </svg>
  );
}

function FeeVipHeroIcon() {
  return (
    <span className="fee-vip-hero__icon" aria-hidden="true">
      <CrownIcon />
    </span>
  );
}

function FeeVipTierBadge({ tier }: { tier: FeeVipTierId }) {
  return (
    <span className={`fee-vip-tier-badge fee-vip-tier-badge--${tier}`} aria-hidden="true">
      <CrownIcon />
    </span>
  );
}

/**
 * 小组件:基于传入的时间戳做"X 秒/分钟前更新"的相对时间展示,每 10s 自刷新。
 * 超过 60s 没有刷新数据(= 后端可能抖动)时切换为黄色 warn 样式提示用户数据偏旧。
 */
function DataFreshness({ timestampMs, refreshing }: { timestampMs: number; refreshing: boolean }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(t);
  }, []);
  const ageSec = Math.max(0, Math.round((now - timestampMs) / 1000));
  const stale = ageSec > 60;
  const label =
    ageSec < 5 ? (
      <Trans>Updated just now</Trans>
    ) : ageSec < 60 ? (
      <Trans>Updated {ageSec}s ago</Trans>
    ) : ageSec < 3600 ? (
      <Trans>Updated {Math.round(ageSec / 60)}m ago</Trans>
    ) : (
      <Trans>Updated {Math.round(ageSec / 3600)}h ago</Trans>
    );
  return (
    <span
      className={
        stale ? "fee-vip-page__freshness-text fee-vip-page__freshness-text--stale" : "fee-vip-page__freshness-text"
      }
    >
      {refreshing ? <Trans>Refreshing…</Trans> : label}
    </span>
  );
}

/**
 * Fee & VIP 等级与费率说明页；未 Sign 展示公开档位表（个人区为空）；Sign 后拉接口并在表格中高亮当前档，可点击其它行对比浏览。
 */
export function FeeVipPage() {
  const { i18n } = useLingui();
  const { isZanbara } = useDesignSystem();
  const { account } = useWallet();
  const { chainId } = useChainId();
  const { summary, error, isLoading, isValidating, hasAuthToken, lastUpdatedAt } = useFeeVipSummary();
  /** 表格中用户点选的档位；Sign 成功后清空以默认高亮接口返回的当前档 */
  const [pickedTableTier, setPickedTableTier] = useState<FeeVipTierId | null>(null);
  const fallbackUpdatedAtRef = useRef(Date.now());

  const showReconnectSignInHint = Boolean(account) && !hasAuthToken;

  const effectiveSummary = summary;
  const hasServerTiers = Boolean(effectiveSummary?.tiers?.length);
  const isPointsSchedule = (effectiveSummary?.scheduleKind ?? "trading_fee_vip") === "points_trading_tier";

  const user = effectiveSummary?.user ?? (!account || !chainId ? FALLBACK_USER : null);
  const tiers = effectiveSummary?.tiers?.length ? effectiveSummary.tiers : isPointsSchedule ? EMPTY_TIER_ROWS : FALLBACK_TIER_ROWS;
  const hasUser = user !== null;
  const hasTierRows = tiers.length > 0;

  const { tierMakerBps, tierTakerBps, hasMakerDiscount, hasTakerDiscount, hasTradingFeeDiscount } = useMemo(() => {
    const tm = user?.makerFeeBps ?? tiers[0]?.makerFeeBps ?? 0;
    const tt = user?.takerFeeBps ?? tiers[0]?.takerFeeBps ?? 0;
    const u = user;
    const em = u?.effectiveMakerFeeBps;
    const et = u?.effectiveTakerFeeBps;
    const dm = em !== undefined && em !== tm;
    const dt = et !== undefined && et !== tt;
    return {
      tierMakerBps: tm,
      tierTakerBps: tt,
      hasMakerDiscount: Boolean(!isPointsSchedule && u && dm),
      hasTakerDiscount: Boolean(!isPointsSchedule && u && dt),
      hasTradingFeeDiscount: Boolean(!isPointsSchedule && u && (dm || dt)),
    };
  }, [user, tiers, isPointsSchedule]);

  const prevHasUserRef = useRef(false);
  useEffect(() => {
    if (hasUser && !prevHasUserRef.current) {
      setPickedTableTier(null);
    }
    prevHasUserRef.current = hasUser;
  }, [hasUser]);

  /** 表格高亮：已 Sign 默认接口当前档，可点击其它行对比；未 Sign 仅点击后高亮公开表某一行 */
  const tableHighlightTier = pickedTableTier ?? (hasUser ? user.currentTier : null);
  const nextTier = user?.nextTier ?? null;
  const rolling14dUsd = hasUser ? user.rolling14dVolumeUsd : 0;
  const nextFloor = user?.nextTierVolumeFloorUsd ?? null;

  const progressPct = useMemo(() => {
    if (!hasUser) return 0;
    if (!nextFloor || nextFloor <= 0) return 100;
    return Math.min(100, (rolling14dUsd / nextFloor) * 100);
  }, [hasUser, rolling14dUsd, nextFloor]);

  const progressStyle = useMemo(
    () => ({ "--fee-vip-progress-pct": `${progressPct}%` }) as CSSProperties,
    [progressPct]
  );
  const displayUpdatedAt = lastUpdatedAt ?? fallbackUpdatedAtRef.current;

  const body = (() => {
    if (!chainId && account) {
      return (
        <div className="fee-vip-page fee-vip-page--state">
          <Loader />
        </div>
      );
    }

    if (isLoading && !summary && account && chainId) {
      return (
        <div className="fee-vip-page fee-vip-page--state">
          <Loader />
        </div>
      );
    }

    if (!isLoading && error && !summary && account && chainId) {
      return (
        <div className="fee-vip-page fee-vip-page--state">
          <p className="fee-vip-page__error" role="alert">
            <Trans>Could not load fee and VIP data.</Trans>
            {error.message ? <span className="fee-vip-page__error-detail"> ({error.message})</span> : null}
          </p>
        </div>
      );
    }

    return (
      <div className="fee-vip-page">
        <div className="fee-vip-hero">
          <FeeVipHeroIcon />
          <div>
            <h1 className="fee-vip-page__title">
              <Trans>Fee &amp; VIP</Trans>
            </h1>
            <p className="fee-vip-page__subtitle">
              <Trans>Enjoy lower trading fees and exclusive benefits as your VIP level increases.</Trans>
            </p>
          </div>
        </div>

        {(hasServerTiers || !account || !chainId) && displayUpdatedAt ? (
          <p className="fee-vip-page__freshness" role="status" aria-live="polite">
            <ClockIcon className="fee-vip-page__freshness-icon" />
            <DataFreshness timestampMs={displayUpdatedAt} refreshing={isValidating} />
          </p>
        ) : null}

        <div className="fee-vip-page__cards">
          <section className="fee-vip-card fee-vip-card--vip" aria-labelledby="fee-vip-current-heading">
            <h2 id="fee-vip-current-heading" className="fee-vip-card__label">
              {isPointsSchedule ? <Trans>Current Trading Tier</Trans> : <Trans>Your VIP Status</Trans>}
            </h2>
            <div className="fee-vip-card__row">
              {hasUser ? (
                <>
                  <div className="fee-vip-status">
                    <FeeVipTierBadge tier={user.currentTier} />
                    <span className="fee-vip-status__level">
                      {isPointsSchedule && user.pointsTierLabel
                        ? user.pointsTierLabel
                        : user.currentTierLabel ?? t`VIP ${user.currentTier}`}
                    </span>
                  </div>
                  {user.currentTierDescriptionKey === "default_new_user" ? (
                    <p className="fee-vip-tag__muted">
                      <Trans>Default level for new users</Trans>
                    </p>
                  ) : null}
                </>
              ) : (
                <div className="fee-vip-card__connect-wrap">
                  <p className="fee-vip-tag__muted">
                    {isPointsSchedule ? (
                      showReconnectSignInHint ? (
                        <Trans>
                          Wallet connected, but your session is missing or expired. Please sign in again to see your
                          trading tier.
                        </Trans>
                      ) : (
                        <Trans>Connect wallet and sign in to see your trading tier.</Trans>
                      )
                    ) : showReconnectSignInHint ? (
                      <Trans>
                        Wallet connected, but your session is missing or expired. Please sign in again to see your VIP
                        level.
                      </Trans>
                    ) : (
                      <Trans>Connect wallet to see your VIP level.</Trans>
                    )}
                  </p>
                </div>
              )}
            </div>
            {hasUser ? (
              <>
                <div className="fee-vip-card__divider" />
                <p className="fee-vip-card__label fee-vip-card__label--small">
                  {isPointsSchedule ? <Trans>Next Tier</Trans> : <Trans>Next Level</Trans>}
                </p>
                <div className="fee-vip-next">
                  <span className="fee-vip-tag">
                    {nextTier !== null
                      ? isPointsSchedule
                        ? `T${nextTier}`
                        : user.nextTierLabel ?? t`VIP ${nextTier}`
                      : t`Max`}
                  </span>
                  <span className="fee-vip-next__progress">
                    {formatRollingUsd(rolling14dUsd)} / {nextFloor != null ? formatRollingUsd(nextFloor) : "—"}
                  </span>
                  <span className="fee-vip-next__caption">
                    <Trans>14D Volume</Trans>
                  </span>
                  <ArrowRightIcon className="fee-vip-next__arrow" />
                </div>
                <div className="fee-vip-progress fee-vip-progress--compact" style={progressStyle} aria-hidden="true">
                  <div className="fee-vip-progress__fill" />
                </div>
                <p className="fee-vip-footnote">
                  <Trans>
                    Trade another {nextFloor != null ? formatRollingUsd(Math.max(0, nextFloor - rolling14dUsd)) : "—"} to unlock VIP {nextTier ?? user.currentTier}
                  </Trans>
                </p>
              </>
            ) : null}
          </section>

          <section className="fee-vip-card" aria-labelledby="fee-vip-fees-heading">
            <h2 id="fee-vip-fees-heading" className="fee-vip-card__label fee-vip-card__label--with-pill">
              <span className="fee-vip-card__label-text">
                {isPointsSchedule ? <Trans>Your TP rate (per $1k)</Trans> : <Trans>Your Trading Fee</Trans>}
              </span>
              {!isPointsSchedule && hasTradingFeeDiscount ? (
                <span
                  className="fee-vip-discount-pill"
                  title={i18n._(msg`Your current fees include rebates or staking discounts.`)}
                >
                  <Trans>Discount applied</Trans>
                </span>
              ) : null}
            </h2>
            <div className="fee-vip-fees">
              {isPointsSchedule ? (
                <>
                  <div>
                    <p className="fee-vip-fee-block__value">
                      {hasUser ? formatTpPer1k(user.makerTpPer1kUsd ?? tiers[0]?.makerTpPer1kUsd) : "—"}
                    </p>
                    <p className="fee-vip-fee-block__role">
                      <Trans>Maker</Trans>
                    </p>
                  </div>
                  <div>
                    <p className="fee-vip-fee-block__value">
                      {hasUser ? formatTpPer1k(user.takerTpPer1kUsd ?? tiers[0]?.takerTpPer1kUsd) : "—"}
                    </p>
                    <p className="fee-vip-fee-block__role">
                      <Trans>Taker</Trans>
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className={hasMakerDiscount ? "fee-vip-fee-block fee-vip-fee-block--discounted" : undefined}>
                    {hasMakerDiscount && user ? (
                      <>
                        <p className="fee-vip-fee-block__value">{formatFeeBpsLabel(user.effectiveMakerFeeBps!)}</p>
                        <p className="fee-vip-fee-block__strike-row">
                          <del className="fee-vip-fee-block__strike">{formatFeeBpsLabel(tierMakerBps)}</del>
                        </p>
                        <p className="fee-vip-fee-block__role">
                          <Trans>Maker</Trans>
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="fee-vip-fee-block__value">
                          {hasUser ? formatFeeBpsLabel(tierMakerBps) : "—"}
                        </p>
                        <p className="fee-vip-fee-block__role">
                          <Trans>Maker</Trans>
                        </p>
                      </>
                    )}
                  </div>
                  <div className={hasTakerDiscount ? "fee-vip-fee-block fee-vip-fee-block--discounted" : undefined}>
                    {hasTakerDiscount && user ? (
                      <>
                        <p className="fee-vip-fee-block__value">{formatFeeBpsLabel(user.effectiveTakerFeeBps!)}</p>
                        <p className="fee-vip-fee-block__strike-row">
                          <del className="fee-vip-fee-block__strike">{formatFeeBpsLabel(tierTakerBps)}</del>
                        </p>
                        <p className="fee-vip-fee-block__role">
                          <Trans>Taker</Trans>
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="fee-vip-fee-block__value">
                          {hasUser ? formatFeeBpsLabel(tierTakerBps) : "—"}
                        </p>
                        <p className="fee-vip-fee-block__role">
                          <Trans>Taker</Trans>
                        </p>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
            {user && user.nextTakerDiscountPercent != null && nextTier !== null ? (
              <p className="fee-vip-hint">
                <SparkIcon className="fee-vip-hint__icon" />
                {isPointsSchedule ? (
                  <Trans>
                    Upgrade to T{nextTier} to save {user.nextTakerDiscountPercent}% on taker TP rate (per $1k)
                  </Trans>
                ) : (
                  <Trans>
                    Upgrade to VIP {nextTier} to save {user.nextTakerDiscountPercent}% on Taker fee
                  </Trans>
                )}
              </p>
            ) : null}
          </section>

          <section className="fee-vip-card" aria-labelledby="fee-vip-volume-heading">
            <h2 id="fee-vip-volume-heading" className="fee-vip-card__label fee-vip-card__label--icon">
              <VolumeIcon className="fee-vip-card__label-icon" />
              <span><Trans>14D Volume</Trans></span>
            </h2>
            <p className="fee-vip-volume__value">{hasUser ? formatRollingUsd(rolling14dUsd) : "—"}</p>
            <div
              className="fee-vip-progress"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progressPct)}
              aria-label={
                isPointsSchedule
                  ? t`14-day volume progress toward next trading tier`
                  : t`14-day volume progress toward next VIP level`
              }
              style={progressStyle}
            >
              <div className="fee-vip-progress__fill" />
            </div>
            {!hasUser ? (
              <p className="fee-vip-footnote">
                {showReconnectSignInHint ? (
                  <Trans>Sign in to view your 14-day volume.</Trans>
                ) : (
                  <Trans>Connect wallet to view your 14-day volume.</Trans>
                )}
              </p>
            ) : nextFloor != null && nextTier !== null ? (
              <p className="fee-vip-footnote">
                {isPointsSchedule ? (
                  <Trans>
                    T{nextTier} requires {formatRollingUsd(nextFloor)} (14-day rolling)
                  </Trans>
                ) : (
                  <Trans>
                    VIP {nextTier} requires {formatRollingUsd(nextFloor)} (14-day rolling)
                  </Trans>
                )}
              </p>
            ) : (
              <p className="fee-vip-footnote">
                {isPointsSchedule ? (
                  <Trans>Highest trading tier reached for volume requirement.</Trans>
                ) : (
                  <Trans>Highest VIP level reached for volume requirement.</Trans>
                )}
              </p>
            )}
          </section>
        </div>

        <div className="fee-vip-table-wrap">
          <table className="fee-vip-table">
            <thead>
              <tr>
                <th scope="col">{isPointsSchedule ? <Trans>Trading tier</Trans> : <Trans>VIP Level</Trans>}</th>
                <th scope="col">
                  <Trans>14D Volume</Trans>
                </th>
                <th scope="col">{isPointsSchedule ? <Trans>Maker TP ($1k)</Trans> : <Trans>Maker Fee</Trans>}</th>
                <th scope="col">{isPointsSchedule ? <Trans>Taker TP ($1k)</Trans> : <Trans>Taker Fee</Trans>}</th>
              </tr>
            </thead>
            <tbody>
              {hasTierRows ? (
                tiers.map((row) => {
                  const isHighlighted =
                    tableHighlightTier !== null && row.tier === tableHighlightTier;
                  const fallbackMsg = isPointsSchedule ? POINTS_TIER_LEVEL_MSG[row.tier] : TIER_LEVEL_MSG[row.tier];
                  const levelText = isPointsSchedule
                    ? fallbackMsg
                      ? i18n._(fallbackMsg)
                      : "—"
                    : row.tierDisplayLabel ?? (fallbackMsg ? i18n._(fallbackMsg) : "—");
                  return (
                    <tr
                      key={row.tier}
                      className={
                        isHighlighted
                          ? "fee-vip-table__row--current fee-vip-table__row--interactive"
                          : "fee-vip-table__row--interactive"
                      }
                      onClick={() => setPickedTableTier(row.tier)}
                    >
                      <td>
                        <div className="fee-vip-table__level-cell">
                          <FeeVipTierBadge tier={row.tier} />
                          <p className="fee-vip-table__level">{levelText}</p>
                        </div>
                      </td>
                      <td>{i18n._(VOLUME_CAPTION_MSG[row.volumeCaptionKey])}</td>
                      <td>{makerCell(row)}</td>
                      <td>{takerCell(row)}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={4} className="fee-vip-table__empty">
                    <Trans>Sign in to load the VIP fee schedule from the server.</Trans>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  })();

  if (isZanbara) {
    return (
      <LighterShell>
        <div className="mx-auto flex w-full max-w-[1512px] grow flex-col gap-1 pb-8 pt-0 max-md:px-1">
          <SEO title={t`Fee & VIP | Zanbara`} description={t`Trading fee tiers and VIP levels on Zanbara.`} />
          {body}
        </div>
      </LighterShell>
    );
  }

  return (
    <AppPageLayout>
      <SEO title={t`Fee & VIP | Zanbara`} description={t`Trading fee tiers and VIP levels on Zanbara.`} />
      {body}
    </AppPageLayout>
  );
}
