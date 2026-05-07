import { describe, expect, it } from "vitest";

import { FUNDING_RANGE_OPTIONS, getFundingMockViewModel } from "./fundingMock";

describe("fundingMock", () => {
  it("builds funding view models for all supported ranges", () => {
    const hour24 = getFundingMockViewModel("24H");
    const week1 = getFundingMockViewModel("1W");
    const month1 = getFundingMockViewModel("1M");

    expect(FUNDING_RANGE_OPTIONS).toEqual(["24H", "1W", "1M"]);

    expect(hour24.history.length).toBeGreaterThan(0);
    expect(week1.history.length).toBeGreaterThan(hour24.history.length);
    expect(month1.history.length).toBeGreaterThan(week1.history.length);

    expect(hour24.summary.interval).toBe("1h");
    expect(week1.summary.realtimeFundingRate).toMatch(/%$/);
    expect(month1.history.some((point) => point.rate > 0)).toBe(true);
    expect(month1.history.some((point) => point.rate < 0)).toBe(true);
  });
});
