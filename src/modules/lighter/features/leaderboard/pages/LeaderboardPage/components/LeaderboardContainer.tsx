import { t } from "@lingui/macro";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  useLeaderboardDataTypeState,
  useLeaderboardIsCompetition,
  useLeaderboardPageKey,
  useLeaderboardPositions,
  useLeaderboardRankedAccounts,
  useLeaderboardTimeframeTypeState,
  useLeaderboardTiming,
} from "@/modules/lighter/store/SyntheticsStateContext/hooks/leaderboardHooks";
import {
  selectLeaderboardIsLoading,
  selectLeaderboardSearchAddress,
  selectLeaderboardSetSearchAddress,
} from "@/modules/lighter/store/SyntheticsStateContext/selectors/leaderboardSelectors";
import { useSelector } from "@/modules/lighter/store/SyntheticsStateContext/utils";
import { CompetitionType } from "domain/synthetics/leaderboard";
import { useBreakpoints } from "lib/useBreakpoints";
import { Tabs } from "shared/ui";

import SearchInput from "components/SearchInput/SearchInput";
import { BodyScrollFadeContainer } from "components/TableScrollFade/TableScrollFade";

import { CompetitionPrizes } from "./CompetitionPrizes";
import { LeaderboardAccountsTable } from "./LeaderboardAccountsTable";
import { LeaderboardNavigation } from "./LeaderboardNavigation";
import { LeaderboardPositionsTable } from "./LeaderboardPositionsTable";

const competitionsTabs = [0, 1];
const leaderboardTimeframeTabs = [2, 1, 0];
const leaderboardDataTypeTabs = [0, 1];

export function LeaderboardContainer() {
  const isCompetition = useLeaderboardIsCompetition();

  const [activeLeaderboardTimeframeIndex, setActiveLeaderboardTimeframeIndex] = useState(0);
  const [activeLeaderboardDataTypeIndex, setActiveLeaderboardDataTypeIndex] = useState(0);
  const [activeCompetitionIndex, setActiveCompetitionIndex] = useState(0);

  const leaderboardPageKey = useLeaderboardPageKey();

  const [, setLeaderboardTimeframeType] = useLeaderboardTimeframeTypeState();
  const [, setLeaderboardDataType] = useLeaderboardDataTypeState();

  const competitionLabels = useMemo(() => [t`Top PnL ($)`, t`Top PnL (%)`], []);
  const leaderboardTimeframeLabels = useMemo(() => [t`Total`, t`Last 30d`, t`Last 7d`], []);
  const leaderboardDataTypeLabels = useMemo(() => [t`Top Addresses`, t`Top Positions`], []);

  const activeCompetition: CompetitionType | undefined = isCompetition
    ? activeCompetitionIndex === 0
      ? "notionalPnl"
      : "pnlPercentage"
    : undefined;

  const handleLeaderboardTimeframeTabChange = useCallback(
    (index: number) => setActiveLeaderboardTimeframeIndex(index),
    [setActiveLeaderboardTimeframeIndex]
  );
  const handleCompetitionTabChange = useCallback(
    (index: number) => setActiveCompetitionIndex(index),
    [setActiveCompetitionIndex]
  );

  const handleLeaderboardDataTypeTabChange = useCallback(
    (index: number) => setActiveLeaderboardDataTypeIndex(index),
    []
  );

  const pageKey = useLeaderboardPageKey();

  useEffect(() => {
    setActiveLeaderboardTimeframeIndex(0);
    setActiveCompetitionIndex(0);
  }, [pageKey]);

  useEffect(() => {
    if (activeLeaderboardTimeframeIndex === 0) {
      setLeaderboardTimeframeType("all");
    } else if (activeLeaderboardTimeframeIndex === 1) {
      setLeaderboardTimeframeType("30days");
    } else {
      setLeaderboardTimeframeType("7days");
    }
  }, [activeLeaderboardTimeframeIndex, setLeaderboardTimeframeType]);

  useEffect(() => {
    if (activeLeaderboardDataTypeIndex === 0) {
      setLeaderboardDataType("accounts");
    } else {
      setLeaderboardDataType("positions");
    }
  }, [activeLeaderboardDataTypeIndex, setLeaderboardDataType]);

  const searchAddress = useSelector(selectLeaderboardSearchAddress);
  const setSearchAddress = useSelector(selectLeaderboardSetSearchAddress);

  const leaderboardDataTypeTabsOptions = useMemo(() => {
    return leaderboardDataTypeTabs.map((value) => ({
      value,
      label: leaderboardDataTypeLabels[value],
    }));
  }, [leaderboardDataTypeLabels]);

  const leaderboardTimeframeTabsOptions = useMemo(() => {
    return leaderboardTimeframeTabs.map((value) => ({
      value,
      label: leaderboardTimeframeLabels[value],
    }));
  }, [leaderboardTimeframeLabels]);

  const competitionsTabsOptions = useMemo(() => {
    return competitionsTabs.map((value) => ({
      value,
      label: competitionLabels[value],
    }));
  }, [competitionLabels]);

  const { isMobile } = useBreakpoints();

  return (
    <div className="flex flex-col ">
      <div className="flex flex-col ">
        <LeaderboardNavigation />
      </div>

      <div>
        <div className="LeaderboardToolbar flex items-center justify-between gap-16 rounded-t-8 border-b-1/2 border-slate-600 bg-slate-900 p-20 max-md:flex-col">
          {!isCompetition ? (
            <Tabs
              type="block"
              selectedValue={activeLeaderboardDataTypeIndex}
              onChange={handleLeaderboardDataTypeTabChange}
              options={leaderboardDataTypeTabsOptions}
              qa="leaderboard-tabs"
              className="min-w-0 max-md:w-full"
              regularOptionClassname="grow"
            />
          ) : (
            <Tabs
              type="block"
              selectedValue={activeCompetitionIndex}
              onChange={handleCompetitionTabChange}
              options={competitionsTabsOptions}
              qa="leaderboard-tabs"
              className="min-w-0 max-md:w-full"
              regularOptionClassname="grow"
            />
          )}

          <div className="flex gap-8 max-md:w-full max-md:justify-between">
            <SearchInput
              placeholder={isMobile ? t`Search` : t`Search Address`}
              className="w-full max-w-[260px] max-md:min-w-[120px]"
              value={searchAddress}
              setValue={setSearchAddress}
              size="s"
            />
            {!isCompetition && (
              <Tabs
                selectedValue={activeLeaderboardTimeframeIndex}
                onChange={handleLeaderboardTimeframeTabChange}
                type="inline"
                className="shrink-0"
                options={leaderboardTimeframeTabsOptions}
              />
            )}
          </div>
        </div>

        {isCompetition && activeCompetition && (
          <BodyScrollFadeContainer>
            <div className="min-w-[1000px]">
              <CompetitionPrizes leaderboardPageKey={leaderboardPageKey} competitionType={activeCompetition} />
            </div>
          </BodyScrollFadeContainer>
        )}

        <Table activeCompetition={activeCompetition} />
      </div>
    </div>
  );
}

