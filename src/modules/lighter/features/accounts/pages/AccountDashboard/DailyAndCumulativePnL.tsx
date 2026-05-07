import { Trans, t } from "@lingui/macro";
import { lightFormat } from "date-fns";
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

/**
 * DailyAndCumulativePnL Component
 *
 * 显示每日和累计盈亏图表
 * 数据来源：/api/v1/account/pnl
 */
export function DailyAndCumulativePnL({ chainId, account }: { chainId: ContractsChainId; account: Address }) {
  const [fromDate, setFromDate] = useState<Date | undefined>(undefined);

  // 计算 API 参数
  const pnlParams = useMemo(() => {
    if (!fromDate) {
      return { days: 30 }; // 默认获取最近 30 天
    }
    return {
      start_date: lightFormat(fromDate, "yyyy-MM-dd"),
    };
  }, [fromDate]);

  const { data: pnlData, cumulativeStats, error, isLoading } = useAccountPnl(chainId, account, { params: pnlParams });

  const { cardRef, handleImageDownload } = useImageDownload();

  const { isMobile } = useBreakpoints();

  const buttons = (
    <>
      <DateSelect date={fromDate} onChange={setFromDate} buttonTextPrefix={t`From`} />
    </>
  );

  const chartMargin = useMemo(() => {
    if (!pnlData || pnlData.length === 0) return CHART_MARGIN;
    const maxValue = Math.max(...pnlData.map((point) => Math.max(point.cumulativePnlFloat, point.pnlFloat)));
    const stringValue = Math.ceil(maxValue).toString();
    return { ...CHART_MARGIN, left: stringValue.length * 4 };
  }, [pnlData]);

  return (
    <div className="account-pnl-chart-card flex flex-col rounded-8" ref={cardRef}>
      <div className="flex items-center justify-between px-20 py-15">
        <div className="account-pnl-chart-card__title text-20 font-medium">
          <Trans>Daily and Cumulative PnL</Trans>
        </div>
        {isMobile ? null : <div className="flex flex-wrap items-stretch justify-end gap-8 py-8">{buttons}</div>}
      </div>

      <div className="flex flex-wrap gap-24 px-16 pt-16 text-typography-secondary">
        <div className="flex items-center gap-8 text-13 font-medium">
          <div
            className="inline-block size-4 rounded-full"
            style={{ backgroundColor: "var(--pnl-chart-profit, var(--color-green-500))" }}
          />{" "}
          <Trans>Daily Profit</Trans>
        </div>
        <div className="flex items-center gap-8 text-13 font-medium">
          <div
            className="inline-block size-4 rounded-full"
            style={{ backgroundColor: "var(--pnl-chart-loss, var(--color-red-500))" }}
          />{" "}
          <Trans>Daily Loss</Trans>
        </div>
        <div className="flex items-center gap-8 text-13 font-medium">
          <div
            className="inline-block size-4 rounded-full"
            style={{ backgroundColor: "var(--pnl-chart-cumulative, var(--color-blue-300))" }}
          />{" "}
          <Trans>
            Cumulative PnL{" "}
            <span className={getPositiveOrNegativeClass(cumulativeStats?.totalRealizedPnl)}>
              {formatUsd(cumulativeStats?.totalRealizedPnl)}
            </span>
          </Trans>
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
                  <stop offset="-45%" stopColor="var(--pnl-chart-cumulative, var(--color-blue-300))" stopOpacity={0.5} />
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

      {isMobile && <div className="flex justify-around border-t-1/2 border-slate-600 px-16 py-12">{buttons}</div>}
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
