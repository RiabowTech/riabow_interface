import { useMemo } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import styles from "./LighterDepthChart.module.scss";
import { LIGHTER_DEPTH_CHART_THEME } from "./lighterDepthChartTheme";
import { useOrderBookAdapter } from "../../adapters/useOrderBookAdapter";

const AXIS_TICK = { fill: LIGHTER_DEPTH_CHART_THEME.axisText, fontSize: 11 };
const Y_AXIS_DOMAIN = [0, "auto"] as const;
const REFERENCE_LABEL = {
  value: "MID PRICE",
  position: "bottom" as const,
  fill: LIGHTER_DEPTH_CHART_THEME.axisText,
  fontSize: 10,
  offset: 6,
};
const TOOLTIP_CURSOR = { stroke: LIGHTER_DEPTH_CHART_THEME.reference, strokeDasharray: "2 2" };

type Point = { price: number; bid?: number; ask?: number };

function formatUsd(v: number): string {
  if (!Number.isFinite(v)) return "-";
  return "$" + v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatBtc(v: number): string {
  if (!Number.isFinite(v)) return "-";
  return v.toLocaleString(undefined, { minimumFractionDigits: 5, maximumFractionDigits: 5 });
}

function formatYAxisTick(v: number): string {
  if (LIGHTER_DEPTH_CHART_THEME.hideZeroYAxisTick && Math.abs(v) < 1e-9) {
    return "";
  }

  return v >= 1000 ? `${(v / 1000).toFixed(2)}K` : v.toFixed(2);
}

function DepthTooltip({
  active,
  payload,
  midPrice,
  currency,
}: {
  active?: boolean;
  payload?: Array<{ payload: Point & { side: "bid" | "ask"; totalCost: number } }>;
  midPrice: number;
  currency: string;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  const side = p.side;
  const total = side === "bid" ? p.bid : p.ask;
  if (total == null) return null;
  const rangePct = midPrice > 0 ? ((p.price - midPrice) / midPrice) * 100 : 0;
  const rangeStr = (rangePct >= 0 ? "+" : "") + rangePct.toFixed(2) + "%";
  const priceLabel = `${side === "bid" ? "≥" : "≤"} ${p.price.toLocaleString(undefined, { maximumFractionDigits: 1 })}`;

  return (
    <div className={styles.tip}>
      <div className={styles.tipRow}>
        <span className={styles.tipLabel}>Price</span>
        <span className={styles.tipValue}>{priceLabel}</span>
      </div>
      <div className={styles.tipRow}>
        <span className={styles.tipLabel}>
          Total Size <span className={styles.tipUnit}>{currency}</span>
        </span>
        <span className={styles.tipValue}>{formatBtc(total)}</span>
      </div>
      <div className={styles.tipRow}>
        <span className={styles.tipLabel}>Total Cost</span>
        <span className={styles.tipValue}>{formatUsd(p.totalCost)}</span>
      </div>
      <div className={styles.tipRow}>
        <span className={styles.tipLabel}>Range</span>
        <span className={styles.tipValue}>{rangeStr}</span>
      </div>
    </div>
  );
}

export function LighterDepthChart({ currency = "BTC" }: { currency?: string } = {}) {
  const ob = useOrderBookAdapter();

  const { data, midPrice, priceRange } = useMemo(() => {
    if (!ob.bids.length || !ob.asks.length) {
      return { data: [] as Point[], midPrice: 0, priceRange: [0, 0] as [number, number] };
    }
    const bestBid = ob.bids[0].price;
    const bestAsk = ob.asks[0].price;
    const mid = (bestBid + bestAsk) / 2;

    const bidAsc = [...ob.bids].sort((a, b) => a.price - b.price);
    const askAsc = [...ob.asks].sort((a, b) => a.price - b.price);
    const points: any[] = [];

    for (const l of bidAsc) {
      // Total cost = running sum of size * price
      const cost = cumulativeCost(bidAsc, l.price, "bid");
      points.push({ price: l.price, bid: l.total, side: "bid", totalCost: cost });
    }
    points.push({ price: mid, bid: 0, ask: 0, side: "bid", totalCost: 0 });
    for (const l of askAsc) {
      const cost = cumulativeCost(askAsc, l.price, "ask");
      points.push({ price: l.price, ask: l.total, side: "ask", totalCost: cost });
    }

    const minPrice = bidAsc[0].price;
    const maxPrice = askAsc[askAsc.length - 1].price;
    const spread = Math.max(mid - minPrice, maxPrice - mid);
    return {
      data: points,
      midPrice: mid,
      priceRange: [mid - spread, mid + spread] as [number, number],
    };
  }, [ob]);

  if (!data.length) {
    return <div className={styles.empty}>No depth data</div>;
  }

  return (
    <div className={styles.wrap}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={LIGHTER_DEPTH_CHART_THEME.chartMargin}>
          <defs>
            <linearGradient id="ltrBidGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={LIGHTER_DEPTH_CHART_THEME.bidStroke} stopOpacity={0.28} />
              <stop offset="95%" stopColor={LIGHTER_DEPTH_CHART_THEME.bidStroke} stopOpacity={0.08} />
            </linearGradient>
            <linearGradient id="ltrAskGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={LIGHTER_DEPTH_CHART_THEME.askStroke} stopOpacity={0.28} />
              <stop offset="95%" stopColor={LIGHTER_DEPTH_CHART_THEME.askStroke} stopOpacity={0.08} />
            </linearGradient>
          </defs>

          <CartesianGrid stroke={LIGHTER_DEPTH_CHART_THEME.grid} strokeDasharray="2 2" vertical={false} />

          <XAxis
            dataKey="price"
            type="number"
            domain={priceRange}
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => v.toLocaleString(undefined, { maximumFractionDigits: 1 })}
            minTickGap={40}
          />
          <YAxis
            orientation={LIGHTER_DEPTH_CHART_THEME.yAxisOrientation}
            domain={Y_AXIS_DOMAIN}
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            width={60}
            tickFormatter={formatYAxisTick}
          />

          <Area
            dataKey="bid"
            type="stepBefore"
            stroke={LIGHTER_DEPTH_CHART_THEME.bidStroke}
            strokeWidth={1.25}
            fill="url(#ltrBidGradient)"
            isAnimationActive={false}
            connectNulls={false}
          />
          <Area
            dataKey="ask"
            type="stepAfter"
            stroke={LIGHTER_DEPTH_CHART_THEME.askStroke}
            strokeWidth={1.25}
            fill="url(#ltrAskGradient)"
            isAnimationActive={false}
            connectNulls={false}
          />

          {LIGHTER_DEPTH_CHART_THEME.showMidPriceLine ? (
            <ReferenceLine
              x={midPrice}
              stroke={LIGHTER_DEPTH_CHART_THEME.reference}
              strokeDasharray="2 2"
              label={LIGHTER_DEPTH_CHART_THEME.showMidPriceLabel ? REFERENCE_LABEL : undefined}
            />
          ) : null}

          <Tooltip
            cursor={TOOLTIP_CURSOR}
            content={(props) => <DepthTooltip {...(props as any)} midPrice={midPrice} currency={currency} />}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * 按方向累加价格×数量计算 Total Cost
 */
function cumulativeCost(
  sortedLevels: { price: number; size: number; total: number }[],
  upTo: number,
  side: "bid" | "ask"
): number {
  let cost = 0;
  for (const l of sortedLevels) {
    if (side === "bid" ? l.price >= upTo : l.price <= upTo) {
      cost += l.size * l.price;
    }
  }
  return cost;
}
