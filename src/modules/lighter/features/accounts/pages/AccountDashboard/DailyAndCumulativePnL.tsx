import { Trans, t } from "@lingui/macro";
import { lightFormat, subDays } from "date-fns";
import { toPng } from "html-to-image";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  TooltipProps,
  XAxis,
  YAxis,
} from "recharts";
import type { Address } from "viem";

import { useAccountPnl, AccountPnlHistoryPoint } from "@/modules/lighter/api/custom/useAccountPnl";
import type { ContractsChainId } from "config/chains";
import downloadImage from "lib/downloadImage";
import { helperToast } from "lib/helperToast";
import { formatUsd } from "lib/numbers";
import { useBreakpoints } from "lib/useBreakpoints";
import { getPositiveOrNegativeClass } from "lib/utils";

import Button from "components/Button/Button";
import { DateSelect } from "components/DateRangeSelect/DateRangeSelect";
import Loader from "components/Loader/Loader";
import StatsTooltipRow from "components/StatsTooltip/StatsTooltipRow";

import DownloadIcon from "img/ic_download2.svg?react";

import "./DailyAndCumulativePnL.css";

const CHART_TOOLTIP_WRAPPER_STYLE: React.CSSProperties = { zIndex: 10000 };

const CHART_TICK_PROPS: React.SVGProps<SVGTextElement> = {
  fill: "var(--pnl-chart-tick, var(--color-slate-100))",
  fontSize: 11,
  fontWeight: 500,
};

const X_AXIS_LINE_PROPS: React.SVGProps<SVGLineElement> = {
  stroke: "var(--pnl-chart-axis-line, var(--color-slate-600))",
  strokeWidth: 0.5,
};

const CHART_CURSOR_PROPS = {
  stroke: "var(--pnl-chart-cursor, var(--color-slate-500))",
  strokeWidth: 1,
  strokeDasharray: "2 2",
};

const ACTIVE_DOT_PROPS = {
  r: 4,
  strokeWidth: 2,
  stroke: "var(--pnl-chart-active-dot-stroke, var(--color-blue-300))",
  fill: "var(--pnl-chart-active-dot-fill, var(--color-slate-900))",
};

const CHART_MARGIN = { top: 16, right: 16, bottom: 16, left: 0 };
const RANGE_OPTIONS = ["7D", "30D", "90D", "ALL"] as const;

type RangeOption = (typeof RANGE_OPTIONS)[number] | "CUSTOM";

function OverviewProfitIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 16.5 9 11.5l3.5 3.5L20 7.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M15 7.5h5v5" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

function OverviewLossIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7.5 9 12.5l3.5-3.5L20 16.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M15 16.5h5v-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

function OverviewPnlIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3a9 9 0 1 0 9 9h-9V3Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M15 3.6A9 9 0 0 1 20.4 9H15V3.6Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path
        d="M5.5 2.5v3m9-3v3M3.25 8h13.5M5 4.5h10a2 2 0 0 1 2 2V15a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.4"
      />
    </svg>
  );
}

function ChartMenuIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M4 5h12M4 10h12M4 15h12" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
    </svg>
  );
}

/**
 * DailyAndCumulativePnL Component
 *
 * 显示每日和累计盈亏图表
 * 数据来源：/api/v1/account/pnl
 */