function Table({ activeCompetition }: { activeCompetition: CompetitionType | undefined }) {
  const { isStartInFuture } = useLeaderboardTiming();
  const leaderboardPageKey = useLeaderboardPageKey();
  const leaderboardDataType = useLeaderboardDataTypeState()[0];
  if (isStartInFuture) return null;

  const table =
    leaderboardPageKey === "leaderboard" && leaderboardDataType === "positions" ? (
      <PositionsTable />
    ) : (
      <AccountsTable activeCompetition={activeCompetition} />
    );

  return <div className="default-container w-full max-w-full">{table}</div>;
}

function AccountsTable({ activeCompetition }: { activeCompetition: CompetitionType | undefined }) {
  const accounts = useLeaderboardRankedAccounts();
  const isLoading = useSelector(selectLeaderboardIsLoading);
  const searchAddress = useSelector(selectLeaderboardSearchAddress);
  const accountsStruct = useMemo(
    () => ({
      isLoading,
      data: accounts ? accounts : [],
      error: null,
      updatedAt: 0,
    }),
    [accounts, isLoading]
  );

  return (
    <LeaderboardAccountsTable
      activeCompetition={activeCompetition}
      accounts={accountsStruct}
      searchAddress={searchAddress}
    />
  );
}

function PositionsTable() {
  const positions = useLeaderboardPositions();
  const isLoading = useSelector(selectLeaderboardIsLoading);
  const searchAddress = useSelector(selectLeaderboardSearchAddress);
  const positionsStruct = useMemo(
    () => ({
      isLoading,
      data: positions ? positions : [],
      error: null,
      updatedAt: 0,
    }),
    [positions, isLoading]
  );
  return <LeaderboardPositionsTable positions={positionsStruct} searchAddress={searchAddress} />;
}
