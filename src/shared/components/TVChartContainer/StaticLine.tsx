import { useEffect, useRef } from "react";

import { LineStyle, StaticChartLine } from "./types";
import type { IChartingLibraryWidget, IPositionLineAdapter } from "../../charting_library";

const DEFAULT_LINE_COLOR = "#3a3e5e";

export function StaticLine({
  title,
  price,
  color,
  tvWidgetRef,
}: {
  tvWidgetRef: React.RefObject<IChartingLibraryWidget>;
} & StaticChartLine) {
  const lineApi = useRef<IPositionLineAdapter | undefined>(undefined);
  const lineColor = color || DEFAULT_LINE_COLOR;

  useEffect(() => {
    const chart = tvWidgetRef.current?.activeChart();
    if (!chart) {
      return;
    }

    chart.dataReady(() => {
      const range = chart.getVisibleRange();

      if (range.from === 0 && range.to === 0) {
        chart.onVisibleRangeChanged().subscribe(null, init, true);
      } else {
        init();
      }
    });

    function init() {
      const positionLine = chart!.createPositionLine({ disableUndo: true });

      lineApi.current = positionLine;

      return positionLine
        .setText(title)
        .setPrice(price)
        .setQuantity("")
        .setLineStyle(LineStyle.Dotted)
        .setLineLength(1)
        .setBodyFont(`normal 12pt "Relative", sans-serif`)
        .setBodyTextColor("#fff")
        .setLineColor(lineColor)
        .setBodyBackgroundColor(lineColor)
        .setBodyBorderColor(lineColor);
    }

    return () => {
      lineApi.current?.remove();
      lineApi.current = undefined;
    };
  }, [price, title, lineColor, tvWidgetRef]);

  return null;
}
