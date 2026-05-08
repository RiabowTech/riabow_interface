import { useMemo } from "react";
import useSWR from "swr";

import { useAuthToken } from "@/modules/lighter/api/custom/useAuthToken";
import { getPointsApiUrl } from "config/backend";
import { useChainId } from "lib/chains";
import useWallet from "lib/wallets/useWallet";

import {
  fetchPointsDailyLeaderboard,
  fetchPointsEpochs,
  fetchPointsLeaderboard,
  fetchPointsUser,
} from "../api/pointsApi.client";
import type { PointsLeaderboardPayload, PointsUserServerData } from "../api/pointsApi.types";

export interface EpochOption {
  id: number;
  label: string;
  startDate: string;
  endDate: string;
  status: string;
  seasonId: number;
  seasonLabel: string;
}

export interface PointsApiResponse {
  totalPoints: number | null;
  epochRanking: number | null;
  currentEpochPoints: number | null;
  walletAddress: string | null;
  referralCode: string | null;
  pointsBreakdown: {
    trading: number | null;
    holding: number | null;
    pnl: number | null;
    referral: number | null;
    staking: number | null;
  };
  currentUserRank: number | null;
  tier: string | null;
  tierMultiplier: string | null;
}

export interface LeaderboardItem {
  rank: number;
  address: string;
  points: number;
  isCurrent: boolean;
}

export interface LeaderboardApiResponse {
  items: LeaderboardItem[];
  updatedAt: string | null;
  epochNumber: number | null;
}

export interface PointsPageData {
  isWalletConnected: boolean;
  totalPoints: string;
  epochRanking: string | null;
  currentEpochPoints: string;
  walletAddress: string;
  referralCode: string;
  points: {
    trading: string;
    holding: string;
    pnl: string;
    referral: string;
    staking: string;
  };
  numeric: {
    trading: number;
    holding: number;
    pnl: number;
    referral: number;
    staking: number;
    total: number;
  };
  leaderboard: LeaderboardItem[];
  currentUserRank: number | null;
  /** Figma 侧栏与 hero 用 */
  daysLeft: number | null;
  epochProgressPct: number;
  seasonEpochLine: string;
  epochDateRangeLabel: string;
  leaderboardUpdatedAt: string | null;
  tierLine: string | null;
}

export interface UseEpochsResult {
  epochs: EpochOption[];
  currentEpochId: number | null;
}

export interface DailyGainerRow {
  rank: number;
  address: string;
  pointsToday: number;
  tier: string | null;
  isCurrent: boolean;
}

const DAILY_LEADERBOARD_REFRESH_MS = 5 * 60 * 1000;

function isFullEvmAddress(a: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(a.trim());
}

function toNumberOrNull(value: string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isNaN(num) ? null : num;
}

