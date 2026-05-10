import random from "lodash/random";

import { isLocal } from "config/env";
import { Bar, FromNewToOldArray } from "domain/tradingview/types";
import {
  metrics,
  OracleKeeperFailureCounter,
  OracleKeeperFallbackCounter,
  OracleKeeperMetricMethodId,
} from "lib/metrics";
import { getCandles, type KlinePeriod } from "@/modules/lighter/api/client";
import { getOracleKeeperFallbackUrls, getOracleKeeperUrl } from "sdk/configs/oracleKeeper";
import { getNormalizedTokenSymbol } from "sdk/configs/tokens";
import { buildUrl } from "sdk/utils/buildUrl";

import {
  ApyInfo,
  ApyPeriod,
  BatchReportBody,
  DayPriceCandle,
  OracleFetcher,
  PerformanceAnnualizedResponse,
  PerformancePeriod,
  PerformanceSnapshotsResponse,
  RawIncentivesStats,
  TickersResponse,
  UserFeedbackBody,
} from "./types";

function parseOracleCandle(rawCandle: number[]): Bar {
  const [time, open, high, low, close] = rawCandle;

  return {
    time,
    open,
    high,
    low,
    close,
  };
}

// Convert token symbol (e.g., "BTC-USD") to API symbol format (e.g., "BTCUSDT")
function convertSymbolToApiFormat(tokenSymbol: string): string {
  // Remove "-USD" suffix and add "USDT"
  if (tokenSymbol.endsWith("-USD")) {
    return tokenSymbol.replace("-USD", "USDT");
  }
  // If already in correct format, return as is
  if (tokenSymbol.includes("USDT")) {
    return tokenSymbol;
  }
  // Default: append USDT
  return `${tokenSymbol}USDT`;
}

// Convert period string to seconds
function getPeriodSeconds(period: string): number {
  const periodSecondsMap: Record<string, number> = {
    "1": 60,
    "5": 60 * 5,
    "15": 60 * 15,
    "30": 60 * 30,
    "60": 60 * 60,
    "240": 60 * 60 * 4,
    "1D": 60 * 60 * 24,
    "1W": 60 * 60 * 24 * 7,
    "1M": 60 * 60 * 24 * 30,
  };
  return periodSecondsMap[period] || 60;
}

// Convert period string to API KlinePeriod format
// TradingView resolution -> API period mapping
// Note: DataFeed passes SUPPORTED_RESOLUTIONS_V2[resolution] which may be in API format (e.g., "1m", "5m", "1h", "1d")
// or TradingView format (e.g., "1W", "1M" for weekly/monthly)
// API only supports: "1m", "5m", "15m", "1h", "4h", "1d" (no 30m / weekly / monthly)
function convertPeriodToApiFormat(period: string): KlinePeriod {
  // If period is already in API format and supported, return as is
  const supportedPeriods: KlinePeriod[] = ["1m", "5m", "15m", "1h", "4h", "1d"];
  if (supportedPeriods.includes(period as KlinePeriod)) {
    return period as KlinePeriod;
  }

  // Convert from TradingView resolution format or handle unsupported periods.
  // 30m and weekly/monthly are not supported by the backend → fall back to a
  // nearby supported interval rather than passing through and getting a 400.
  const periodMap: Record<string, KlinePeriod> = {
    "1": "1m",
    "5": "5m",
    "15": "15m",
    "30": "15m", // 30m not supported → use the next finer granularity
    "60": "1h",
    "240": "4h",
    "1D": "1d",
    "1W": "1d", // Weekly not supported, fallback to daily
    "1M": "1d", // Monthly not supported, fallback to daily
    "1w": "1d", // Weekly not supported, fallback to daily (lowercase w)
  };
  return periodMap[period] || "1m";
}

// Check if we're in trade mode
function isTradeMode(): boolean {
  // 始终返回 true
  return true;
}

const failsPerMinuteToFallback = 5;

export class OracleKeeperFetcher implements OracleFetcher {
  private readonly chainId: number;

