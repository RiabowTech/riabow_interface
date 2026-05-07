import useSWR from "swr";

import { getTradingBackendUrl } from "config/backend";
import { CONFIG_UPDATE_INTERVAL } from "lib/timeConstants";

import { LeaderboardDataType } from "./types";

export * from "./types";

/**
 * 后端返回 USD 金额是十进制字符串（无 1e30 缩放）；
 * 前端 selectors / `formatUsd` 仍按 1e30 整数处理，故这里精确放大。
 * 走字符串拆分而非 `parseFloat * 10^30`：后者在 abs > 2^53 时会丢精度。
 */
function decimalStringToScaled(s: string | null | undefined, decimals = 30): bigint {
  if (!s) return 0n;
  let str = s.trim();
  if (!str) return 0n;
  const negative = str.startsWith("-");
  if (negative) str = str.slice(1);
  if (str.startsWith("+")) str = str.slice(1);
  const [intPart, fracPart = ""] = str.split(".");
  const fracPadded = (fracPart + "0".repeat(decimals)).slice(0, decimals);
  const digits = (intPart || "0") + fracPadded;
  // Strip leading zeros except a single one.
  const trimmed = digits.replace(/^0+(?=\d)/, "");
  const value = BigInt(trimmed.length === 0 ? "0" : trimmed);
  return negative ? -value : value;
}

export type LeaderboardAccountBase = {
  account: string;
  cumsumCollateral: bigint;
  cumsumSize: bigint;
  sumMaxSize: bigint;

  maxCapital: bigint;
  netCapital: bigint;
  hasRank: boolean;

  realizedPriceImpact: bigint;
  realizedFees: bigint;
  realizedPnl: bigint;

  startUnrealizedPnl: bigint;
  startUnrealizedPriceImpact: bigint;
  startUnrealizedFees: bigint;

  closedCount: number;
  volume: bigint;
  losses: number;
  wins: number;
};

export type LeaderboardAccount = LeaderboardAccountBase & {
  totalCount: number;
  totalPnl: bigint;
  totalQualifyingPnl: bigint;
  totalFees: bigint;
  unrealizedFees: bigint;
  unrealizedPnl: bigint;
  pnlPercentage: bigint;
  averageSize: bigint;
  averageLeverage: bigint;
};

export type LeaderboardPositionBase = {
  key: string;
  account: string;
  realizedFees: bigint;
  unrealizedFees: bigint;
  isLong: boolean;
  market: string;
  maxSize: bigint;
  realizedPriceImpact: bigint;
  unrealizedPriceImpact: bigint;
  isSnapshot: boolean;
  unrealizedPnl: bigint;
  realizedPnl: bigint;
  sizeInTokens: bigint;
  sizeInUsd: bigint;
  entryPrice: bigint;
  collateralToken: string;
  collateralAmount: bigint;
  snapshotTimestamp: number;
};

export type LeaderboardPosition = LeaderboardPositionBase & {
  rank: number;
  fees: bigint;
  pnl: bigint;
  qualifyingPnl: bigint;
  leverage: bigint;
  collateralUsd: bigint;
  closingFeeUsd: bigint;
};

/**
 * Primit `GET /api/v1/leaderboard/traders` 响应里 `traders` 项形状。
 * 与后端 `LeaderboardResponse::traders[*]` 严格对齐
 * (`backend/src/api/handlers/leaderboard_traders.rs`)。
 */
type PrimitTraderDto = {
  address: string;
  rank: number;
  realized_pnl: string;
  fees_paid: string;
  volume: string;
  trade_count: number;
  wins: number;
  losses: number;
  has_rank: boolean;
};

type PrimitLeaderboardEnvelope = {
  success: boolean;
  data?: {
    traders: PrimitTraderDto[];
    from: number;
    to: number;
    updated_at: string;
  };
  error?: { code?: string; message?: string } | null;
};

