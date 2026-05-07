import { Trans, t } from "@lingui/macro";
import cx from "classnames";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { TVChart } from "components/TVChart/TVChart";

import { useMarketInfoAdapter } from "../../adapters/useMarketInfoAdapter";

import type { EntityId, IChartingLibraryWidget, SeriesType } from "../../../../charting_library";

import styles from "./ChartPanel.module.scss";
import { DetailsPanel } from "./DetailsPanel";
import { FundingPanel } from "./FundingPanel";
import { LighterDepthChart } from "./LighterDepthChart";
import { LIGHTER_DEPTH_CHART_THEME } from "./lighterDepthChartTheme";
import { LighterOriginalChart } from "./LighterOriginalChart";

// 用 TV widget 配置压平为 Lighter 风格:纯黑底、隐藏内置 toolbar/symbol-info、保留左侧画线工具
const LIGHTER_TV_DISABLED: string[] = [
  "header_resolutions",
  "header_chart_type",
  "header_indicators",
  "header_settings",
  "header_screenshot",
  "header_fullscreen_button",
  "header_widget", // 整个顶部 header(含 OHLC 行)
  "timeframes_toolbar",
  "control_bar",
  "border_around_the_chart",
  "main_series_scale_menu",
  "study_templates",
];

const LIGHTER_TV_OVERRIDES: Record<string, any> = {
  "paneProperties.background": "#121218",
  "paneProperties.backgroundGradientStartColor": "#121218",
  "paneProperties.backgroundGradientEndColor": "#121218",
  "paneProperties.backgroundType": "solid",
  "paneProperties.vertGridProperties.color": "#1F1F24",
  "paneProperties.vertGridProperties.style": 0,
  "paneProperties.horzGridProperties.color": "#1F1F24",
  "paneProperties.horzGridProperties.style": 0,
  "paneProperties.crossHairProperties.color": "#515155",
  "scalesProperties.backgroundColor": "#121218",
  "scalesProperties.lineColor": "rgba(0,0,0,0)",
  "scalesProperties.textColor": "#B4B4B6",
  "mainSeriesProperties.priceLineColor": "#E64558",
  "mainSeriesProperties.candleStyle.upColor": "#00B26B",
  "mainSeriesProperties.candleStyle.downColor": "#E64558",
  "mainSeriesProperties.candleStyle.wickUpColor": "#00B26B",
  "mainSeriesProperties.candleStyle.wickDownColor": "#E64558",
  "mainSeriesProperties.candleStyle.borderUpColor": "#00B26B",
  "mainSeriesProperties.candleStyle.borderDownColor": "#E64558",
  "mainSeriesProperties.statusViewStyle.showExchange": true,
  "mainSeriesProperties.statusViewStyle.showSymbolAsDescription": false,
  "mainSeriesProperties.statusViewStyle.symbolTextSource": "ticker",
  "mainSeriesProperties.statusViewStyle.showInterval": true,
  "paneProperties.legendProperties.showBarChange": false,
  "paneProperties.legendProperties.showStudyTitles": true,
  "paneProperties.legendProperties.showStudyArguments": false,
  "paneProperties.legendProperties.showStudyValues": true,
};

type TopTab = "Price" | "Funding" | "Details";
type ChartMode = "TradingView" | "Original" | "Depth";

const DEPTH_FRAME_STYLE = { padding: LIGHTER_DEPTH_CHART_THEME.outerPadding };
const TV_ENABLED_FEATURES_TO_REMOVE = ["hide_left_toolbar_by_default"];

const MORE_TFS: { label: string; value: string }[] = [
  { label: "1m", value: "1m" },
  { label: "D", value: "1d" },
  { label: "W", value: "1w" },
  { label: "M", value: "1M" },
];

// Mirror numeric values from TradingView's `SeriesType` enum (from charting_library.d.ts).
const CHART_SERIES_TYPE = {
  Bars: 0,
  Candles: 1,
  Line: 2,
  Area: 3,
  HeikenAshi: 8,
  HollowCandles: 9,
  Baseline: 10,
} as const satisfies Record<string, SeriesType>;

type ChartTypeOpt = { label: string; value: SeriesType; icon: ReactNode };

