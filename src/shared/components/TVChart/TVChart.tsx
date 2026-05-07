import { useEffect, useMemo, useRef } from "react";

import { SUPPORTED_RESOLUTIONS_V2 } from "config/tradingview";
import { useChainId } from "lib/chains";
import { CHART_PERIODS } from "lib/legacy";
import { useLocalStorageSerializeKey } from "lib/localStorage";

import TVChartContainer from "components/TVChartContainer/TVChartContainer";

import { useTradeState } from "@/modules/lighter/store/TradeStateContext";

import type { TVChartLayout } from "components/TVChartContainer/TVChartContainer";
import type { CrossHairMovedEventParams, IChartingLibraryWidget } from "../../charting_library";

import "./TVChart.scss";

const DEFAULT_PERIOD = "5m";

function convertSymbolToChartSymbol(symbol: string) {
  return symbol.replace(/[-/]?USD[T]?$/i, "").replace(/[-/]$/, "");
}

export function TVChart({
  extraDisabledFeatures,
  removeEnabledFeatures,
  extraOverrides,
  studiesOverrides,
  onCrosshairMove,
  onLayoutChange,
  visiblePlotsSet,
  volumeMetric,
  createVolumeStudyOnReady,
  forcedPeriod,
  onPeriodChange,
  loadLastChart,
  disableAutoSave,
  chartName,
  brandName,
  customCssUrl,
  initialBarsCount,
  onWidgetReady,
}: {
  extraDisabledFeatures?: string[];
  removeEnabledFeatures?: string[];
  extraOverrides?: Record<string, any>;
  studiesOverrides?: Record<string, any>;
  onCrosshairMove?: (params: CrossHairMovedEventParams | null) => void;
  onLayoutChange?: (layout: TVChartLayout) => void;
  visiblePlotsSet?: "ohlcv" | "ohlc" | "c";
  volumeMetric?: "base" | "quote";
  createVolumeStudyOnReady?: boolean;
  forcedPeriod?: string;
  onPeriodChange?: (period: string) => void;
  loadLastChart?: boolean;
  disableAutoSave?: boolean;
  chartName?: string;
  brandName?: string;
  customCssUrl?: string;
  initialBarsCount?: number;
  onWidgetReady?: (widget: IChartingLibraryWidget | null) => void;
} = {}) {
  const { chainId } = useChainId();
  const { selectedSymbol } = useTradeState();
  let [period, setPeriod] = useLocalStorageSerializeKey([chainId, "Chart-period-v2"], DEFAULT_PERIOD);
  const chartTokenRef = useRef<{ symbol: string; minPrice: bigint; maxPrice: bigint }>({
    symbol: "",
    minPrice: 0n,
    maxPrice: 0n,
  });

  if (!period || !(period in CHART_PERIODS)) {
    period = DEFAULT_PERIOD;
  }

  const effectivePeriod = forcedPeriod && forcedPeriod in CHART_PERIODS ? forcedPeriod : period;
  const handlePeriodChange = onPeriodChange ?? setPeriod;
  const effectiveSymbol = useMemo(
    () => (selectedSymbol ? convertSymbolToChartSymbol(selectedSymbol) : ""),
    [selectedSymbol]
  );

  useEffect(() => {
    if (!period || !(period in CHART_PERIODS)) {
      setPeriod(DEFAULT_PERIOD);
    }
  }, [period, setPeriod]);

  const chartToken = useMemo(() => {
    if (chartTokenRef.current.symbol !== effectiveSymbol) {
      chartTokenRef.current = {
        symbol: effectiveSymbol,
        minPrice: 0n,
        maxPrice: 0n,
      };
    }

    return chartTokenRef.current;
  }, [effectiveSymbol]);

  if (!effectiveSymbol) {
    return null;
  }

  return (
    <div className="relative grow">
      <TVChartContainer
        chartLines={[]}
        chainId={chainId}
        period={effectivePeriod}
        setIsCandlesLoaded={undefined}
        visualMultiplier={1}
        setPeriod={handlePeriodChange}
        chartToken={chartToken}
        supportedResolutions={SUPPORTED_RESOLUTIONS_V2}
        extraDisabledFeatures={extraDisabledFeatures}
        removeEnabledFeatures={removeEnabledFeatures}
        extraOverrides={extraOverrides}
        studiesOverrides={studiesOverrides}
        onCrosshairMove={onCrosshairMove}
        onLayoutChange={onLayoutChange}
        visiblePlotsSet={visiblePlotsSet}
        volumeMetric={volumeMetric}
        createVolumeStudyOnReady={createVolumeStudyOnReady}
        loadLastChart={loadLastChart}
        disableAutoSave={disableAutoSave}
        chartName={chartName}
        brandName={brandName}
        customCssUrl={customCssUrl}
        initialBarsCount={initialBarsCount}
        onWidgetReady={onWidgetReady}
      />
    </div>
  );
}
