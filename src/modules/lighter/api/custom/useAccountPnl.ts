/**
 * useAccountPnl Hook
 *
 * 获取账户每日和累计盈亏数据
 * GET /api/v1/account/pnl
 */
import useSWR from "swr";
import { lightFormat, parse } from "date-fns";
import { t } from "@lingui/macro";

import { ContractsChainId } from "config/chains";
import { USD_DECIMALS } from "config/factors";
import { bigintToNumber, expandDecimals } from "lib/numbers";
import { EMPTY_ARRAY } from "lib/objects";
import { helperToast } from "lib/helperToast";
import { getAccountPnl } from "./client";
import { useAuthToken } from "./useAuthToken";
import type { GetPnlParams, DailyPnl, CumulativePnl } from "../types";

// ============================================
// Types
// ============================================

/**
 * 组件使用的每日盈亏数据点（Model）
 */
export interface AccountPnlHistoryPoint {
  date: string; // 格式化后的日期
  dateCompact: string; // 紧凑日期格式 (dd/MM)
  timestamp: number; // Unix 时间戳（秒）
  pnl: bigint; // 当日盈亏 (30 decimals)
  pnlFloat: number; // 当日盈亏（浮点数）
  cumulativePnl: bigint; // 累计盈亏 (30 decimals)
  cumulativePnlFloat: number; // 累计盈亏（浮点数）
  volume: bigint; // 交易量 (30 decimals)
  volumeFloat: number; // 交易量（浮点数）
  tradeCount: number; // 交易次数
  fees: bigint; // 手续费 (30 decimals)
  feesFloat: number; // 手续费（浮点数）
}

/**
 * 累计统计数据（Model）
 */
export interface AccountCumulativeStats {
  totalRealizedPnl: bigint;
  totalRealizedPnlFloat: number;
  totalUnrealizedPnl: bigint;
  totalUnrealizedPnlFloat: number;
  totalPnl: bigint;
  totalPnlFloat: number;
  totalVolume: bigint;
  totalVolumeFloat: number;
  totalTrades: number;
  totalFees: bigint;
  totalFeesFloat: number;
  winRate: number; // 百分比
  avgProfitPerTrade: bigint;
  avgProfitPerTradeFloat: number;
}

// ============================================
// Helpers
// ============================================

const MINIMUM_DATA_POINTS = 7;

/**
 * 将字符串金额转换为 bigint (30 decimals)
 */
function parseUsdToBigint(value: string): bigint {
  const num = parseFloat(value);
  if (isNaN(num)) return 0n;
  // 转换为 30 decimals
  return BigInt(Math.round(num * 1e6)) * expandDecimals(1, USD_DECIMALS - 6);
}

/**
 * 将 API 响应转换为组件需要的数据格式
 */
