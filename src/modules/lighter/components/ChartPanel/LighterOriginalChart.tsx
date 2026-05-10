import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";

import { getCandles, type KlinePeriod } from "@/modules/lighter/api/custom/client";
import { useTradeProduct, useTradeState } from "@/modules/lighter/store/TradeStateContext";
import { useChainId } from "lib/chains";

import { TVChart } from "components/TVChart/TVChart";
import type { TVChartLayout } from "components/TVChartContainer/TVChartContainer";

import styles from "./LighterOriginalChart.module.scss";
import type { CrossHairMovedEventParams } from "../../../../../charting_library";

const LIGHTER_ORIGINAL_TV_DISABLED: string[] = [
  "header_resolutions",
  "header_chart_type",
  "header_indicators",
  "header_settings",
  "header_screenshot",
  "header_fullscreen_button",
  "timeframes_toolbar",
  "control_bar",
  "border_around_the_chart",
  "main_series_scale_menu",
  "study_templates",
];

const LIGHTER_ORIGINAL_TV_OVERRIDES: Record<string, any> = {
  "paneProperties.background": "#121218",
  "paneProperties.backgroundGradientStartColor": "#121218",
  "paneProperties.backgroundGradientEndColor": "#121218",
  "paneProperties.backgroundType": "solid",
  "paneProperties.vertGridProperties.color": "rgba(0,0,0,0)",
  "paneProperties.vertGridProperties.style": 0,
  "paneProperties.horzGridProperties.color": "rgba(0,0,0,0)",
  "paneProperties.horzGridProperties.style": 0,
  "paneProperties.crossHairProperties.color": "#515155",
  "scalesProperties.backgroundColor": "#121218",
  "scalesProperties.lineColor": "rgba(0,0,0,0)",
  "scalesProperties.textColor": "#B4B4B6",
  "scalesProperties.fontSize": 11,
  "scalesProperties.showStudyLastValue": false,
  "mainSeriesProperties.priceLineColor": "#515155",
  "mainSeriesProperties.candleStyle.upColor": "#68CE8F",
  "mainSeriesProperties.candleStyle.downColor": "#E74E54",
  "mainSeriesProperties.candleStyle.wickUpColor": "#68CE8F",
  "mainSeriesProperties.candleStyle.wickDownColor": "#E74E54",
  "mainSeriesProperties.candleStyle.borderUpColor": "#68CE8F",
  "mainSeriesProperties.candleStyle.borderDownColor": "#E74E54",
  "mainSeriesProperties.statusViewStyle.showExchange": false,
  "paneProperties.legendProperties.showSeriesTitle": false,
  "paneProperties.legendProperties.showBarChange": false,
  "paneProperties.legendProperties.showStudyTitles": false,
  "paneProperties.legendProperties.showStudyArguments": false,
  "paneProperties.legendProperties.showStudyValues": false,
};

const PERIOD_MAP: Record<string, KlinePeriod> = {
  "5m": "5m",
  "15m": "15m",
  "1h": "1h",
  "4h": "4h",
};
const TIME_AXIS_HEIGHT = 26;
const GRID_VERTICAL_LINE_POSITIONS = [20, 40, 60, 80] as const;

