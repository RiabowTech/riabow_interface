import { describe, expect, it } from "vitest";

import { convertAmountValue, formatAmountValue } from "./modifyOrderAmount";

describe("modifyOrderAmount", () => {
  it("converts symbol amount to usd size", () => {
    expect(convertAmountValue("0.00057143", "symbol", "usd", "70000")).toBe("40.0001");
  });

  it("converts usd size to symbol amount", () => {
    expect(convertAmountValue("40.0001", "usd", "symbol", "70000")).toBe("0.00057143");
  });

  it("keeps original value when price is invalid", () => {
    expect(convertAmountValue("125", "symbol", "usd", "")).toBe("125");
  });

  it("formats decimal values without trailing zeroes", () => {
    expect(formatAmountValue("125.500000000000000000")).toBe("125.5");
  });
});
