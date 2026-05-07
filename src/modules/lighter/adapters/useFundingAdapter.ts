import { useMemo } from "react";

import { useChainId } from "lib/chains";
import { usePrimitFundingHistory, usePrimitFundingRate } from "modules/lighter/api/hooks";
import { useTradeState } from "modules/lighter/store/TradeStateContext";

import type {
  FundingHistoryPoint,
  FundingRange,
  FundingSummary,
  FundingViewModel,
} from "../components/ChartPanel/fundingMock";
import { formatFundingPct } from "../utils/fundingFormat";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const RANGE_WINDOW_MS: Record<FundingRange, number> = {
  "24H": DAY_MS,
  "1W": 7 * DAY_MS,
  "1M": 30 * DAY_MS,
};

const RANGE_TO_PERIOD: Record<FundingRange, string> = {
  "24H": "24h",
  "1W": "1w",
  "1M": "1m",
};

const RANGE_TO_LIMIT: Record<FundingRange, number> = {
  "24H": 100,
  "1W": 168,
  "1M": 720,
};

function safeNumber(v: string | number | null | undefined): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizeTimestamp(ts: number): number {
  // API 可能返回秒或毫秒
  return ts < 1e12 ? ts * 1000 : ts;
}

function formatPct(rate: number | null, fractionDigits = 4): string {
  if (rate == null) return "-";
  return formatFundingPct(rate * 100, fractionDigits);
}

function parseNextFundingMs(v: string | number | null | undefined): number | null {
  if (v == null) return null;
  if (typeof v === "number") return normalizeTimestamp(v);
  const asNum = Number(v);
  if (Number.isFinite(asNum)) return normalizeTimestamp(asNum);
  const iso = Date.parse(v);
  return Number.isFinite(iso) ? iso : null;
}

function formatCountdown(nextMs: number | null): string {
  if (!nextMs) return "-";
  const diffMs = Math.max(0, nextMs - Date.now());
  const totalSec = Math.floor(diffMs / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  // funding 周期最长 8 小时 → 倒计时不会跨日;<1h 时省略小时段。
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

type TimedPoint = FundingHistoryPoint & { _ts: number };

function aggregateRate(points: TimedPoint[], windowMs: number, nowMs: number): number | null {
  const cutoff = nowMs - windowMs;
  const filtered = points.filter((p) => p._ts >= cutoff);
  if (!filtered.length) return null;
  return filtered.reduce((sum, p) => sum + p.rate, 0);
}

export function useFundingAdapter(range: FundingRange): FundingViewModel {
  const { chainId } = useChainId();
  const { selectedSymbol } = useTradeState();
  const symbol = selectedSymbol ?? undefined;

  const { data: currentRate } = usePrimitFundingRate(chainId, symbol);
  const { data: history } = usePrimitFundingHistory(chainId, symbol, {
    period: RANGE_TO_PERIOD[range],
    limit: RANGE_TO_LIMIT[range],
  });

  return useMemo<FundingViewModel>(() => {
    const now = Date.now();
    // API 实际返回 { rates: [...] } 或 数组,兼容两种
    const rawList: any[] = Array.isArray(history)
      ? history
      : Array.isArray((history as any)?.rates)
        ? (history as any).rates
        : [];

    const points: TimedPoint[] = rawList
      .map((entry: any) => {
        const rate = safeNumber(entry.rate ?? entry.funding_rate) ?? 0;
        const rawTs = entry.timestamp ?? entry.funding_time ?? entry.next_funding_time;
        const ts = typeof rawTs === "number" ? normalizeTimestamp(rawTs) : Date.parse(String(rawTs ?? "")) || 0;
        return {
          label: formatHistoryLabel(ts, range),
          rate,
          positiveRate: rate >= 0 ? rate : undefined,
          negativeRate: rate < 0 ? rate : undefined,
          _ts: ts,
        };
      })
      .filter((p) => p._ts > 0)
      .sort((a, b) => a._ts - b._ts);

    const windowPoints = points.filter((p) => p._ts >= now - RANGE_WINDOW_MS[range]);

    const realtime = safeNumber(currentRate?.funding_rate_per_hour) ?? safeNumber(currentRate?.funding_rate);
    const weekly = aggregateRate(points, 7 * DAY_MS, now);
    const monthly = aggregateRate(points, 30 * DAY_MS, now);
    const yearly = aggregateRate(points, 365 * DAY_MS, now);

    const summary: FundingSummary = {
      realtimeFundingRate: formatPct(realtime),
      interval: "1h",
      nextFundingCountdown: formatCountdown(parseNextFundingMs(currentRate?.next_funding_time)),
      weeklyFundingRate: formatPct(weekly),
      monthlyFundingRate: formatPct(monthly),
      yearlyFundingRate: formatPct(yearly),
    };

    return {
      summary,
      history: windowPoints.length ? windowPoints : points,
    };
  }, [history, currentRate, range]);
}

function formatHistoryLabel(ts: number, range: FundingRange): string {
  const d = new Date(ts);
  if (range === "24H") {
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
