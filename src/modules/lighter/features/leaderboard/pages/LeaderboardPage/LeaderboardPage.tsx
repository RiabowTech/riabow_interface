import { Trans, t } from "@lingui/macro";
import { useEffect, useMemo } from "react";
import { useHistory } from "react-router-dom";

import { useLeaderboardPageKey } from "@/modules/lighter/store/SyntheticsStateContext/hooks/leaderboardHooks";
import { LeaderboardPageConfig } from "domain/synthetics/leaderboard";
import { LEADERBOARD_PAGES } from "domain/synthetics/leaderboard/constants";
import { useChainId } from "lib/chains";

import AppPageLayout from "shared/components/AppPageLayout/AppPageLayout";
import { LighterShell } from "@/modules/lighter/components/LighterShell/LighterShell";
import { useDesignSystem } from "shared/context/DesignSystemContext/DesignSystemContext";
import { Breadcrumbs, BreadcrumbItem } from "components/Breadcrumbs/Breadcrumbs";
import { ChainContentHeader } from "components/ChainContentHeader/ChainContentHeader";

import { LeaderboardContainer } from "./components/LeaderboardContainer";
import "./LeaderboardPage.scss";

const LeaderboardBreadcrumbs = () => {
  const pageKey = useLeaderboardPageKey();
  const currentPage = LEADERBOARD_PAGES[pageKey ?? "leaderboard"] ?? LEADERBOARD_PAGES.leaderboard;
  const isCompetition = currentPage.isCompetition;
  const isConcluded = currentPage.timeframe.to && currentPage.timeframe.to < Date.now() / 1000;

  if (!isCompetition && !isConcluded) {
    return null;
  }

  return (
    <Breadcrumbs>
      <BreadcrumbItem to="/leaderboard" back>
        <Trans>Leaderboard</Trans>
      </BreadcrumbItem>
      <BreadcrumbItem active>
        <Trans>Concluded Competitions</Trans>
      </BreadcrumbItem>
    </Breadcrumbs>
  );
};

export function LeaderboardPage() {
  const leaderboardPageKey = useLeaderboardPageKey();
  const { isZanbara } = useDesignSystem();

  const tooltipContent = useMemo(() => {
    const description = leaderboardPageKey === "leaderboard" ? t`Leaderboard for traders on riabow.` : null;

    return (
      <div>
        {description && <div className="text-body-medium font-medium text-typography-secondary">{description}</div>}
      </div>
    );
  }, [leaderboardPageKey]);

  if (isZanbara) {
    return (
      <LighterShell>
        <div className="mx-auto flex w-full max-w-[1512px] grow flex-col gap-1 pb-8 pt-0 max-md:px-1">
          <div className="page-layout">
            <header className="zanbara-page-hero zanbara-page-hero--inset">
              <h1 className="zanbara-page-hero__title">
                <Trans>Leaderboard</Trans>
              </h1>
              <p className="zanbara-page-hero__subtitle">
                {leaderboardPageKey === "leaderboard" ? (
                  <Trans>Leaderboard for traders on riabow.</Trans>
                ) : (
                  <span aria-hidden className="select-none opacity-0">
                    &nbsp;
                  </span>
                )}
              </p>
            </header>
            <LeaderboardContainer />
          </div>
        </div>
      </LighterShell>
    );
  }

  return (
    <AppPageLayout
      header={
        <ChainContentHeader
          title={t`Leaderboard`}
          breadcrumbs={<LeaderboardBreadcrumbs />}
          tooltipContent={tooltipContent}
        />
      }
    >
      <div className="page-layout">
        <LeaderboardContainer />
      </div>
    </AppPageLayout>
  );
}

export function CompetitionRedirect() {
  const { chainId } = useChainId();
  const history = useHistory();

  useEffect(() => {
    const closest = getClosestCompetition(chainId);
    history.replace(closest.href);
  }, [chainId, history]);

  return null;
}

function getClosestCompetition(chainId: number) {
  const competitions = Object.values(LEADERBOARD_PAGES).filter((page) => page.isCompetition && page.enabled);
  const competitionsOnSameNetwork = competitions.filter((page) => page.isCompetition && page.chainId === chainId);
  const competitionsNotOver = competitions.filter((page) => page.timeframe.to && page.timeframe.to > Date.now() / 1000);
  const competitionsNotOverOnsameNetwork = competitionsNotOver.filter(
    (page) => page.isCompetition && page.chainId === chainId
  );

  if (competitionsNotOverOnsameNetwork.length > 0) {
    return getClosestCompetitionByTimeframe(competitionsNotOverOnsameNetwork);
  }

  if (competitionsNotOver.length > 0) {
    return getClosestCompetitionByTimeframe(competitionsNotOver);
  }

  if (competitionsOnSameNetwork.length > 0) {
    return getClosestCompetitionByTimeframe(competitionsOnSameNetwork);
  }

  if (competitions.length > 0) {
    return getClosestCompetitionByTimeframe(competitions);
  }

  return LEADERBOARD_PAGES.leaderboard;
}

function getClosestCompetitionByTimeframe(competitions: LeaderboardPageConfig[]) {
  competitions.sort((a, b) => {
    const timeframeA = LEADERBOARD_PAGES[a.key].timeframe;
    const timeframeB = LEADERBOARD_PAGES[b.key].timeframe;
    return timeframeA.from - timeframeB.from;
  });
  return competitions[0];
}