const BarsIcon = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M5 3v10M3 6h2M5 8h2" />
    <path d="M11 4v8M9 7h2M11 9h2" />
  </svg>
);
const CandlesIcon = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M5 2v2" />
    <rect x="3.5" y="4" width="3" height="6" rx="0.5" />
    <path d="M5 10v2" />
    <path d="M11 3v3" />
    <rect x="9.5" y="6" width="3" height="5" rx="0.5" />
    <path d="M11 11v2" />
  </svg>
);
const LineIcon = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M2 12l3-4 3 2 4-6 3 3" />
  </svg>
);
const AreaIcon = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="currentColor"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M2 12l3-5 3 3 3-6 3 4v4H2z" fillOpacity="0.35" />
    <path d="M2 12l3-5 3 3 3-6 3 4" fill="none" />
  </svg>
);

const getChartTypeOptions = (): ChartTypeOpt[] => [
  { label: t`Bars`, value: CHART_SERIES_TYPE.Bars, icon: BarsIcon },
  { label: t`Candles`, value: CHART_SERIES_TYPE.Candles, icon: CandlesIcon },
  { label: t`Line`, value: CHART_SERIES_TYPE.Line, icon: LineIcon },
  { label: t`Area`, value: CHART_SERIES_TYPE.Area, icon: AreaIcon },
];

