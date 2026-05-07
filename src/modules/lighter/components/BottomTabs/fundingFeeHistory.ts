import type { FundingFeeHistoryItem } from "modules/lighter/api/types";

function normalizeMarketSymbol(symbol: string) {
  const upper = symbol.toUpperCase();
  if (upper.endsWith("USDT")) return `${upper.slice(0, -4)}/USDT`;
  return upper;
}

function formatPercent(rate: string) {
  const value = Number(rate);
  if (!Number.isFinite(value)) return "-";
  return `${(value * 100).toFixed(4)}%`;
}

function formatUsd(value: string) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "-";
  return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPayment(value: string, asset: string) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return `- ${asset}`;
  return `${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${asset}`;
}

function formatTime(value: number) {
  return new Intl.DateTimeFormat(undefined, {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(value);
}

export type FundingFeeHistoryRow = {
  id: string;
  time: string;
  market: string;
  rate: string;
  position: string;
  size: string;
  payment: string;
  paymentValue: number;
};

export function formatFundingFeeHistoryRows(items: FundingFeeHistoryItem[]): FundingFeeHistoryRow[] {
  return items.map((item) => ({
    id: item.tranId,
    time: formatTime(item.time),
    market: normalizeMarketSymbol(item.symbol),
    rate: formatPercent(item.fundingRate),
    position: item.positionSide,
    size: formatUsd(item.positionSize),
    payment: formatPayment(item.fundingFee, item.asset),
    paymentValue: Number(item.fundingFee),
  }));
}