function transformPnlData(
  dailyData: DailyPnl[],
  cumulative: CumulativePnl
): { points: AccountPnlHistoryPoint[]; stats: AccountCumulativeStats } {
  // 计算累计盈亏（从第一天累加）
  let runningCumulativePnl = 0n;

  // 将每日数据转换为组件格式
  let points: AccountPnlHistoryPoint[] = dailyData.map((day) => {
    const pnl = parseUsdToBigint(day.realized_pnl);
    runningCumulativePnl += pnl;
    const volume = parseUsdToBigint(day.volume);
    const fees = parseUsdToBigint(day.fees);

    // 解析日期字符串 YYYY-MM-DD
    const dateObj = parse(day.date, "yyyy-MM-dd", new Date());
    const timestamp = Math.floor(dateObj.getTime() / 1000);

    return {
      date: day.date,
      dateCompact: lightFormat(dateObj, "dd/MM"),
      timestamp,
      pnl,
      pnlFloat: bigintToNumber(pnl, USD_DECIMALS),
      cumulativePnl: runningCumulativePnl,
      cumulativePnlFloat: bigintToNumber(runningCumulativePnl, USD_DECIMALS),
      volume,
      volumeFloat: bigintToNumber(volume, USD_DECIMALS),
      tradeCount: day.trade_count,
      fees,
      feesFloat: bigintToNumber(fees, USD_DECIMALS),
    };
  });

  // 如果数据点不足，补充空数据
  if (points.length > 0 && points.length < MINIMUM_DATA_POINTS) {
    const firstPoint = points[0];
    const firstTimestamp = firstPoint.timestamp;

    const emptyPoints: AccountPnlHistoryPoint[] = [];
    for (let i = 1; i <= MINIMUM_DATA_POINTS - points.length; i++) {
      const newTimestamp = firstTimestamp - 86400 * i; // 86400 = seconds in a day
      const newDate = new Date(newTimestamp * 1000);
      emptyPoints.unshift({
        date: lightFormat(newDate, "yyyy-MM-dd"),
        dateCompact: lightFormat(newDate, "dd/MM"),
        timestamp: newTimestamp,
        pnl: 0n,
        pnlFloat: 0,
        cumulativePnl: 0n,
        cumulativePnlFloat: 0,
        volume: 0n,
        volumeFloat: 0,
        tradeCount: 0,
        fees: 0n,
        feesFloat: 0,
      });
    }
    points = [...emptyPoints, ...points];
  }

  // 转换累计统计
  const stats: AccountCumulativeStats = {
    totalRealizedPnl: parseUsdToBigint(cumulative.total_realized_pnl),
    totalRealizedPnlFloat: parseFloat(cumulative.total_realized_pnl) || 0,
    totalUnrealizedPnl: parseUsdToBigint(cumulative.total_unrealized_pnl),
    totalUnrealizedPnlFloat: parseFloat(cumulative.total_unrealized_pnl) || 0,
    totalPnl: parseUsdToBigint(cumulative.total_pnl),
    totalPnlFloat: parseFloat(cumulative.total_pnl) || 0,
    totalVolume: parseUsdToBigint(cumulative.total_volume),
    totalVolumeFloat: parseFloat(cumulative.total_volume) || 0,
    totalTrades: cumulative.total_trades,
    totalFees: parseUsdToBigint(cumulative.total_fees),
    totalFeesFloat: parseFloat(cumulative.total_fees) || 0,
    winRate: parseFloat(cumulative.win_rate) || 0,
    avgProfitPerTrade: parseUsdToBigint(cumulative.avg_profit_per_trade),
    avgProfitPerTradeFloat: parseFloat(cumulative.avg_profit_per_trade) || 0,
  };

  return { points, stats };
}

// ============================================
// Hook
// ============================================

export interface UseAccountPnlOptions {
  enabled?: boolean;
  params?: GetPnlParams;
}

export function useAccountPnl(
  chainId: ContractsChainId | undefined,
  address: string | undefined,
  options?: UseAccountPnlOptions
) {
  const { token } = useAuthToken(chainId);
  const enabled = options?.enabled !== false && Boolean(chainId && token && address);

  const { data, error, isLoading, mutate } = useSWR(
    enabled ? ["account-pnl", chainId, address, token, options?.params] : null,
    async () => {
      if (!chainId || !address) {
        throw new Error("Chain ID and address are required");
      }
      return getAccountPnl(chainId, options?.params, address);
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      refreshInterval: 60000, // Refresh every 60 seconds
      onError: (err) => {
        // Show translated error message in toast
        // This runs in React context, so t macro works correctly
        const errorMessage = t`Failed to fetch daily PnL`;
        helperToast.error(errorMessage);
      },
    }
  );

  // Transform data
  const transformedData = data
    ? transformPnlData(data.daily, data.cumulative)
    : { points: EMPTY_ARRAY as AccountPnlHistoryPoint[], stats: undefined };

  return {
    data: transformedData.points,
    cumulativeStats: transformedData.stats,
    isLoading,
    error,
    mutate,
  };
}
