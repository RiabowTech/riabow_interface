/**
 * 点击 OrderBook 行时把 price 送到 Limit 下单表单的迷你 pub/sub:
 * - OrderBook Row 调 emitLimitPrice(price) 发布
 * - LimitOrderForm 订阅,onMount 时也能读到最新一次值(用户先点了 OrderBook 再切到限價 Tab 也能预填)
 * 故意不走 React Context,避免为一个瞬态信号开多一层 Provider、牵动组件树重渲染。
 */
type Listener = (price: number) => void;

let latestPrice: number | null = null;
const listeners = new Set<Listener>();

export function emitLimitPrice(price: number): void {
  if (!Number.isFinite(price) || price <= 0) return;
  latestPrice = price;
  for (const listener of listeners) {
    try {
      listener(price);
    } catch {
      // swallow to keep other subscribers alive
    }
  }
}

export function subscribeLimitPrice(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getLatestLimitPrice(): number | null {
  return latestPrice;
}
