import { useEffect, useMemo, useRef, useState } from "react";

import { useApiTicker, usePrimitFundingRate, usePrimitMarkets } from "modules/lighter/api/hooks";
import { useChainId } from "lib/chains";
import { useTradeState } from "modules/lighter/store/TradeStateContext";

export type LighterMarketInfo = {
  symbol: string;
  leverage: number;
  markPrice: number | null;
  indexPrice: number | null;
  change24hPct: number | null;
  volume24hUsd: number | null;
  openInterestUsd: number | null;
  funding1hPct: number | null;
  nextFundingTs: number | null;
  /**
   * 最近一次 markPrice 数值变化的本地时间戳(ms)。
   * 消费方用它判定行情新鲜度 —— WS 断连超过阈值时应回退到后端 est_price,避免 USD↔token 换算失真。
   * null 表示尚未拿到过有效 markPrice。
   */
  markPriceReceivedAt: number | null;
};

function safeNumber(s: string | number | undefined | null): number | null {
  if (s == null) return null;
  const n = typeof s === "number" ? s : Number(s);
  return Number.isFinite(n) ? n : null;
}

function normalizeTimestamp(ts: number | null): number | null {
  if (ts == null) return null;
  return ts < 1e12 ? ts * 1000 : ts;
}

function normalizeApiMarketSymbol(symbol: string | null | undefined): string | null {
  if (!symbol) return null;
  const upper = symbol.toUpperCase().trim();

  if (upper.includes("-USD") || upper.includes("/USD")) {
    const base = upper.split(/-|\//)[0] ?? "";
    if (base.endsWith("USDT")) return base;
    if (base.endsWith("USD")) return base.replace(/USD$/, "USDT");
    return `${base}USDT`;
  }

  const cleaned = upper.replace(/[/-]/g, "");
  if (cleaned.endsWith("USDT")) return cleaned;
  if (cleaned.endsWith("USD")) return cleaned.replace(/USD$/, "USDT");
  return `${cleaned}USDT`;
}

export function useMarketInfoAdapter(): LighterMarketInfo {
  const { chainId } = useChainId();
  const { selectedSymbol } = useTradeState();
  const symbol = selectedSymbol?.split("-")[0] ?? "BTC";
  const { ticker } = useApiTicker(chainId, selectedSymbol ?? undefined);
  const { data: marketsData } = usePrimitMarkets(chainId);
  const { data: fundingRateData } = usePrimitFundingRate(chainId, selectedSymbol ?? undefined);

  const marketLeverage = useMemo(() => {
    if (!selectedSymbol || !marketsData?.markets?.length) return null;

    const normalizedSymbol = normalizeApiMarketSymbol(selectedSymbol);
    if (!normalizedSymbol) return null;
    const market = marketsData.markets.find((item) => item.symbol.toUpperCase() === normalizedSymbol);

    return market?.leverage ?? null;
  }, [marketsData, selectedSymbol]);

  const effectiveMarkPrice = safeNumber(ticker?.mark_price) ?? safeNumber(ticker?.last_price);
  const effectiveIndexPrice = safeNumber(ticker?.index_price) ?? safeNumber(ticker?.last_price);

  // 追踪 markPrice 最近一次"有效数值变化"的本地时间戳(ms)。
  // 只要数值本身变了就打戳 —— 引用变化但数值未变(SWR 回填、refetch 同值)不计入,避免虚假新鲜。
  const lastMarkPriceValueRef = useRef<number | null>(null);
  const [markPriceReceivedAt, setMarkPriceReceivedAt] = useState<number | null>(null);
  useEffect(() => {
    if (effectiveMarkPrice == null || !Number.isFinite(effectiveMarkPrice)) return;
    if (lastMarkPriceValueRef.current === effectiveMarkPrice) return;
    lastMarkPriceValueRef.current = effectiveMarkPrice;
    setMarkPriceReceivedAt(Date.now());
  }, [effectiveMarkPrice]);

  return useMemo(() => {
    const openInterestUsd = safeNumber(ticker?.open_interest);
    const perHour = safeNumber(fundingRateData?.funding_rate_per_hour);
    const tickerFundingRate = safeNumber(ticker?.funding_rate);
    const funding1hPct = perHour != null ? perHour * 100 : tickerFundingRate != null ? tickerFundingRate * 100 : null;

    const change24hPct = safeNumber(ticker?.price_change_percent_24h);
    const volume24hUsd = safeNumber(ticker?.volume_24h);
    const nextFundingTs = normalizeTimestamp(safeNumber(ticker?.next_funding_time));

    return {
      symbol: symbol ?? "BTC",
      leverage: marketLeverage ?? 10,
      markPrice: effectiveMarkPrice,
      indexPrice: effectiveIndexPrice,
      change24hPct,
      volume24hUsd,
      openInterestUsd,
      funding1hPct,
      nextFundingTs,
      markPriceReceivedAt,
    };
  }, [
    symbol,
    ticker,
    fundingRateData,
    marketLeverage,
    effectiveMarkPrice,
    effectiveIndexPrice,
    markPriceReceivedAt,
  ]);
}