export function DailyAndCumulativePnL({ chainId, account }: { chainId: ContractsChainId; account: Address }) {
  const [fromDate, setFromDate] = useState<Date | undefined>(undefined);
  const [activeRange, setActiveRange] = useState<RangeOption>("30D");

  // 计算 API 参数
  const pnlParams = useMemo(() => {
    if (activeRange === "ALL") {
      return {};
    }
    if (!fromDate) {
      return { days: 30 }; // 默认获取最近 30 天
    }
    return {
      start_date: lightFormat(fromDate, "yyyy-MM-dd"),
    };
  }, [activeRange, fromDate]);

  const { data: pnlData, cumulativeStats, error, isLoading } = useAccountPnl(chainId, account, { params: pnlParams });

  const { cardRef, handleImageDownload } = useImageDownload();

  const { isMobile } = useBreakpoints();

  const setPresetRange = useCallback((range: RangeOption) => {
    setActiveRange(range);
    if (range === "ALL") {
      setFromDate(undefined);
      return;
    }
    if (range === "CUSTOM") {
      return;
    }

    setFromDate(subDays(new Date(), Number.parseInt(range, 10)));
  }, []);

  const buttons = (
    <>
      <div className="account-overview-range">
        {RANGE_OPTIONS.map((range) => (
          <button
            key={range}
            type="button"
            className={activeRange === range ? "account-overview-range__button is-active" : "account-overview-range__button"}
            onClick={() => setPresetRange(range)}
          >
            {range}
          </button>
        ))}
        <div className={activeRange === "CUSTOM" ? "account-overview-custom is-active" : "account-overview-custom"}>
          <DateSelect
            date={fromDate}
            onChange={(date) => {
              setActiveRange("CUSTOM");
              setFromDate(date);
            }}
            buttonTextPrefix={t`Custom`}
          />
        </div>
      </div>
    </>
  );

  const overviewStats = useMemo(() => {
    const dailyProfit = pnlData.reduce((total, point) => (point.pnl > 0n ? total + point.pnl : total), 0n);
    const dailyLoss = pnlData.reduce((total, point) => (point.pnl < 0n ? total + point.pnl : total), 0n);

    return {
      dailyProfit,
      dailyLoss,
      cumulativePnl: cumulativeStats?.totalRealizedPnl,
    };
  }, [cumulativeStats?.totalRealizedPnl, pnlData]);

  const chartMargin = useMemo(() => {
    if (!pnlData || pnlData.length === 0) return CHART_MARGIN;
    const maxValue = Math.max(...pnlData.map((point) => Math.max(point.cumulativePnlFloat, point.pnlFloat)));
    const stringValue = Math.ceil(maxValue).toString();
    return { ...CHART_MARGIN, left: stringValue.length * 4 };
  }, [pnlData]);

  return (
    <div className="account-pnl-stack" ref={cardRef}>
      <div className="account-overview-card">
        <div className="account-overview-main">
          <h2>
            <Trans>Overview</Trans>
          </h2>
          <div className="account-overview-metrics">
            <div className="account-overview-metric">
              <span className="account-overview-metric__icon account-overview-metric__icon--profit">
                <OverviewProfitIcon />
              </span>
              <div>
                <span className="account-overview-metric__label">
                  <Trans>Daily Profit</Trans>
                </span>
                <div className="account-overview-metric__value-row">
                  <span className="account-overview-metric__value account-overview-metric__value--profit">
                    {formatUsd(overviewStats.dailyProfit)}
                  </span>
                  <span className="account-overview-metric__badge">0.00%</span>
                </div>
              </div>
            </div>
            <div className="account-overview-metric">
              <span className="account-overview-metric__icon account-overview-metric__icon--loss">
                <OverviewLossIcon />
              </span>
              <div>
                <span className="account-overview-metric__label">
                  <Trans>Daily Loss</Trans>
                </span>
                <div className="account-overview-metric__value-row">
                  <span className="account-overview-metric__value account-overview-metric__value--loss">
                    {formatUsd(overviewStats.dailyLoss)}
                  </span>
                  <span className="account-overview-metric__badge">0.00%</span>
                </div>
              </div>
            </div>
            <div className="account-overview-metric account-overview-metric--last">
              <span className="account-overview-metric__icon account-overview-metric__icon--pnl">
                <OverviewPnlIcon />
              </span>
              <div>
                <span className="account-overview-metric__label">
                  <Trans>Cumulative PnL</Trans>
                </span>
                <div className="account-overview-metric__value-row">
                  <span
                    className={`account-overview-metric__value ${getPositiveOrNegativeClass(
                      overviewStats.cumulativePnl
                    )}`}
                  >
                    {formatUsd(overviewStats.cumulativePnl)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
        {isMobile ? null : buttons}
      </div>

      <div className="account-pnl-chart-card flex flex-col rounded-8">
        <div className="account-pnl-chart-card__header">
          <div>
            <div className="account-pnl-chart-card__title text-20 font-medium">
              <Trans>Daily and Cumulative PnL</Trans>
            </div>
            <div className="account-pnl-chart-card__legend">
              <div className="account-pnl-chart-card__legend-item">
                <span style={{ backgroundColor: "var(--pnl-chart-profit, var(--color-green-500))" }} />
                <Trans>Daily Profit</Trans>
              </div>
              <div className="account-pnl-chart-card__legend-item">
                <span style={{ backgroundColor: "var(--pnl-chart-loss, var(--color-red-500))" }} />
                <Trans>Daily Loss</Trans>
              </div>
              <div className="account-pnl-chart-card__legend-item">
                <span style={{ backgroundColor: "var(--pnl-chart-cumulative, var(--color-blue-300))" }} />
                <Trans>Cumulative PnL (USD)</Trans>
              </div>
            </div>
          </div>
          <div className="account-pnl-chart-card__tools">
            <button type="button" className="account-pnl-chart-card__filter">
              <CalendarIcon />
              <Trans>All</Trans>
            </button>
            <button type="button" className="account-pnl-chart-card__menu" aria-label={t`Chart menu`}>
              <ChartMenuIcon />
            </button>
          </div>
        </div>

        <div className="relative min-h-[250px] grow">
          <div className="DailyAndCumulativePnL-hide-last-tick absolute size-full">
            <ResponsiveContainer debounce={500}>
              <ComposedChart
                width={500}
                height={300}
                data={pnlData}
                barCategoryGap="25%"
                margin={chartMargin}
                // @ts-expect-error
                overflow="visible"
              >
                <RechartsTooltip
                  cursor={CHART_CURSOR_PROPS}
                  content={ChartTooltip}
                  wrapperStyle={CHART_TOOLTIP_WRAPPER_STYLE}
                />
                <CartesianGrid
                  vertical={false}
                  strokeDasharray="5 3"
                  strokeWidth={0.5}
                  stroke="var(--pnl-chart-grid, var(--color-slate-600))"
                />
                <Bar dataKey="pnlFloat" minPointSize={1} radius={2}>
                  {pnlData.map(renderPnlBar)}
                </Bar>

                <defs>
                  <linearGradient id="cumulative-pnl-gradient" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="-45%"
                      stopColor="var(--pnl-chart-cumulative, var(--color-blue-300))"
                      stopOpacity={0.5}
                    />
                    <stop offset="100%" stopColor="var(--pnl-chart-cumulative, var(--color-blue-300))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="cumulativePnlFloat"
                  stroke="var(--pnl-chart-cumulative, var(--color-blue-300))"
                  fill="url(#cumulative-pnl-gradient)"
                  strokeWidth={2}
                  dot={false}
                  baseValue="dataMin"
                  activeDot={ACTIVE_DOT_PROPS}
                />
                <XAxis
                  dataKey="dateCompact"
                  tickLine={false}
                  axisLine={X_AXIS_LINE_PROPS}
                  minTickGap={isMobile ? 20 : 32}
                  tick={CHART_TICK_PROPS}
                  tickMargin={10}
                />
                <YAxis
                  type="number"
                  allowDecimals={false}
                  markerWidth={0}
                  axisLine={false}
                  tickLine={false}
                  tickMargin={10}
                  tickFormatter={yAxisTickFormatter}
                  tick={CHART_TICK_PROPS}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          {error && (
            <div className="absolute grid size-full max-h-full place-items-center overflow-auto">
              <div className="whitespace-pre-wrap text-red-500">
                <Trans>Failed to load PnL data</Trans>
              </div>
            </div>
          )}
          {isLoading && (
            <div className="absolute grid size-full place-items-center">
              <Loader />
            </div>
          )}
          {!isLoading && !error && pnlData.length === 0 && (
            <div className="absolute grid size-full place-items-center text-typography-secondary">
              <Trans>No data available</Trans>
            </div>
          )}
        </div>

        {isMobile && <div className="account-overview-mobile-range">{buttons}</div>}
      </div>
    </div>
  );
}

function renderPnlBar(entry: AccountPnlHistoryPoint) {
  let fill: string;
  if (entry.pnl > 0n) {
    fill = "var(--pnl-chart-profit, var(--color-green-500))";
  } else if (entry.pnl < 0n) {
    fill = "var(--pnl-chart-loss, var(--color-red-500))";
  } else {
    fill = "var(--pnl-chart-neutral, var(--color-gray-900))";
  }
  return <Cell key={entry.date} fill={fill} />;
}

function yAxisTickFormatter(value: number) {
  if (!isFinite(value)) return "0";

  return formatUsd(BigInt(value as number) * 10n ** 30n, { displayDecimals: 0 })!;
}

function ChartTooltip({ active, payload }: TooltipProps<number | string, "pnl" | "cumulativePnl" | "date">) {
  if (!active || !payload || !payload.length) {
    return null;
  }

  const stats = payload[0].payload as AccountPnlHistoryPoint;

  return (
    <div
      className={`backdrop-blur-100 text-body-small z-50 flex flex-col rounded-4 bg-[rgba(160,163,196,0.1)]
      bg-[linear-gradient(0deg,var(--color-slate-800),var(--color-slate-800))] px-12 pt-8 bg-blend-overlay shadow-lg`}
    >
      <StatsTooltipRow label={t`Date`} value={stats.date} showDollar={false} />
      <StatsTooltipRow
        label={t`PnL`}
        value={formatUsd(stats.pnl)}
        showDollar={false}
        textClassName={getPositiveOrNegativeClass(stats.pnl)}
      />
      <StatsTooltipRow
        label={t`Cumulative PnL`}
        value={formatUsd(stats.cumulativePnl)}
        showDollar={false}
        textClassName={getPositiveOrNegativeClass(stats.cumulativePnl)}
      />
      <StatsTooltipRow label={t`Volume`} value={formatUsd(stats.volume)} showDollar={false} />
      <StatsTooltipRow label={t`Trades`} value={String(stats.tradeCount)} showDollar={false} />
      <StatsTooltipRow label={t`Fees`} value={formatUsd(stats.fees)} showDollar={false} />
    </div>
  );
}

function useImageDownload() {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleImageDownload = useCallback(() => {
    if (!cardRef.current) {
      helperToast.error("Error in downloading image");
      return;
    }

    toPng(cardRef.current, {
      filter: (element) => {
        if (element.dataset?.exclude) {
          return false;
        }
        return true;
      },
    }).then((dataUri) => {
      downloadImage(dataUri, "daily-and-cumulative-pnl.png");
    });
  }, []);

  return { cardRef, handleImageDownload };
}