function formatPrice(value?: string) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "--";
  return n.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function formatVolume(value?: string) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "--";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(3)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(3)}K`;
  return n.toFixed(3);
}

function formatQuoteVolume(volume?: string, close?: string) {
  const volumeNumber = Number(volume);
  const closeNumber = Number(close);
  if (!Number.isFinite(volumeNumber) || !Number.isFinite(closeNumber)) return "--";

  return formatVolume(String(volumeNumber * closeNumber));
}

function getQuoteVolumeNumber(volume?: string, close?: string) {
  const volumeNumber = Number(volume);
  const closeNumber = Number(close);
  if (!Number.isFinite(volumeNumber) || !Number.isFinite(closeNumber)) return undefined;

  return volumeNumber * closeNumber;
}

function getQuoteVolumeMa(candles: { volume: string; close: string }[], length: number) {
  if (candles.length < length) return undefined;

  const values = candles.slice(-length).map((candle) => getQuoteVolumeNumber(candle.volume, candle.close));
  if (values.some((value) => value === undefined)) return undefined;

  const sum = (values as number[]).reduce((acc, value) => acc + value, 0);
  return sum / length;
}

type HoverStats = {
  open?: string;
  high?: string;
  low?: string;
  close?: string;
  volume?: string;
  isUp?: boolean;
};

function parseHoverStats(params: CrossHairMovedEventParams | null): HoverStats | null {
  const entityValues = params?.entityValues;
  const seriesValues = entityValues?.["_seriesId"]?.values;
  if (!seriesValues?.length) return null;

  const mapped = Object.fromEntries(seriesValues.map((item) => [item.title.trim().toLowerCase(), item.value])) as Record<
    string,
    string | undefined
  >;

  let volume = mapped.volume;

  if (!volume && entityValues) {
    for (const source of Object.values(entityValues)) {
      const sourceTitle = source.title.trim().toLowerCase();
      if (!sourceTitle.includes("volume")) continue;

      const volumeItem =
        source.values.find((item) => item.title.trim().toLowerCase().includes("volume")) ?? source.values[0];

      if (volumeItem?.value) {
        volume = volumeItem.value;
        break;
      }
    }
  }

  if (!mapped.open && !mapped.high && !mapped.low && !mapped.close && !volume) {
    return null;
  }

  return {
    open: mapped.open,
    high: mapped.high,
    low: mapped.low,
    close: mapped.close,
    volume,
    isUp:
      mapped.open !== undefined && mapped.close !== undefined ? Number(mapped.close) >= Number(mapped.open) : undefined,
  };
}

export function LighterOriginalChart({ timeframe }: { timeframe: string }) {
  const { chainId } = useChainId();
  const { selectedSymbol } = useTradeState();
  const product = useTradeProduct();
  const period = PERIOD_MAP[timeframe] ?? "5m";
  const [hoverStats, setHoverStats] = useState<HoverStats | null>(null);
  const [layout, setLayout] = useState<TVChartLayout | null>(null);
  const chartRef = useRef<HTMLDivElement | null>(null);
  const [chartHeight, setChartHeight] = useState(0);
  const { data } = useSWR(
    chainId && selectedSymbol ? [product, "lighter-original-candle", chainId, selectedSymbol, period] : null,
    () => getCandles(chainId!, selectedSymbol!, { period, limit: 30 }, product),
    { refreshInterval: 5000, revalidateOnFocus: false }
  );

  const candle = data?.candles?.[data.candles.length - 1];
  const volumeMa5 = useMemo(() => getQuoteVolumeMa(data?.candles ?? [], 5), [data?.candles]);
  const volumeMa10 = useMemo(() => getQuoteVolumeMa(data?.candles ?? [], 10), [data?.candles]);
  const volumeMa20 = useMemo(() => getQuoteVolumeMa(data?.candles ?? [], 20), [data?.candles]);
  const currentQuoteVolume = useMemo(() => getQuoteVolumeNumber(candle?.volume, candle?.close), [candle?.close, candle?.volume]);
  const latestIsUp = candle ? Number(candle.close) >= Number(candle.open) : true;
  const displayStats = useMemo(
    () => ({
      open: hoverStats?.open ?? formatPrice(candle?.open),
      high: hoverStats?.high ?? formatPrice(candle?.high),
      low: hoverStats?.low ?? formatPrice(candle?.low),
      close: hoverStats?.close ?? formatPrice(candle?.close),
      volume: hoverStats?.volume ?? formatQuoteVolume(candle?.volume, candle?.close),
    }),
    [candle?.close, candle?.high, candle?.low, candle?.open, candle?.volume, hoverStats]
  );
  const displayIsUp = hoverStats?.isUp ?? latestIsUp;
  const valueClass = displayIsUp ? styles.valueUp : styles.valueDown;

  const handleCrosshairMove = useCallback((params: CrossHairMovedEventParams | null) => {
    setHoverStats(parseHoverStats(params));
  }, []);

  useEffect(() => {
    const node = chartRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setChartHeight(entry.contentRect.height);
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const volumePaneHeight = layout?.paneHeights?.[1] ?? 0;
  const mainPaneHeight = useMemo(() => {
    if (!chartHeight) return 0;
    return Math.max(0, chartHeight - TIME_AXIS_HEIGHT - volumePaneHeight);
  }, [chartHeight, volumePaneHeight]);
  const volumeHeaderTop = useMemo(() => {
    if (!volumePaneHeight || !chartHeight) return undefined;
    return Math.max(0, chartHeight - TIME_AXIS_HEIGHT - volumePaneHeight);
  }, [chartHeight, volumePaneHeight]);
  const mainPaneGridStyle = useMemo(
    () => (mainPaneHeight > 0 ? { height: mainPaneHeight } : undefined),
    [mainPaneHeight]
  );
  const volumePaneOverlayStyle = useMemo(
    () => (volumeHeaderTop !== undefined ? { top: volumeHeaderTop, height: volumePaneHeight } : undefined),
    [volumeHeaderTop, volumePaneHeight]
  );

  return (
    <div className={styles.root}>
      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.label}>Open:</span>
          <span className={valueClass}>{displayStats.open}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.label}>High:</span>
          <span className={valueClass}>{displayStats.high}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.label}>Low:</span>
          <span className={valueClass}>{displayStats.low}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.label}>Close:</span>
          <span className={valueClass}>{displayStats.close}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.label}>Volume:</span>
          <span className={valueClass}>{displayStats.volume}</span>
        </div>
      </div>

      <div className={styles.chart} ref={chartRef}>
        {mainPaneGridStyle ? (
          <div className={styles.mainPaneGrid} style={mainPaneGridStyle}>
            {GRID_VERTICAL_LINE_POSITIONS.map((position) => (
              <div
                key={`main-grid-${position}`}
                className={styles.paneVerticalLine}
                style={{ left: `${position}%` }}
              />
            ))}
          </div>
        ) : null}
        <TVChart
          extraDisabledFeatures={LIGHTER_ORIGINAL_TV_DISABLED}
          extraOverrides={LIGHTER_ORIGINAL_TV_OVERRIDES}
          customCssUrl="/lighter-original-tv.css"
          initialBarsCount={170}
          onCrosshairMove={handleCrosshairMove}
          onLayoutChange={setLayout}
          visiblePlotsSet="ohlc"
          volumeMetric="quote"
          createVolumeStudyOnReady
          loadLastChart={false}
          disableAutoSave
        />
        {volumePaneOverlayStyle ? (
          <div className={styles.volumePaneOverlay} style={volumePaneOverlayStyle}>
            <div className={styles.volumePaneGrid}>
              {GRID_VERTICAL_LINE_POSITIONS.map((position) => (
                <div
                  key={`volume-grid-${position}`}
                  className={styles.paneVerticalLine}
                  style={{ left: `${position}%` }}
                />
              ))}
            </div>
            <div className={`${styles.volumePaneHorizontalLine} ${styles.volumePaneHorizontalLine25}`} />
            <div className={`${styles.volumePaneHorizontalLine} ${styles.volumePaneHorizontalLine50}`} />
            <div className={`${styles.volumePaneHorizontalLine} ${styles.volumePaneHorizontalLine75}`} />
            <div className={styles.volumePaneDivider} />
            <div className={styles.volumePaneAxisMask} />
            <div className={`${styles.volumePaneAxisLabel} ${styles.volumePaneAxisLabel25}`}>150M</div>
            <div className={`${styles.volumePaneAxisLabel} ${styles.volumePaneAxisLabel50}`}>100M</div>
            <div className={`${styles.volumePaneAxisLabel} ${styles.volumePaneAxisLabel75}`}>50M</div>
            <div className={styles.volumePaneLegend}>
              <span className={styles.volumePaneLabel}>VOL(5,10,20)</span>
              <span className={styles.volumePaneMa5}>MA5: {formatVolume(volumeMa5?.toString())}</span>
              <span className={styles.volumePaneMa10}>MA10: {formatVolume(volumeMa10?.toString())}</span>
              <span className={styles.volumePaneMa20}>MA20: {formatVolume(volumeMa20?.toString())}</span>
              <span className={styles.volumePaneVolume}>VOLUME: {formatVolume(currentQuoteVolume?.toString())}</span>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
