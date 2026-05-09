import { Trans, t } from "@lingui/macro";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useCallback, useEffect, useMemo, useState } from "react";

import { LighterShell } from "@/modules/lighter/components/LighterShell/LighterShell";
import AppPageLayout from "shared/components/AppPageLayout/AppPageLayout";
import { useDesignSystem } from "shared/context/DesignSystemContext/DesignSystemContext";
import { PrimaryActionButton, ZanbaraCornerBracketFrame } from "shared/ui";
import { LeaderboardRow } from "shared/ui/LeaderboardRow";
import { LinearProgressBar } from "shared/ui/LinearProgressBar";

import Button from "components/Button/Button";

// Figma Zanbara-Website v1.0 · node 156:2399 MainBtn 图标（Figma MCP get_design_context 拉取）
import pdMainBtnInviteIcon from "../../assets/figma-mainbtn/invite.svg";
import pdMainBtnTradeIcon from "../../assets/figma-mainbtn/trade.svg";
import { PointsToolbar } from "../../components/PointsToolbar";
import { formatCompactPoints, useDailyPointsLeaderboard, useEpochs, usePointsData } from "../../hooks/usePointsData";
import { POINTS_DAILY_CAPS } from "../../pointsDashboard.constants";
import "./PointsPage.css";

function formatAddressMiddle(address: string): string {
  if (!address) return address;
  if (address.includes("...")) return address;
  if (address.length <= 14) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

type BarVariant = "cyan" | "yellow" | "green";

function PointsCapBar({ value, cap, variant }: { value: number; cap: number; variant: BarVariant }) {
  return (
    <LinearProgressBar
      value={value}
      max={cap}
      className={`pd-capbar pd-capbar--${variant}`}
      trackClassName="pd-capbar__track"
      fillClassName="pd-capbar__fill"
    />
  );
}

export function PointsPage() {
  const { openConnectModal } = useConnectModal();
  const { isZanbara } = useDesignSystem();
  const { epochs, currentEpochId } = useEpochs();
  const [selectedEpochId, setSelectedEpochId] = useState<number | null>(null);
  const [selectedSeasonId, setSelectedSeasonId] = useState<number | null>(null);

  const seasons = useMemo(() => {
    const m = new Map<number, string>();
    for (const e of epochs) {
      if (!m.has(e.seasonId)) m.set(e.seasonId, e.seasonLabel);
    }
    return Array.from(m.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.id - b.id);
  }, [epochs]);

  const epochsInSeason = useMemo(
    () => epochs.filter((e) => e.seasonId === selectedSeasonId),
    [epochs, selectedSeasonId]
  );

  useEffect(() => {
    if (!epochs.length) return;
    if (selectedEpochId === null) {
      setSelectedEpochId(currentEpochId ?? epochs[0].id);
    }
  }, [epochs, currentEpochId, selectedEpochId]);

  useEffect(() => {
    if (!epochs.length) return;
    if (selectedSeasonId !== null) return;
    const seed = epochs.find((e) => e.id === (selectedEpochId ?? currentEpochId)) ?? epochs[0];
    setSelectedSeasonId(seed.seasonId);
  }, [epochs, currentEpochId, selectedEpochId, selectedSeasonId]);

  useEffect(() => {
    if (!epochs.length || selectedSeasonId === null) return;
    const inSeason = epochs.filter((e) => e.seasonId === selectedSeasonId);
    if (!inSeason.length) return;
    if (selectedEpochId === null || !inSeason.some((e) => e.id === selectedEpochId)) {
      const pick = inSeason.find((e) => e.id === currentEpochId) ?? inSeason[0];
      setSelectedEpochId(pick.id);
    }
  }, [epochs, selectedSeasonId, selectedEpochId, currentEpochId]);

  const handleSeasonChange = useCallback(
    (seasonId: number) => {
      setSelectedSeasonId(seasonId);
      const list = epochs.filter((e) => e.seasonId === seasonId);
      const pick = list.find((e) => e.id === currentEpochId) ?? list[0];
      if (pick) setSelectedEpochId(pick.id);
    },
    [epochs, currentEpochId]
  );

  const pointsData = usePointsData(selectedEpochId, epochs);
  const dailyGainers = useDailyPointsLeaderboard(selectedEpochId, 80);

  const epochLabelForHero = selectedEpochId != null ? t`Epoch ${selectedEpochId} Total Points` : t`Epoch Total Points`;

  const updatedFooter =
    pointsData.leaderboardUpdatedAt != null
      ? t`Updated hourly · Update: ${new Date(pointsData.leaderboardUpdatedAt).toLocaleString("en-US", {
          timeZone: "UTC",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        })} (UTC)`
      : t`Updated hourly`;

  const dailyGainersFooter =
    dailyGainers.refreshedAt != null
      ? t`Refreshes every 5 min · Last: ${new Date(dailyGainers.refreshedAt).toLocaleString("en-US", {
          timeZone: "UTC",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        })} (UTC)`
      : t`Refreshes every 5 min`;

  const rankTone = (rank: number) => {
    if (rank === 1) return "pd-lb-row__rank--gold";
    if (rank === 2) return "pd-lb-row__rank--silver";
    if (rank === 3) return "pd-lb-row__rank--bronze";
    return "pd-lb-row__rank--muted";
  };

  const n = pointsData.numeric;

  const pointsBody = (
    <>
      <div className="pd-page">
        <div className="pd-shell">
          <PointsToolbar
            seasons={seasons}
            selectedSeasonId={selectedSeasonId}
            onSeasonChange={handleSeasonChange}
            epochsInSeason={epochsInSeason}
            selectedEpochId={selectedEpochId}
            onEpochChange={setSelectedEpochId}
          />

          <div className="pd-shell__body">
            <div className="pd-main">
              <section className="pd-hero">
                <div className="pd-hero__left">
                  <div className="pd-hero__value">{pointsData.currentEpochPoints}</div>
                  <div className="pd-hero__label">{epochLabelForHero}</div>
                </div>
                <div className="pd-hero__right">
                  <span className="pd-hero__dl-label">
                    <Trans>Days Left</Trans>
                  </span>
                  <span className="pd-hero__dl-value">
                    {pointsData.daysLeft != null ? t`${pointsData.daysLeft} Days` : <span className="pd-muted">—</span>}
                  </span>
                </div>
              </section>

              <div className="pd-grid2">
                <article className="pd-card pd-card--cyan">
                  <div className="pd-card__head">
                    <span className="pd-card__title">
                      <Trans>Trading Points</Trans>
                    </span>
                    <span className="pd-tag pd-tag--cyan">TP</span>
                  </div>
                  <div className="pd-card__value">{pointsData.points.trading}</div>
                  <div className="pd-card__body">
                    <p className="pd-card__desc">
                      <Trans>Cumulative trading volume points</Trans>
                    </p>
                    <PointsCapBar value={n.trading} cap={POINTS_DAILY_CAPS.trading} variant="cyan" />
                    <div className="pd-card__foot">
                      <span className="pd-muted">{pointsData.tierLine ?? t`Tier multiplier`}</span>
                      <span className="pd-cap-label pd-cap-label--cyan">
                        <Trans>Daily cap {POINTS_DAILY_CAPS.trading.toLocaleString("en-US")}</Trans>
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="primary-action"
                    to="/trade"
                    className="pd-card__btn"
                    imgSrc={pdMainBtnTradeIcon}
                    imgClassName="pd-card__btn-icon"
                  >
                    <Trans>Trade now</Trans>
                  </Button>
                </article>

                <article className="pd-card pd-card--yellow">
                  <div className="pd-card__head">
                    <span className="pd-card__title">
                      <Trans>PnL Points</Trans>
                    </span>
                    <span className="pd-tag pd-tag--yellow">PP</span>
                  </div>
                  <div className="pd-card__value">{pointsData.points.pnl}</div>
                  <div className="pd-card__body">
                    <p className="pd-card__desc">
                      <Trans>Closed PnL settlement points</Trans>
                    </p>
                    <PointsCapBar value={n.pnl} cap={POINTS_DAILY_CAPS.pnl} variant="yellow" />
                    <div className="pd-card__foot">
                      <span className="pd-muted">
                        <Trans>Higher of two formulas</Trans>
                      </span>
                      <span className="pd-cap-label pd-cap-label--yellow">
                        <Trans>Daily cap {POINTS_DAILY_CAPS.pnl.toLocaleString("en-US")}</Trans>
                      </span>
                    </div>
                  </div>
                </article>

                <article className="pd-card pd-card--cyan">
                  <div className="pd-card__head">
                    <span className="pd-card__title">
                      <Trans>Holding Points</Trans>
                    </span>
                    <span className="pd-tag pd-tag--cyan">HP</span>
                  </div>
                  <div className="pd-card__value">{pointsData.points.holding}</div>
                  <div className="pd-card__body">
                    <p className="pd-card__desc">
                      <Trans>Hold time x notional value</Trans>
                    </p>
                    <PointsCapBar value={n.holding} cap={POINTS_DAILY_CAPS.holding} variant="cyan" />
                    <div className="pd-card__foot">
                      <span className="pd-muted">
                        <Trans>Settled hourly in batches</Trans>
                      </span>
                      <span className="pd-cap-label pd-cap-label--cyan">
                        <Trans>Daily cap {POINTS_DAILY_CAPS.holding.toLocaleString("en-US")}</Trans>
                      </span>
                    </div>
                  </div>
                </article>

                <article className="pd-card pd-card--green">
                  <div className="pd-card__head">
                    <span className="pd-card__title">
                      <Trans>Referral Points</Trans>
                    </span>
                    <span className="pd-tag pd-tag--green">RP</span>
                  </div>
                  <div className="pd-card__value">{pointsData.points.referral}</div>
                  <div className="pd-card__body">
                    <p className="pd-card__desc">
                      <Trans>Points triggered by referral trades</Trans>
                    </p>
                    <PointsCapBar value={n.referral} cap={POINTS_DAILY_CAPS.referral} variant="green" />
                    <div className="pd-card__foot">
                      <span className="pd-muted">
                        <Trans>One-time trigger on first trade</Trans>
                      </span>
                      <span className="pd-cap-label pd-cap-label--green">
                        <Trans>Daily cap {POINTS_DAILY_CAPS.referral.toLocaleString("en-US")}</Trans>
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="primary-action"
                    to="/referrals"
                    className="pd-card__btn"
                    mainAccent="green"
                    imgSrc={pdMainBtnInviteIcon}
                    imgClassName="pd-card__btn-icon"
                  >
                    <Trans>Invite friend</Trans>
                  </Button>
                </article>
              </div>
            </div>

            <aside className="pd-side">
              <div className="pd-side__title">
                {selectedEpochId != null ? (
                  <Trans>Epoch {selectedEpochId} Leaderboard</Trans>
                ) : (
                  <Trans>Leaderboard</Trans>
                )}
              </div>

              <div className="pd-your-rank">
                <div className="pd-muted">
                  <Trans>Your Rank</Trans>
                </div>
                {pointsData.isWalletConnected ? (
                  <div className="pd-your-rank__row">
                    <span className="pd-your-rank__hash">
                      {pointsData.epochRanking != null ? `#${pointsData.epochRanking}` : "—"}
                    </span>
                    <span className="pd-your-rank__pts">{pointsData.currentEpochPoints}</span>
                  </div>
                ) : (
                  <ZanbaraCornerBracketFrame className="w-fit max-w-full" enabled={isZanbara}>
                    <PrimaryActionButton
                      type="button"
                      className="connect-wallet-cta min-w-[240px]"
                      onClick={openConnectModal}
                    >
                      <Trans>Connect Wallet</Trans>
                    </PrimaryActionButton>
                  </ZanbaraCornerBracketFrame>
                )}
              </div>

              <div className="pd-lb-list pd-lb-list--epoch-scroll">
                {pointsData.leaderboard.map((row) => (
                  <LeaderboardRow
                    key={`${row.rank}-${row.address}`}
                    rank={row.rank}
                    rankClassName={rankTone(row.rank)}
                    address={formatAddressMiddle(row.address)}
                    addressTitle={row.address}
                    points={formatCompactPoints(row.points)}
                    isCurrent={row.isCurrent}
                  />
                ))}
              </div>

              <p className="pd-side__meta">{updatedFooter}</p>

              <div className="pd-divider" />

              <div className="pd-side__subtitle">
                <Trans>Epoch Progress</Trans>
              </div>
              <div className="pd-ep-line">
                <span className="pd-muted">{pointsData.seasonEpochLine}</span>
                <span className="pd-ep-pct">{pointsData.epochProgressPct}%</span>
              </div>
              <PointsCapBar value={pointsData.epochProgressPct} cap={100} variant="cyan" />
              <p className="pd-side__range">{pointsData.epochDateRangeLabel}</p>

              <div className="pd-divider" />

              <div className="pd-side__subtitle">
                <Trans>Today’s Top Gainers</Trans>
              </div>
              {dailyGainers.error ? (
                <p className="pd-muted pd-gainers-empty">
                  <Trans>Could not load today’s gainers.</Trans>
                </p>
              ) : dailyGainers.isLoading ? (
                <p className="pd-muted pd-gainers-empty">
                  <Trans>Loading…</Trans>
                </p>
              ) : dailyGainers.rows.length === 0 ? (
                <p className="pd-muted pd-gainers-empty">
                  <Trans>No ranked gains for this UTC day yet, or the cache is still warming up.</Trans>
                </p>
              ) : (
                <div className="pd-lb-list pd-lb-list--gainers pd-lb-list--daily-scroll">
                  {dailyGainers.rows.map((row) => (
                    <LeaderboardRow
                      key={`${row.rank}-${row.address}`}
                      rank={row.rank}
                      rankClassName={rankTone(row.rank)}
                      address={formatAddressMiddle(row.address)}
                      addressTitle={row.address}
                      points={formatCompactPoints(row.pointsToday)}
                      isCurrent={row.isCurrent}
                    />
                  ))}
                </div>
              )}
              <p className="pd-side__meta pd-side__meta--gainers">{dailyGainersFooter}</p>
            </aside>
          </div>
        </div>
      </div>
    </>
  );

  if (isZanbara) {
    return (
      <LighterShell>
        <div className="mx-auto flex w-full max-w-[1512px] grow flex-col gap-1 pb-8 pt-0 max-md:px-1">{pointsBody}</div>
      </LighterShell>
    );
  }

  return <AppPageLayout>{pointsBody}</AppPageLayout>;
}