  private isFallback: boolean;
  private fallbackUrls: string[];
  private fallbackThrottleTimerId: number | undefined;
  private fallbackIndex: number;
  private failTimes: number[];
  private mainUrl: string;

  constructor(p: { chainId: number }) {
    this.chainId = p.chainId;
    this.fallbackUrls = getOracleKeeperFallbackUrls(this.chainId);
    this.mainUrl = getOracleKeeperUrl(this.chainId);
    this.isFallback = false;
    this.failTimes = [];
  }

  get url() {
    return this.isFallback ? this.fallbackUrls[this.fallbackIndex] : this.mainUrl;
  }

  handleFailure(method: OracleKeeperMetricMethodId) {
    if (this.fallbackThrottleTimerId) {
      return;
    }

    metrics.pushCounter<OracleKeeperFailureCounter>("oracleKeeper.failure", {
      chainId: this.chainId,
      method,
    });

    this.failTimes.push(Date.now());

    this.failTimes = this.failTimes.filter((time) => time > Date.now() - 60000);

    if (this.failTimes.length >= failsPerMinuteToFallback) {
      if (this.isFallback) {
        this.fallbackIndex = (this.fallbackIndex + 1) % this.fallbackUrls.length;
      } else {
        this.fallbackIndex = random(0, this.fallbackUrls.length - 1);
      }

      // eslint-disable-next-line no-console
      console.warn(`oracle keeper fallback ${this.chainId} to ${this.fallbackIndex}`);
      this.isFallback = true;
      this.failTimes = [];

      metrics.pushCounter<OracleKeeperFallbackCounter>("oracleKeeper.fallback", {
        chainId: this.chainId,
      });
    }

    this.fallbackThrottleTimerId = window.setTimeout(() => {
      this.fallbackThrottleTimerId = undefined;
    }, 5000);
  }

  fetchTickers(): Promise<TickersResponse> {
    // Disabled: price data is fetched from Zanbara API
    return Promise.resolve([]);

    // return fetch(buildUrl(this.url!, "/prices/tickers"))
    //   .then((res) => res.json())
    //   .then((res) => {
    //     if (!res.length) {
    //       throw new Error("Invalid tickers response");
    //     }

    //     return res;
    //   })
    //   .catch((e) => {
    //     // eslint-disable-next-line no-console
    //     console.error(e);
    //     this.handleFailure("tickers");

    //     throw e;
    //   });
  }

  fetch24hPrices(): Promise<DayPriceCandle[]> {
    // Disabled: 24h price data is no longer fetched from oracle keeper
    return Promise.resolve([]);
  }

  fetchPostBatchReport(body: BatchReportBody, debug?: boolean): Promise<Response> {
    // Disabled: metrics reporting to oracle keeper is no longer used
    if (debug) {
    }
    return Promise.resolve(new Response());
  }

  fetchPostFeedback(body: UserFeedbackBody, debug): Promise<Response> {
    // Disabled: feedback reporting to oracle keeper is no longer used
    if (debug) {
    }
    return Promise.resolve(new Response());
  }

  fetchApys(period: ApyPeriod): Promise<ApyInfo> {
    // Disabled: APY data is no longer fetched from oracle keeper
    return Promise.resolve({} as ApyInfo);
  }

