import { Trans, t } from "@lingui/macro";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";

import type { EarnProduct } from "@/modules/lighter/api/types";

import { rgbFromHex, useEarnAccentHex } from "../../lib/earnAccent";

interface PastPerformanceChartProps {
  completedStrategies: EarnProduct[];
}

export function PastPerformanceChart({ completedStrategies }: PastPerformanceChartProps) {
  const accent = useEarnAccentHex();
  const { r, g, b } = rgbFromHex(accent);
  const hasData = completedStrategies.length > 0;

  // 空数据时使用占位数据
  const emptyPlaceholderData = [
    { name: t`1st Term`, value: 0, topOpacity: 0.1, bottomOpacity: 0.02, strokeOpacity: 0.2 },
    { name: t`2nd Term`, value: 0, topOpacity: 0.1, bottomOpacity: 0.02, strokeOpacity: 0.2 },
    { name: t`3rd Term`, value: 0, topOpacity: 0.1, bottomOpacity: 0.02, strokeOpacity: 0.2 },
  ];

  // 辅助函数：提取期数信息
  const getTermFromName = (name: string) => {
    const term = name.split(" ").slice(2).join(" ") || "Term";
    return term;
  };
  // 辅助函数：解析 APR 数字
  const parseApr = (annualRate: string) => parseFloat(annualRate.replace("%", ""));

  // 创建按时间倒序排列的数据，并动态计算每个柱子的颜色强度（基于APR大小）
  const chartData = hasData
    ? [...completedStrategies].map((strategy) => {
        const strategyApr = parseApr(strategy.annual_rate);
        // 根据APR排序获取排名（0=最低，length-1=最高）
        const sortedByApr = [...completedStrategies].sort((a, b) => parseApr(a.annual_rate) - parseApr(b.annual_rate));
        const aprRankIndex = sortedByApr.findIndex((s) => s.id === strategy.id);
        const totalCount = completedStrategies.length;

        // 计算颜色强度：排名越高，颜色越亮（0.15 - 0.5 范围，调暗整体）
        const minOpacity = 0.15;
        const maxOpacity = 0.5;
        const opacityRange = maxOpacity - minOpacity;
        const normalizedRank = totalCount > 1 ? aprRankIndex / (totalCount - 1) : 1;
        const topOpacity = minOpacity + opacityRange * normalizedRank;
        const bottomOpacity = topOpacity * 0.1; // 底部透明度为顶部的10%

        return {
          name: getTermFromName(strategy.name),
          value: strategyApr,
          topOpacity,
          bottomOpacity,
          strokeOpacity: 0.3 + normalizedRank * 0.25, // 边框透明度 0.3-0.55（调暗）
        };
      })
    : emptyPlaceholderData;

  // 计算Y轴自适应范围
  const aprValues = hasData ? completedStrategies.map((s) => parseApr(s.annual_rate)) : [0, 100];
  const minApr = Math.min(...aprValues);
  const maxApr = Math.max(...aprValues);
  const aprRange = maxApr - minApr;

  // 当只有一个数据点或所有数据点相同时，Y轴从0开始，让柱子显示到顶部
  const isSingleValueChart = aprRange === 0;
  const padding = isSingleValueChart ? maxApr * 0.1 : Math.max(aprRange * 0.2, 5);
  const yMin = isSingleValueChart ? 0 : Math.floor((minApr - padding) / 5) * 5;
  const yMax = hasData ? Math.ceil((maxApr + padding) / 5) * 5 : 100;
  const tickInterval = Math.ceil((yMax - yMin) / 5 / 5) * 5 || 20;
  const yTicks = Array.from({ length: 6 }, (_, i) => yMin + i * tickInterval);

  return (
    <div className="strategy-card border-1/2 border-slate-700 p-24 max-md:p-16">
      <h3 className="earn-accent-text text-h3 m-0 mb-20 font-primitTitle max-md:text-body-large">
        <Trans>Past Performance</Trans>
      </h3>
      <div className=" ">
        <ResponsiveContainer width="100%" height={chartData.length > 5 ? 360 : 310}>
          <BarChart data={chartData} margin={{ top: 25, right: 0, bottom: chartData.length > 5 ? 50 : 0, left: 0 }}>
            <CartesianGrid stroke="rgba(255, 255, 255, 0.1)" vertical={false} />
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              interval={0}
              angle={chartData.length > 5 ? -45 : 0}
              textAnchor={chartData.length > 5 ? "end" : "middle"}
              dy={chartData.length > 5 ? 5 : 0}
              tick={{ fill: "rgba(255, 255, 255, 1)", fontSize: chartData.length > 10 ? 10 : 12, fontFamily: "var(--primit-font-body)" }}
            />
            <YAxis
              domain={[yMin, yMax]}
              ticks={yTicks}
              orientation="right"
              tickMargin={20}
              tick={{ fill: "rgba(255, 255, 255,0.75)", fontSize: 12, fontFamily: "var(--primit-font-body)" }}
              tickFormatter={(value) => `${value}%`}
              label={{
                value: "APY",
                position: "insideTopRight",
                dy: -30,
                dx: -40,
                style: {
                  fill: "rgba(255, 255, 255,0.75)",
                  fontSize: 12,
                  fontFamily: "var(--primit-font-body)",
                  letterSpacing: "1px",
                },
              }}
            />
            <Tooltip
              cursor={{ fill: `rgba(${r}, ${g}, ${b}, 0.1)` }}
              contentStyle={{
                backgroundColor: "rgba(0, 0, 0, 0.8)",
                border: `1.5px solid ${accent}`,
                borderRadius: "0",
                padding: "12px 16px",
                boxShadow: `0 0 20px rgba(${r}, ${g}, ${b}, 0.4), 0 0 40px rgba(${r}, ${g}, ${b}, 0.2)`,
              }}
              labelStyle={{
                color: accent,
                marginBottom: "8px",
                fontFamily: "var(--primit-font-body)",
                fontSize: "14px",
                fontWeight: "500",
                letterSpacing: "0.5px",
              }}
              itemStyle={{
                color: "#fff",
                fontFamily: "var(--primit-font-body)",
                fontSize: "16px",
                fontWeight: "600",
              }}
              formatter={(value: number) => [`${value.toFixed(2)}%`, "APY"]}
            />
            <Bar dataKey="value" radius={[0, 0, 0, 0]} maxBarSize={88}>
              {chartData.map((item, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={`url(#dynamicGradient${index})`}
         
                />
              ))}
              <LabelList
                dataKey="value"
                position="top"
                content={(props: any) => {
                  const { x, y, width, value, index } = props;
                  const item = chartData[index];
                  // 使用与柱子相同的透明度来设置标签颜色
                  const labelOpacity = hasData ? item.topOpacity + 0.5 : 0.4; // 标签颜色比柱子亮一倍
                  const displayValue = hasData ? `${value.toFixed(2)}%` : "N/A";
                  return (
                    <text
                      x={x + width / 2}
                      y={hasData ? y - 5 : 150}
                      fill={`rgba(${r}, ${g}, ${b}, ${labelOpacity})`}
                      textAnchor="middle"
                      fontSize="14px"
                      fontWeight="300"
                      fontFamily="var(--primit-font-body)"
                    >
                      {displayValue}
                    </text>
                  );
                }}
              />
            </Bar>
            <defs>
              {chartData.map((item, index) => (
                <linearGradient key={`gradient-${index}`} id={`dynamicGradient${index}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={`rgba(${r}, ${g}, ${b}, ${item.topOpacity})`} />
                  <stop offset="100%" stopColor={`rgba(${r}, ${g}, ${b}, ${item.bottomOpacity})`} />
                </linearGradient>
              ))}
            </defs>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
