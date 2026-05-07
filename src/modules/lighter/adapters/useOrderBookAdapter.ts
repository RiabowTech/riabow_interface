import { useEffect, useMemo, useState } from "react";

import { useChainId } from "lib/chains";
import { useApiOrderbook } from "modules/lighter/api/hooks";
import { getWebSocketService, normalizeMarketSymbolToApiFormat } from "modules/lighter/api/custom/websocket";
import { useTradeState } from "modules/lighter/store/TradeStateContext";
import type { Orderbook } from "modules/lighter/api/types";

import { aggregateOrderBookLevels, parseOrderBookGroupTick } from "./orderBookAggregation";

export type OrderBookLevel = {
  price: number;
  size: number;
  total: number;
  quoteSize: number;
  quoteTotal: number;
};
export type OrderBookData = {
  asks: OrderBookLevel[];
  bids: OrderBookLevel[];
  spread: number;
  spreadPct: number;
  tickSize: number;
};

const EMPTY: OrderBookData = { asks: [], bids: [], spread: 0, spreadPct: 0, tickSize: 0.1 };

/**
 * 把 API [price, size] 累计成 { price, size, total }:
 * - asks: 价格升序,cumulative 从 best ask 外扩
 * - bids: 价格降序,cumulative 从 best bid 外扩
 *
 * 数据源:
 * - REST (useApiOrderbook) 给初始快照 + WS 断开时的兜底
 * - WS (getWebSocketService + subscribeOrderbook) 订阅后每 tick 覆盖本地快照
 * WS 可用则优先走 WS(延迟更低,避免轮询抖动);WS 没连上时回退 REST。
 */
export function useOrderBookAdapter(group?: string): OrderBookData {
  const { chainId } = useChainId();
  const { selectedSymbol } = useTradeState();
  const { orderbook: restOrderbook } = useApiOrderbook(chainId, selectedSymbol ?? undefined);
  const [wsOrderbook, setWsOrderbook] = useState<Orderbook | null>(null);

  // 切 market 时清掉上一只币的 WS 快照,避免短暂串数据。
  useEffect(() => {
    setWsOrderbook(null);
  }, [selectedSymbol]);

  useEffect(() => {
    if (!chainId || !selectedSymbol) return undefined;
    const ws = getWebSocketService(chainId);
    ws.connect();
    ws.subscribeOrderbook(selectedSymbol);

    const expectedSymbol = normalizeMarketSymbolToApiFormat(selectedSymbol);
    const unsub = ws.onOrderbookUpdate((update) => {
      // WS 是广播式,过滤掉别的 market 的 tick(多页签/快速切换会短暂收到旧订阅消息)。
      if (update.symbol !== expectedSymbol) return;
      const bids = (update.bids || []).map((lvl) => [lvl.price, lvl.size] as [string, string]);
      const asks = (update.asks || []).map((lvl) => [lvl.price, lvl.size] as [string, string]);
      setWsOrderbook({
        symbol: update.symbol,
        bids,
        asks,
        timestamp: update.timestamp ?? Date.now(),
      });
    });

    return () => {
      unsub();
      ws.unsubscribeOrderbook(selectedSymbol);
    };
  }, [chainId, selectedSymbol]);

  const orderbook = wsOrderbook ?? restOrderbook;

  return useMemo(() => {
    if (!orderbook || (!orderbook.asks?.length && !orderbook.bids?.length)) return EMPTY;

    const tickSize = parseOrderBookGroupTick(group);
    const asks = aggregateOrderBookLevels(orderbook.asks, "ask", tickSize);
    const bids = aggregateOrderBookLevels(orderbook.bids, "bid", tickSize);
    if (!asks.length || !bids.length) return EMPTY;

    const spread = asks[0].price - bids[0].price;
    const mid = (asks[0].price + bids[0].price) / 2;
    const spreadPct = mid > 0 ? (spread / mid) * 100 : 0;

    return { asks, bids, spread, spreadPct, tickSize };
  }, [group, orderbook]);
}