  async fetchOracleCandles(tokenSymbol: string, period: string, limit: number): Promise<FromNewToOldArray<Bar>> {
    // Use new API for trade mode
    if (isTradeMode()) {
      try {
        tokenSymbol = getNormalizedTokenSymbol(tokenSymbol);
        const apiSymbol = convertSymbolToApiFormat(tokenSymbol);
        const apiPeriod = convertPeriodToApiFormat(period);

        // Calculate time range to fetch more historical data
        // API expects start/end in milliseconds
        // New API has max limit of 500, so we need to cap it
        const maxLimit = 500; // API maximum limit
        const effectiveLimit = Math.min(limit, maxLimit);

        const now = Date.now(); // Current time in milliseconds
        const periodSeconds = getPeriodSeconds(period);
        const timeRangeMs = effectiveLimit * periodSeconds * 1000; // Time range in milliseconds
        const end = now; // End time is now
        const start = now - timeRangeMs; // Start time is (limit * period) ago

        const response = await getCandles(this.chainId, apiSymbol, {
          period: apiPeriod,
          limit: effectiveLimit, // Use capped limit
          start, // Start time in milliseconds
          end, // End time in milliseconds
        });

        // Convert API response to Bar format
        // Note: fetchOracleCandles returns FromNewToOldArray (newest first)
        // DataFeed will call .reverse() to convert to FromOldToNewArray (oldest first)
        // So we need to return data in FromNewToOldArray format (newest first)
        // Old API returns data as number[]: [time, open, high, low, close] where time is in seconds
        // New API returns objects with time in milliseconds, so we convert to seconds

        if (!response.candles || response.candles.length === 0) {
          throw new Error(`No candles returned for ${apiSymbol}`);
        }

        // Convert to Bar format
        // Note: Old API returns number[]: [time, open, high, low, close] where time is in seconds
        // New API returns objects with time in SECONDS (actual API behavior, despite doc saying milliseconds)
        // We need to ensure the data format matches exactly what the old API returns
        const bars: Bar[] = response.candles.map((candle) => {
          // API actually returns time in seconds, not milliseconds (despite documentation)
          // Check if time is in seconds (if < 1e10) or milliseconds (if >= 1e10)
          let timeInSeconds: number;
          if (candle.time < 1e10) {
            // Time is already in seconds (actual API behavior)
            timeInSeconds = Math.floor(candle.time);
          } else {
            // Time is in milliseconds (if API changes in future), convert to seconds
            timeInSeconds = Math.floor(candle.time / 1000);
          }

          return {
            time: timeInSeconds, // Time in seconds (formatTimeInBarToMs will convert back to ms)
            open: parseFloat(candle.open),
            high: parseFloat(candle.high),
            low: parseFloat(candle.low),
            close: parseFloat(candle.close),
          };
        });

        // Validate we have enough data
        if (bars.length === 0) {
          throw new Error(`No valid bars after conversion for ${apiSymbol}`);
        }

        // Sort by time descending (newest first) to match FromNewToOldArray format
        // This matches the old API behavior where data comes in newest-first order
        bars.sort((a, b) => b.time - a.time);

        return bars as FromNewToOldArray<Bar>;
      } catch (e) {
        this.handleFailure("candles");
        throw e;
      }
    }

    // Use old API for non-trade mode
    tokenSymbol = getNormalizedTokenSymbol(tokenSymbol);

    return fetch(buildUrl(this.url!, "/prices/candles", { tokenSymbol, period, limit }))
      .then((res) => res.json())
      .then((res) => {
        if (!Array.isArray(res.candles) || (res.candles.length === 0 && limit > 0)) {
          throw new Error("Invalid candles response");
        }

        return res.candles.map(parseOracleCandle);
      })
      .catch((e) => {
        // eslint-disable-next-line no-console
        console.error(e);
        this.handleFailure("candles");
        throw e;
      });
  }

  async fetchIncentivesRewards(): Promise<RawIncentivesStats | null> {
    // Disabled: incentives data is no longer fetched from oracle keeper
    return Promise.resolve(null);
  }

  async fetchUiVersion(currentVersion: number, active: boolean): Promise<number> {
    // Disabled: UI version check from oracle keeper is no longer used
    return Promise.resolve(currentVersion);
  }

  fetchPerformanceAnnualized(period: PerformancePeriod, address?: string): Promise<PerformanceAnnualizedResponse> {
    // Disabled: performance data is no longer fetched from oracle keeper
    return Promise.resolve({} as PerformanceAnnualizedResponse);
  }

  fetchPerformanceSnapshots(period: PerformancePeriod, address?: string): Promise<PerformanceSnapshotsResponse> {
    // Disabled: performance snapshots data is no longer fetched from oracle keeper
    return Promise.resolve({} as PerformanceSnapshotsResponse);
  }
}