const fetchAccounts = async (
  chainId: number,
  p: { account?: string; from?: number; to?: number }
): Promise<LeaderboardAccountBase[] | undefined> => {
  // `p.from === 0` is the "All-time" sentinel from LEADERBOARD_PAGES.leaderboard.timeframe;
  // pass it through verbatim — the backend treats `from=0` as "no lower bound".
  if (p.from === undefined) return [];

  const base = getTradingBackendUrl(chainId).replace(/\/$/, "");
  const params = new URLSearchParams({ from: String(p.from) });
  if (p.to !== undefined) params.set("to", String(p.to));
  if (p.account) params.set("account", p.account.toLowerCase());
  params.set("limit", "100");

  const url = `${base}/api/v1/leaderboard/traders?${params.toString()}`;

  let env: PrimitLeaderboardEnvelope | null = null;
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      mode: "cors",
    });
    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.warn(`leaderboard fetch failed: ${res.status}`);
      return [];
    }
    env = (await res.json()) as PrimitLeaderboardEnvelope;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("leaderboard fetch error", err);
    return [];
  }

  if (!env?.success || !env.data) return [];

  return env.data.traders.map((t) => {
    const realizedPnl = decimalStringToScaled(t.realized_pnl);
    const realizedFees = decimalStringToScaled(t.fees_paid);
    const volume = decimalStringToScaled(t.volume);
    return {
      account: t.address,

      // Primit 模型不维护这些 GMX-only 累积量,留 0;
      // 对应 selectors / 列(averageSize / averageLeverage / maxCapital / pnlPercentage)
      // 在 LeaderboardAccountsTable 已被砍掉,这里给 0 不会渲染出错。
      cumsumCollateral: 0n,
      cumsumSize: 0n,
      sumMaxSize: 0n,
      maxCapital: 0n,
      netCapital: 0n,
      realizedPriceImpact: 0n,
      startUnrealizedPnl: 0n,
      startUnrealizedPriceImpact: 0n,
      startUnrealizedFees: 0n,

      realizedPnl,
      realizedFees,
      volume,
      // closedCount 仅作为分母在 averageSize selector 里用,Primit 没有"关仓笔数",
      // 用 wins+losses (= 实现 PnL 事件总数) 近似;由于 averageSize 列也已隐,
      // 这里近似不会被展示,只为防止其它残留消费方除零。
      closedCount: t.wins + t.losses,
      losses: t.losses,
      wins: t.wins,

      hasRank: t.has_rank,
    };
  });
};

export function useLeaderboardData(
  enabled: boolean,
  chainId: number,
  p: {
    account: string | undefined;
    from: number;
    to: number | undefined;
    positionsSnapshotTimestamp: number | undefined;
    leaderboardDataType: LeaderboardDataType | undefined;
  }
) {
  const { data, error, isLoading } = useSWR(
    enabled
      ? [
          "leaderboard/useLeaderboardData",
          chainId,
          p.account,
          p.from,
          p.to,
          p.positionsSnapshotTimestamp,
          p.leaderboardDataType,
        ]
      : null,
    async () => {
      const [accounts, positions] = await Promise.all([
        p.leaderboardDataType === "positions" ? Promise.resolve([]) : fetchAccounts(chainId, p),
        fetchPositions(chainId, p.positionsSnapshotTimestamp),
      ]);

      return {
        accounts,
        positions,
      };
    },
    {
      refreshInterval: CONFIG_UPDATE_INTERVAL,
    }
  );

  return { data, error, isLoading };
}

/**
 * Top Positions tab was retired with the move from GMX subsquid to the Primit
 * trader-leaderboard backend (no historical position-snapshot infra exists).
 * The UI tab is gone (`LeaderboardContainer.tsx`); this stub stays so any
 * residual import resolves cleanly to an empty list rather than throwing.
 */
const fetchPositions = async (
  _chainId: number,
  _snapshotTimestamp: number | undefined
): Promise<LeaderboardPositionBase[] | undefined> => {
  return [];
};