export function ChartPanel() {
  const [topTab, setTopTab] = useState<TopTab>("Price");
  const [mode, setMode] = useState<ChartMode>("TradingView");
  const [tf, setTf] = useState("15m");
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const tabs: TopTab[] = ["Price", "Funding", "Details"];
  // "Original" 图表模式暂时下线(改动回归后再打开): 保留枚举值用于向后兼容,但从 UI 渲染列表中移除
  const modes: ChartMode[] = ["TradingView", "Depth"];
  const tfs = ["5m", "15m", "1h", "4h"];
  const moreTfValues = MORE_TFS.map((o) => o.value);

  // TradingView widget instance (for chart type / chart properties actions)
  const [tvWidget, setTvWidget] = useState<IChartingLibraryWidget | null>(null);
  const [chartType, setChartType] = useState<SeriesType>(CHART_SERIES_TYPE.Candles);
  const [chartTypeOpen, setChartTypeOpen] = useState(false);
  const chartTypeRef = useRef<HTMLDivElement>(null);
  const chartTypeOptions = getChartTypeOptions();

  // Chart Elements popover state:
  //   Mark Price Line  —— 后端 mark_price 的自定义水平线(橙色虚线,createShape 管理)
  //   Raw Prices       —— TradingView 内建 last-trade 价格线(mainSeriesProperties.showPriceLine)
  //   对齐 Lighter:两个 toggle 独立,可单开 / 双开 / 双关
  const [chartElementsOpen, setChartElementsOpen] = useState(false);
  const chartElementsRef = useRef<HTMLDivElement>(null);
  const [markPriceLine, setMarkPriceLine] = useState(false);
  const [rawPrices, setRawPrices] = useState(true);
  const market = useMarketInfoAdapter();
  const markPriceValue = market.markPrice;
  const markLineEntityRef = useRef<EntityId | null>(null);

  useEffect(() => {
    if (!moreOpen) return;
    const onDocDown = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, [moreOpen]);

  useEffect(() => {
    if (!chartTypeOpen) return;
    const onDocDown = (e: MouseEvent) => {
      if (chartTypeRef.current && !chartTypeRef.current.contains(e.target as Node)) setChartTypeOpen(false);
    };
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, [chartTypeOpen]);

  useEffect(() => {
    if (!chartElementsOpen) return;
    const onDocDown = (e: MouseEvent) => {
      if (chartElementsRef.current && !chartElementsRef.current.contains(e.target as Node)) setChartElementsOpen(false);
    };
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, [chartElementsOpen]);

  // Sync current chart type from TV widget on ready + subscribe to external changes
  useEffect(() => {
    if (!tvWidget) return;
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    const sync = () => {
      if (cancelled) return;
      try {
        setChartType(tvWidget.activeChart().chartType());
      } catch (_error) {
        /* not ready */
      }
    };
    sync();

    try {
      const sub = tvWidget.activeChart().onChartTypeChanged();
      sub.subscribe(null, sync);
      unsubscribe = () => {
        try {
          sub.unsubscribeAll(null);
        } catch (_error) {
          /* ignore */
        }
      };
    } catch (_error) {
      /* ignore */
    }

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [tvWidget]);

  const handlePickChartType = useCallback(
    (type: SeriesType) => {
      setChartTypeOpen(false);
      if (!tvWidget) return;
      try {
        tvWidget.activeChart().setChartType(type);
        setChartType(type);
      } catch (error) {
        console.error("[ChartPanel] setChartType failed", error);
      }
    },
    [tvWidget]
  );

  const toggleMarkPriceLine = useCallback(() => {
    setMarkPriceLine((v) => !v);
  }, []);

  const toggleRawPrices = useCallback(() => {
    setRawPrices((v) => !v);
  }, []);

  const handleOpenIndicators = useCallback(() => {
    if (!tvWidget) return;
    try {
      tvWidget.activeChart().executeActionById("insertIndicator");
    } catch (error) {
      console.error("[ChartPanel] open indicators dialog failed", error);
    }
  }, [tvWidget]);

  // Raw Prices (TV 内建 last price line):开启时用 Lighter 红 #E64558,对齐参考截图里那条红点线。
  // widget 重建 / toggle / 首次 ready 都要重新 apply,避免被初始 LIGHTER_TV_OVERRIDES 的灰色覆盖。
  useEffect(() => {
    if (!tvWidget) return;
    try {
      tvWidget.applyOverrides({
        "mainSeriesProperties.showPriceLine": rawPrices,
        "mainSeriesProperties.priceLineColor": "#E64558",
        "mainSeriesProperties.priceLineWidth": 1,
      });
    } catch (error) {
      console.error("[ChartPanel] apply showPriceLine override failed", error);
    }
  }, [tvWidget, rawPrices]);

  // Mark Price Line 自定义水平线:在 markPrice 变化 / toggle 切换时 remove → re-add。
  // TV 的 horizontal_line shape 没有 setPrice 入口,整线重建代价小(mark price 秒级更新)。
  useEffect(() => {
    if (!tvWidget) return;

    const chart = tvWidget.activeChart();

    const removeExisting = () => {
      if (markLineEntityRef.current == null) return;
      try {
        chart.removeEntity(markLineEntityRef.current);
      } catch (_error) {
        /* chart gone */
      }
      markLineEntityRef.current = null;
    };

    if (!markPriceLine || !markPriceValue || markPriceValue <= 0) {
      removeExisting();
      return;
    }

    removeExisting();

    try {
      const id = chart.createShape(
        { time: Math.floor(Date.now() / 1000), price: markPriceValue },
        {
          shape: "horizontal_line",
          lock: true,
          disableSelection: true,
          disableSave: true,
          disableUndo: true,
          overrides: {
            linecolor: "#E3A32D",
            linestyle: 2, // dashed
            linewidth: 1,
            showLabel: true,
            textcolor: "#E3A32D",
            horzLabelsAlign: "right",
          },
        }
      );
      markLineEntityRef.current = id ?? null;
    } catch (error) {
      console.error("[ChartPanel] create mark price line failed", error);
    }

    return removeExisting;
  }, [tvWidget, markPriceLine, markPriceValue]);

  return (
    <div className={styles.root}>
      <div className={styles.topTabs}>
        <div className={styles.tabsLeft}>
          {tabs.map((t) => (
            <button key={t} onClick={() => setTopTab(t)} className={topTab === t ? styles.tabActive : styles.tab}>
              {t === "Price" ? <Trans>Price</Trans> : t === "Funding" ? <Trans>Funding</Trans> : <Trans>Details</Trans>}
            </button>
          ))}
        </div>
        {topTab === "Price" && (
          <div className={styles.modes}>
            {modes.map((m) => (
              <button key={m} onClick={() => setMode(m)} className={mode === m ? styles.modeActive : styles.mode}>
                {m === "TradingView" ? (
                  <Trans>TradingView</Trans>
                ) : m === "Original" ? (
                  <Trans>Original</Trans>
                ) : (
                  <Trans>Depth</Trans>
                )}
              </button>
            ))}
            <span className={styles.modesSep} />
            <button className={styles.iconBtnSm} aria-label="windowed">
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="3" width="10" height="10" rx="0.5" />
              </svg>
            </button>
            <button className={styles.iconBtnSm} aria-label="fullscreen">
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M10.5 3H13V5.5" />
                <path d="M5.5 13H3V10.5" />
                <path d="M13 10.5V13H10.5" />
                <path d="M3 5.5V3H5.5" />
              </svg>
            </button>
          </div>
        )}
      </div>
      {topTab === "Price" ? (
        <>
          <div className={styles.toolbar}>
            <div className={styles.tfs}>
              {tfs.map((t) => (
                <button key={t} onClick={() => setTf(t)} className={tf === t ? styles.tfActive : styles.tf}>
                  {t}
                </button>
              ))}
              <div className={styles.moreWrap} ref={moreRef}>
                <button
                  type="button"
                  className={cx(styles.moreBtn, {
                    [styles.moreBtnActive]: moreTfValues.includes(tf) || moreOpen,
                  })}
                  onClick={() => setMoreOpen((v) => !v)}
                  aria-haspopup="menu"
                  aria-expanded={moreOpen}
                >
                  {moreTfValues.includes(tf) ? MORE_TFS.find((o) => o.value === tf)!.label : <Trans>More</Trans>}
                  <span className={cx(styles.moreCaret, { [styles.moreCaretOpen]: moreOpen })}>
                    <svg width="8" height="8" viewBox="0 0 256 256" fill="currentColor">
                      <path d="M213.66,101.66l-80,80a8,8,0,0,1-11.32,0l-80-80A8,8,0,0,1,53.66,90.34L128,164.69l74.34-74.35a8,8,0,0,1,11.32,11.32Z" />
                    </svg>
                  </span>
                </button>
                {moreOpen && (
                  <div className={styles.moreMenu} role="menu">
                    {MORE_TFS.map((o) => (
                      <button
                        key={o.value}
                        type="button"
                        role="menuitem"
                        className={cx(styles.moreItem, { [styles.moreItemActive]: tf === o.value })}
                        onClick={() => {
                          setTf(o.value);
                          setMoreOpen(false);
                        }}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <span className={styles.sep} />
              <button
                type="button"
                className={styles.iconBtn}
                aria-label={t`Indicators`}
                title={t`Indicators`}
                onClick={handleOpenIndicators}
                disabled={!tvWidget}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor">
                  <g clipPath="url(#chart-panel-indicators-clip)">
                    <path d="M3.53271 6.79785H10.5327" strokeLinecap="round" strokeLinejoin="round" />
                    <path
                      d="M9.47949 10.0098L13.4795 14.0098M9.47949 14.0098L13.4795 10.0098"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M2.53271 12.2979H4.36334C4.83182 12.2979 5.28547 12.1335 5.64515 11.8334C6.00483 11.5332 6.24772 11.1163 6.33146 10.6554L7.73396 2.94035C7.81771 2.47941 8.0606 2.0625 8.42028 1.76233C8.77996 1.46216 9.23361 1.29777 9.70209 1.29785H11.5327"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </g>
                  <defs>
                    <clipPath id="chart-panel-indicators-clip">
                      <rect width="16" height="16" fill="white" />
                    </clipPath>
                  </defs>
                </svg>
              </button>
              <span className={styles.sep} />
              <div className={styles.moreWrap} ref={chartTypeRef}>
                <button
                  type="button"
                  className={styles.iconBtn}
                  aria-label={t`Chart type`}
                  title={t`Chart type`}
                  onClick={() => setChartTypeOpen((v) => !v)}
                  aria-haspopup="listbox"
                  aria-expanded={chartTypeOpen}
                  disabled={!tvWidget}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3.333 10.667V9.333M8 14v-1.333m4.667-4V7.333m-9.334-2V4M8 8.667V7.333m4.667-4V2m-8 3.733v3.2a.4.4 0 0 1-.4.4H2.4a.4.4 0 0 1-.4-.4v-3.2a.4.4 0 0 1 .4-.4h1.867a.4.4 0 0 1 .4.4Zm4.666 3.334v3.2a.4.4 0 0 1-.4.4H7.067a.4.4 0 0 1-.4-.4v-3.2a.4.4 0 0 1 .4-.4h1.866a.4.4 0 0 1 .4.4ZM14 3.733v3.2a.4.4 0 0 1-.4.4h-1.867a.4.4 0 0 1-.4-.4v-3.2a.4.4 0 0 1 .4-.4H13.6a.4.4 0 0 1 .4.4Z" />
                  </svg>
                </button>
                {chartTypeOpen && (
                  <div className={cx(styles.moreMenu, styles.chartTypeMenu)} role="listbox">
                    {chartTypeOptions.map((opt) => {
                      const selected = opt.value === chartType;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          role="option"
                          aria-selected={selected}
                          className={cx(styles.moreItem, styles.chartTypeItem, {
                            [styles.moreItemActive]: selected,
                          })}
                          onClick={() => handlePickChartType(opt.value)}
                        >
                          <span className={styles.chartTypeIcon} aria-hidden="true">
                            {opt.icon}
                          </span>
                          <span className={styles.chartTypeLabel}>{opt.label}</span>
                          {selected && (
                            <svg
                              className={styles.chartTypeCheck}
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden="true"
                            >
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <span className={styles.sep} />
              <div className={styles.moreWrap} ref={chartElementsRef}>
                <button
                  type="button"
                  className={cx(styles.tool, { [styles.moreBtnActive]: chartElementsOpen })}
                  onClick={() => setChartElementsOpen((v) => !v)}
                  aria-haspopup="menu"
                  aria-expanded={chartElementsOpen}
                  title={t`Chart Elements`}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M8 8H13.5M8 4H13.5M8 12H13.5" />
                    <path d="M2.5 4L3.5 5L5.5 3M2.5 8L3.5 9L5.5 7M2.5 12L3.5 13L5.5 11" />
                  </svg>
                  <Trans>Chart Elements</Trans>
                </button>
                {chartElementsOpen && (
                  <div
                    className={cx(styles.moreMenu, styles.chartElementsMenu)}
                    role="menu"
                    style={{ left: "auto", right: 0 }}
                  >
                    <button
                      type="button"
                      role="menuitemcheckbox"
                      aria-checked={markPriceLine}
                      className={cx(styles.moreItem, styles.chartElementsItem, {
                        [styles.moreItemActive]: markPriceLine,
                      })}
                      onClick={toggleMarkPriceLine}
                    >
                      <span className={styles.chartElementsLabel}>
                        <Trans>Mark Price Line</Trans>
                      </span>
                      {markPriceLine && (
                        <svg
                          className={styles.chartElementsCheck}
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </button>
                    <button
                      type="button"
                      role="menuitemcheckbox"
                      aria-checked={rawPrices}
                      className={cx(styles.moreItem, styles.chartElementsItem, {
                        [styles.moreItemActive]: rawPrices,
                      })}
                      onClick={toggleRawPrices}
                      title={t`Show last-trade price line`}
                    >
                      <span className={styles.chartElementsLabelWithIcon}>
                        <Trans>Raw Prices</Trans>
                        <svg
                          className={styles.chartElementsInfoIcon}
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <circle cx="12" cy="12" r="9" />
                          <path d="M12 16v-5" />
                          <circle cx="12" cy="8.5" r="0.5" fill="currentColor" />
                        </svg>
                      </span>
                      {rawPrices && (
                        <svg
                          className={styles.chartElementsCheck}
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className={styles.toolsRight}>
              <button className={styles.iconBtn} aria-label="screenshot">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M2 5h3l1.5-2h3L11 5h3v9H2z" />
                  <circle cx="8" cy="9" r="2.5" />
                </svg>
              </button>
            </div>
          </div>
          <div className={styles.chart}>
            <div
              className={cx(styles.chartLayer, {
                [styles.layerActive]: mode === "TradingView",
              })}
            >
              {mode === "TradingView" ? (
                <TVChart
                  extraDisabledFeatures={LIGHTER_TV_DISABLED}
                  removeEnabledFeatures={TV_ENABLED_FEATURES_TO_REMOVE}
                  extraOverrides={LIGHTER_TV_OVERRIDES}
                  brandName="Primit"
                  customCssUrl="/lighter-tv.css"
                  initialBarsCount={170}
                  forcedPeriod={tf}
                  onPeriodChange={setTf}
                  onWidgetReady={setTvWidget}
                />
              ) : null}
            </div>
            <div
              className={cx(styles.chartLayer, {
                [styles.layerActive]: mode === "Original",
              })}
            >
              {mode === "Original" ? <LighterOriginalChart timeframe={tf} /> : null}
            </div>
            <div
              className={cx(styles.chartLayer, {
                [styles.layerActive]: mode === "Depth",
              })}
            >
              {mode === "Depth" ? (
                <div className={styles.depthFrame} style={DEPTH_FRAME_STYLE}>
                  <LighterDepthChart />
                </div>
              ) : null}
            </div>
          </div>
        </>
      ) : topTab === "Funding" ? (
        <FundingPanel />
      ) : (
        <DetailsPanel />
      )}
    </div>
  );
}