function toNumberOrZero(value: string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const num = Number(value);
  return Number.isNaN(num) ? 0 : num;
}

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function formatAddress(address: string | null | undefined): string {
  if (!address) return "—";
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function formatCompactPoints(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const sign = n < 0 ? "-" : "";
  const v = Math.abs(n);
  if (v >= 1_000_000) return `${sign}${(v / 1_000_000).toFixed(2).replace(/\.?0+$/, "")}M`;
  if (v >= 1_000) return `${sign}${(v / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return `${sign}${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function computeDaysLeft(endDateStr: string): number | null {
  const end = new Date(endDateStr);
  if (Number.isNaN(end.getTime())) return null;
  const diff = Math.ceil((end.getTime() - Date.now()) / 86400000);
  return diff < 0 ? 0 : diff;
}

function computeEpochProgressPct(startDateStr: string, endDateStr: string): number {
  const s = new Date(startDateStr).getTime();
  const e = new Date(endDateStr).getTime();
  const now = Date.now();
  if (Number.isNaN(s) || Number.isNaN(e) || e <= s) return 0;
  const t = Math.min(e, Math.max(s, now));
  return Math.round(((t - s) / (e - s)) * 100);
}

function mapUserPayload(d: PointsUserServerData): PointsApiResponse {
  return {
    totalPoints: toNumberOrNull(d.total_points),
    epochRanking: d.rank ?? null,
    currentEpochPoints: toNumberOrNull(d.total_points),
    walletAddress: d.user_address,
    referralCode: d.referral_code ?? null,
    pointsBreakdown: {
      trading: toNumberOrNull(d.trading_points),
      holding: toNumberOrNull(d.holding_points),
      pnl: toNumberOrNull(d.pnl_points),
      referral: toNumberOrNull(d.referral_points),
      staking: toNumberOrNull(d.staking_points),
    },
    currentUserRank: d.rank ?? null,
    tier: d.tier ?? null,
    tierMultiplier: d.tier_multiplier ?? null,
  };
}

function normalizeLeaderboard(
  payload: PointsLeaderboardPayload | null | undefined,
  currentUserAddress: string | null
): LeaderboardApiResponse {
  const entries = payload?.entries || [];
  const norm = currentUserAddress?.toLowerCase() || null;
  const items: LeaderboardItem[] = entries.map((item) => ({
    rank: item.rank,
    address: item.user_address,
    points: toNumberOrZero(item.points),
    isCurrent: norm ? item.user_address.toLowerCase() === norm : false,
  }));
  return {
    items,
    updatedAt: payload?.updated_at ?? null,
    epochNumber: payload?.epoch_number ?? null,
  };
}

function usePointsApi(
  epochId: number | null,
  isWalletConnected: boolean,
  userAddress?: string | null,
  jwtToken?: string | null
): PointsApiResponse | null {
  const shouldFetch = isWalletConnected && epochId !== null;
  const { chainId } = useChainId();
  const pointsApiUrl = getPointsApiUrl(chainId);
  /** 与 `useAuthToken` 同步：Sign 后 JWT 从无到有须换 key，否则会一直用旧缓存或 401 后的空态 */
  const authKey = jwtToken?.trim() ? jwtToken : "";

  const { data, error } = useSWR(
    shouldFetch ? ["points", epochId, userAddress, chainId, authKey] : null,
    () => fetchPointsUser(pointsApiUrl, epochId as number, jwtToken),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateIfStale: false,
      shouldRetryOnError: false,
      errorRetryCount: 0,
      dedupingInterval: 0,
      refreshInterval: 0,
    }
  );

  if (error || !data || !data.success || !data.data) return null;
  return mapUserPayload(data.data);
}

function useLeaderboardApi(epochId: number | null, currentUserAddress: string | null): LeaderboardApiResponse {
  const { chainId } = useChainId();
  const pointsApiUrl = getPointsApiUrl(chainId);

  const { data } = useSWR(
    epochId !== null ? ["points-leaderboard", epochId, chainId] : null,
    async () => fetchPointsLeaderboard(pointsApiUrl, epochId as number, { type_: "total", limit: 100 }),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateIfStale: false,
      shouldRetryOnError: false,
      errorRetryCount: 0,
      dedupingInterval: 0,
    }
  );

  return normalizeLeaderboard(data?.success ? data.data : null, currentUserAddress);
}

function transformPointsData(
  apiData: PointsApiResponse | null,
  leaderboardData: LeaderboardApiResponse,
  isWalletConnected: boolean,
  selectedEpoch: EpochOption | null
): PointsPageData {
  const tr = apiData?.pointsBreakdown?.trading ?? null;
  const ho = apiData?.pointsBreakdown?.holding ?? null;
  const pn = apiData?.pointsBreakdown?.pnl ?? null;
  const re = apiData?.pointsBreakdown?.referral ?? null;
  const st = apiData?.pointsBreakdown?.staking ?? null;
  const total = apiData?.totalPoints ?? 0;

  const tierLine =
    apiData?.tier && apiData?.tierMultiplier
      ? `${apiData.tier} · ${apiData.tierMultiplier}x multiplier`
      : apiData?.tier
        ? String(apiData.tier)
        : null;

  const daysLeft = selectedEpoch ? computeDaysLeft(selectedEpoch.endDate) : null;
  const epochProgressPct =
    selectedEpoch && selectedEpoch.startDate && selectedEpoch.endDate
      ? computeEpochProgressPct(selectedEpoch.startDate, selectedEpoch.endDate)
      : 0;

  const seasonEpochLine = selectedEpoch != null ? `Epoch ${selectedEpoch.id} · ${selectedEpoch.seasonLabel}` : "—";

  const epochDateRangeLabel = selectedEpoch != null ? `${selectedEpoch.startDate} → ${selectedEpoch.endDate}` : "—";

  return {
    isWalletConnected,
    totalPoints: formatNumber(isWalletConnected ? apiData?.totalPoints ?? null : null),
    epochRanking:
      apiData?.epochRanking !== null && apiData?.epochRanking !== undefined ? formatNumber(apiData.epochRanking) : null,
    currentEpochPoints: formatNumber(isWalletConnected ? apiData?.currentEpochPoints ?? null : null),
    walletAddress: formatAddress(apiData?.walletAddress),
    referralCode: apiData?.referralCode || "—",
    points: {
      trading: formatNumber(tr),
      holding: formatNumber(ho),
      pnl: formatNumber(pn),
      referral: formatNumber(re),
      staking: formatNumber(st),
    },
    numeric: {
      trading: tr ?? 0,
      holding: ho ?? 0,
      pnl: pn ?? 0,
      referral: re ?? 0,
      staking: st ?? 0,
      total: Number.isFinite(total) ? total : 0,
    },
    leaderboard: leaderboardData.items || [],
    currentUserRank: apiData?.currentUserRank || null,
    daysLeft,
    epochProgressPct,
    seasonEpochLine,
    epochDateRangeLabel,
    leaderboardUpdatedAt: leaderboardData.updatedAt,
    tierLine,
  };
}

export function useEpochs(): UseEpochsResult {
  const { chainId } = useChainId();
  const pointsApiUrl = getPointsApiUrl(chainId);

  const { data } = useSWR(["points-epochs", chainId], () => fetchPointsEpochs(pointsApiUrl), {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    shouldRetryOnError: false,
    errorRetryCount: 0,
    dedupingInterval: 0,
    refreshInterval: 0,
  });

  const backendEpochs: EpochOption[] =
    data?.success && Array.isArray(data.data)
      ? data.data.map((item) => ({
          id: item.id,
          label: item.label,
          startDate: item.startDate,
          endDate: item.endDate,
          status: item.status,
          seasonId: item.season_id ?? 1,
          seasonLabel: item.season_label?.trim() || "Season 1",
        }))
      : [];

  const activeEpoch =
    data?.success && Array.isArray(data.data)
      ? data.data.find((e) => e.status === "active") || data.data[0] || null
      : null;

  const currentEpochId = activeEpoch ? activeEpoch.id : null;

  return {
    epochs: backendEpochs,
    currentEpochId,
  };
}

export function usePointsData(epochId: number | null, epochs: EpochOption[]): PointsPageData {
  const { account } = useWallet();
  const isWalletConnected = Boolean(account);
  const userAddress = account || null;
  const { token: authToken } = useAuthToken();

  const selectedEpoch = useMemo(() => epochs.find((e) => e.id === epochId) ?? null, [epochs, epochId]);

  const pointsApiData = usePointsApi(epochId, isWalletConnected, userAddress, authToken);
  const rawAddress = pointsApiData?.walletAddress || userAddress;
  const leaderboardApiData = useLeaderboardApi(epochId, rawAddress);

  return useMemo(
    () => transformPointsData(pointsApiData, leaderboardApiData, isWalletConnected, selectedEpoch),
    [pointsApiData, leaderboardApiData, isWalletConnected, selectedEpoch]
  );
}

export interface UseDailyPointsLeaderboardResult {
  rows: DailyGainerRow[];
  refreshedAt: string | null;
  date: string | null;
  total: number | null;
  isLoading: boolean;
  error: Error | null;
}

/**
 * UTC 当日积分增量榜（`GET /points/leaderboard/daily`），与后台约 5 分钟刷新对齐；`limit` 最大 500（URL 内已钳制）。
 */
export function useDailyPointsLeaderboard(epochId: number | null, limit = 80): UseDailyPointsLeaderboardResult {
  const { chainId } = useChainId();
  const pointsApiUrl = getPointsApiUrl(chainId);
  const { account } = useWallet();
  const walletLower = account?.toLowerCase() ?? null;

  const { data, error, isLoading } = useSWR(
    ["points-daily-lb", chainId, epochId, limit],
    () =>
      fetchPointsDailyLeaderboard(pointsApiUrl, {
        epoch: epochId ?? undefined,
        limit,
        offset: 0,
      }),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      revalidateIfStale: true,
      shouldRetryOnError: false,
      errorRetryCount: 0,
      dedupingInterval: 60_000,
      refreshInterval: DAILY_LEADERBOARD_REFRESH_MS,
    }
  );

  return useMemo((): UseDailyPointsLeaderboardResult => {
    if (error) {
      return {
        rows: [],
        refreshedAt: null,
        date: null,
        total: null,
        isLoading: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
    if (!data) {
      return {
        rows: [],
        refreshedAt: null,
        date: null,
        total: null,
        isLoading,
        error: null,
      };
    }
    const rows: DailyGainerRow[] = (data.entries || []).map((item) => {
      const addr = item.user_address || "";
      const isCurrent = Boolean(walletLower && isFullEvmAddress(addr) && addr.toLowerCase() === walletLower);
      return {
        rank: item.rank,
        address: addr,
        pointsToday: toNumberOrZero(item.points_today),
        tier: item.tier ?? null,
        isCurrent,
      };
    });
    return {
      rows,
      refreshedAt: data.refreshed_at || null,
      date: data.date || null,
      total: Number.isFinite(data.total) ? data.total : null,
      isLoading: false,
      error: null,
    };
  }, [data, error, isLoading, walletLower]);
}
