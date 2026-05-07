import BigNumber from "bignumber.js";

export type AmountUnit = "symbol" | "usd";

function trimTrailingZeroes(value: string) {
  return value.replace(/(\.\d*?[1-9])0+$/u, "$1").replace(/\.0+$/u, "").replace(/\.$/u, "");
}

export function formatAmountValue(value: BigNumber.Value, maxDecimals = 18) {
  if (value === "") return "";

  const bn = new BigNumber(value);
  if (!bn.isFinite()) return "";

  const decimals = Math.min(Math.max(bn.decimalPlaces() ?? 0, 0), maxDecimals);
  return trimTrailingZeroes(bn.toFixed(decimals));
}

export function convertAmountValue(value: string, fromUnit: AmountUnit, toUnit: AmountUnit, price: string) {
  if (!value || fromUnit === toUnit) return value;

  const amountBn = new BigNumber(value);
  const priceBn = new BigNumber(price);

  if (!amountBn.isFinite() || !priceBn.isFinite() || priceBn.lte(0)) {
    return value;
  }

  const converted = fromUnit === "symbol" ? amountBn.times(priceBn) : amountBn.div(priceBn);
  return formatAmountValue(converted);
}
