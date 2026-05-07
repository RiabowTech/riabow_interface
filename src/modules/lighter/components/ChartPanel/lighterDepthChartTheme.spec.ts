import { describe, expect, it } from "vitest";

import { LIGHTER_DEPTH_CHART_THEME } from "./lighterDepthChartTheme";

describe("LIGHTER_DEPTH_CHART_THEME", () => {
  it("matches the reference depth chart palette and axis placement", () => {
    expect(LIGHTER_DEPTH_CHART_THEME.background).toBe("#1f1f24");
    expect(LIGHTER_DEPTH_CHART_THEME.grid).toBe("#2b2b30");
    expect(LIGHTER_DEPTH_CHART_THEME.bidStroke).toBe("#68ce8f");
    expect(LIGHTER_DEPTH_CHART_THEME.askStroke).toBe("#e74e54");
    expect(LIGHTER_DEPTH_CHART_THEME.yAxisOrientation).toBe("left");
    expect(LIGHTER_DEPTH_CHART_THEME.showMidPriceLabel).toBe(false);
    expect(LIGHTER_DEPTH_CHART_THEME.showMidPriceLine).toBe(false);
    expect(LIGHTER_DEPTH_CHART_THEME.outerPadding).toBe(12);
    expect(LIGHTER_DEPTH_CHART_THEME.chartMargin.left).toBe(12);
    expect(LIGHTER_DEPTH_CHART_THEME.chartMargin.right).toBe(12);
    expect(LIGHTER_DEPTH_CHART_THEME.chartMargin.top).toBe(12);
    expect(LIGHTER_DEPTH_CHART_THEME.chartMargin.bottom).toBe(12);
    expect(LIGHTER_DEPTH_CHART_THEME.hideZeroYAxisTick).toBe(true);
  });
});
