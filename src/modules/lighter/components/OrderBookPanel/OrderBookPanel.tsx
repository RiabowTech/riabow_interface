import { Trans } from "@lingui/macro";
import { useEffect, useMemo, useRef, useState } from "react";

import { useApiOrderbook, useApiTrades } from "modules/lighter/api/hooks";
import { useTradeState } from "modules/lighter/store/TradeStateContext";
import { useChainId } from "lib/chains";
import { useTradesUpdates } from "modules/lighter/api";

import { computeOrderBookGroupOptions } from "../../adapters/orderBookAggregation";
import { useOrderBookAdapter, OrderBookLevel } from "../../adapters/useOrderBookAdapter";
import { emitLimitPrice } from "../../state/limitPriceBus";
import { filterTrades, TRADE_SIZE_FILTERS, type TradeSizeFilter } from "./tradeFilters";
import styles from "./OrderBookPanel.module.scss";

type Tab = "OrderBook" | "Trades";
type Mode = "all" | "asks" | "bids";
type Unit = "BTC" | "USD";
type GroupKey = string;
export type OrderBookLayout = "Tab" | "Stacked" | "Large";

const UNIT_OPTIONS: Unit[] = ["USD", "BTC"];
const LAYOUT_OPTIONS: OrderBookLayout[] = ["Tab", "Stacked", "Large"];

function DropdownMenu<T extends string>({
  open,
  options,
  value,
  onSelect,
  className,
}: {
  open: boolean;
  options: readonly T[];
  value: T;
  onSelect: (v: T) => void;
  className?: string;
}) {
  if (!open) return null;
  return (
    <div className={`${styles.menu} ${className ?? ""}`.trim()}>
      {options.map((opt) => (
        <button key={opt} className={styles.menuItem} onClick={() => onSelect(opt)}>
          <span>{opt}</span>
          {opt === value && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </button>
      ))}
    </div>
  );
}

function Row({
  level,
  side,
  maxTotal,
  unit,
}: {
  level: OrderBookLevel;
  side: "ask" | "bid";
  maxTotal: number;
  unit: Unit;
}) {
  const isEmpty = level.price <= 0 || level.size <= 0;
  const displaySize = unit === "USD" ? level.quoteSize : level.size;
  const displayTotal = unit === "USD" ? level.quoteTotal : level.total;

  // 两层深度条共用一个分母(maxTotal * 1.6),保证内层单档条永远被外层累计条包住,
  // 不会出现单档 size 接近全书最大时,深色内条盖过浅色外条看起来像闪烁撮合的假象。
  // cumulative total >= single size 恒成立,所以 sizePct <= totalPct。
  const denom = maxTotal * 1.6;
  const totalPct = !isEmpty && denom > 0 ? Math.min(100, (displayTotal / denom) * 100) : 0;
  const sizePct = !isEmpty && denom > 0 ? Math.min(100, (displaySize / denom) * 100) : 0;
  const priceCls = side === "ask" ? "ltr-down" : "ltr-up";
  // 点击行把价格广播给限價下单表单(空行不响应)。用 div+role 而非 button,
  // 不改现有 grid 布局;不 preventDefault,不影响其他点击穿透(目前只有深度条)。
  const handleClick = isEmpty
    ? undefined
    : () => {
        emitLimitPrice(level.price);
      };
  return (
    <div
      className={`${styles.row} ${isEmpty ? styles.rowEmpty : styles.rowClickable}`}
      onClick={handleClick}
      role={isEmpty ? undefined : "button"}
      tabIndex={isEmpty ? undefined : 0}
      onKeyDown={
        isEmpty
          ? undefined
          : (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                emitLimitPrice(level.price);
              }
            }
      }
    >
      <div className={side === "ask" ? styles.depthTotalAsk : styles.depthTotalBid} style={{ width: `${totalPct}%` }} />
      <div className={side === "ask" ? styles.depthSizeAsk : styles.depthSizeBid} style={{ width: `${sizePct}%` }} />
      <div className={`${styles.price} ${priceCls} ltr-mono`}>{isEmpty ? "" : level.price.toLocaleString()}</div>
      <div className={`${styles.size} ltr-mono`}>{isEmpty ? "" : formatOrderBookValue(displaySize, unit)}</div>
      <div className={`${styles.total} ltr-mono`}>{isEmpty ? "" : formatOrderBookValue(displayTotal, unit)}</div>
    </div>
  );
}

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

function formatTradeTime(timestamp: number | string): string {
  const ms = typeof timestamp === "number" ? (timestamp < 1e12 ? timestamp * 1000 : timestamp) : Date.parse(timestamp);
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return "--:--:--";
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function formatOrderBookValue(value: number, unit: Unit): string {
  if (!Number.isFinite(value) || value <= 0) return "--";

  if (unit === "BTC") {
    return value.toFixed(5);
  }

  return value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function padOrderBookLevels(levels: OrderBookLevel[], targetCount: number): OrderBookLevel[] {
  const padded = [...levels];
  while (padded.length < targetCount) {
    padded.push({
      price: 0,
      size: 0,
      total: 0,
      quoteSize: 0,
      quoteTotal: 0,
    });
  }
  return padded.slice(0, targetCount);
}

function formatSpreadValue(value: number): string {
  if (!Number.isFinite(value) || value < 0) return "--";

  if (Number.isInteger(value)) {
    return value.toLocaleString("en-US");
  }

  return value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 6,
  });
}

export function OrderBookPanel({
  layout,
  onLayoutChange,
}: {
  layout: OrderBookLayout;
  onLayoutChange: (layout: OrderBookLayout) => void;
}) {
  const { chainId } = useChainId();
  const { selectedSymbol } = useTradeState();
  const [tab, setTab] = useState<Tab>("OrderBook");
  const [orderBookMode, setOrderBookMode] = useState<Mode>("all");
  const [tradesMode, setTradesMode] = useState<Mode>("all");
  const [unit, setUnit] = useState<Unit>("USD");
  const [group, setGroup] = useState<GroupKey>("1");
  const [tradeSizeFilter, setTradeSizeFilter] = useState<TradeSizeFilter>("All");
  const [openMenu, setOpenMenu] = useState<"unit" | "group" | "layout" | "tradeSize" | null>(null);
  const prevGroupOptionsKeyRef = useRef("");
  const { orderbook } = useApiOrderbook(chainId, selectedSymbol ?? undefined, {
    refreshInterval: 0,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });
  const { trades } = useApiTrades(chainId, selectedSymbol ?? undefined, {
    refreshInterval: 0,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });
  const { lastTrade } = useTradesUpdates(chainId, selectedSymbol ?? undefined);
  const [lastTrades, setLastTrades] = useState<
    Array<{ id: string; price: string; amount: string; side: "buy" | "sell"; timestamp: number | string }>
  >([]);
  const groupOptions = useMemo(() => computeOrderBookGroupOptions(orderbook), [orderbook]);
  const rootRef = useRef<HTMLDivElement>(null);
  const [panelHeight, setPanelHeight] = useState(608);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    setPanelHeight(el.getBoundingClientRect().height);
    if (typeof ResizeObserver === "undefined") return;
    const ob = new ResizeObserver((entries) => {
      for (const e of entries) setPanelHeight(e.contentRect.height);
    });
    ob.observe(el);
    return () => ob.disconnect();
  }, []);

  useEffect(() => {
    if (!openMenu) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!rootRef.current?.contains(target)) setOpenMenu(null);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [openMenu]);

  useEffect(() => {
    const key = groupOptions.join(",");
    if (key !== prevGroupOptionsKeyRef.current) {
      prevGroupOptionsKeyRef.current = key;
      setGroup(groupOptions[0] ?? "0.01");
      return;
    }

    if (!groupOptions.includes(group)) {
      setGroup(groupOptions[0] ?? "0.01");
    }
  }, [group, groupOptions]);

  const ob = useOrderBookAdapter(group);
  useEffect(() => {
    setLastTrades(trades?.trades ?? []);
  }, [selectedSymbol, trades?.trades]);

  useEffect(() => {
    if (!lastTrade) return;

    const id =
      lastTrade.id ??
      `${selectedSymbol ?? "UNKNOWN"}:${lastTrade.timestamp}:${lastTrade.price}:${lastTrade.amount}:${lastTrade.side}`;

    setLastTrades((prev) => {
      if (prev.some((trade) => trade.id === id)) {
        return prev;
      }

      return [{ ...lastTrade, id }, ...prev].slice(0, 50);
    });
  }, [lastTrade, selectedSymbol]);

  const tradeRows = useMemo(
    () =>
      lastTrades
        .map((trade) => ({
          time: formatTradeTime(trade.timestamp),
          size: Number(trade.amount) || 0,
          price: Number(trade.price) || 0,
          side: trade.side === "buy" ? "buy" : "sell",
          timestamp: typeof trade.timestamp === "number" ? trade.timestamp : Date.parse(trade.timestamp),
        }))
        .filter((trade) => trade.size > 0 && trade.price > 0)
        .sort((a, b) => {
          const left = Number.isFinite(a.timestamp) ? a.timestamp : 0;
          const right = Number.isFinite(b.timestamp) ? b.timestamp : 0;
          return right - left;
        })
        .map(({ timestamp: _timestamp, ...trade }) => trade),
    [lastTrades]
  );

  const filteredTrades =
    tab === "Trades"
      ? filterTrades(tradeRows, tradesMode, "All", tradeSizeFilter)
      : tradeRows.filter((t) => {
          if (tradesMode === "asks") return t.side === "sell";
          if (tradesMode === "bids") return t.side === "buy";
          return true;
        });
  const maxAskTotal = Math.max(0, ...ob.asks.map((l) => (unit === "USD" ? l.quoteTotal : l.total)));
  const maxBidTotal = Math.max(0, ...ob.bids.map((l) => (unit === "USD" ? l.quoteTotal : l.total)));
  // 从容器高度动态计算可容纳的行数,使 asks/bids 铺满面板(不滚动)
  // 布局消耗:tabs 32 + subbar 32 + header 28 + spread(all only) 28,每行 20px
  const ROW_H = 20;
  const OVERHEAD_SINGLE = 32 + 32 + 28;
  const OVERHEAD_ALL = OVERHEAD_SINGLE + 28; // 加 spread 行
  const effectivePanelHeight = layout === "Stacked" ? Math.max(220, Math.floor((panelHeight - 4) / 2)) : panelHeight;

  const totalRows =
    orderBookMode === "all"
      ? Math.max(6, Math.floor((effectivePanelHeight - OVERHEAD_ALL) / ROW_H))
      : Math.max(10, Math.floor((effectivePanelHeight - OVERHEAD_SINGLE) / ROW_H));
  const halfRows = Math.floor(totalRows / 2);
  const askCount = orderBookMode === "all" ? halfRows : totalRows;
  const bidCount = orderBookMode === "all" ? totalRows - halfRows : totalRows;
  // 生成最终渲染数组(top→bottom),空行置于正确位置以填满面板:
  // - asks-only: [far..best, empty_at_bottom]
  // - bids-only: [best..far, empty_at_bottom]
  // - all asks:  [empty_at_top, far..best]  (empty 远离 spread)
  // - all bids:  [best..far, empty_at_bottom](empty 远离 spread)
  const emptyRow: OrderBookLevel = { price: 0, size: 0, total: 0, quoteSize: 0, quoteTotal: 0 };
  const askRows = useMemo(() => {
    const desc = [...ob.asks].slice(0, askCount).reverse(); // 降序(高→低)
    const pad = Math.max(0, askCount - desc.length);
    const empties = Array.from({ length: pad }, () => emptyRow);
    return orderBookMode === "all" ? [...empties, ...desc] : [...desc, ...empties];
  }, [askCount, orderBookMode, ob.asks]);
  const bidRows = useMemo(() => {
    const desc = ob.bids.slice(0, bidCount); // bids 已降序(高→低)
    const pad = Math.max(0, bidCount - desc.length);
    const empties = Array.from({ length: pad }, () => emptyRow);
    return [...desc, ...empties];
  }, [bidCount, ob.bids]);

  const renderModeButtons = (mode: Mode, onChange: (mode: Mode) => void) => (
    <div className={styles.modeBtns}>
      <button
        className={`${styles.modeBtn} ${mode === "all" ? styles.modeActive : ""}`}
        aria-label="all"
        onClick={() => onChange("all")}
      >
        <span className={styles.modeIcon}>
          <svg viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="12" height="5" rx="1" fill="#FF384F" />
            <rect y="7" width="12" height="5" rx="1" fill="#1BD289" />
          </svg>
        </span>
      </button>
      <button
        className={`${styles.modeBtn} ${mode === "asks" ? styles.modeActive : ""}`}
        aria-label="asks"
        onClick={() => onChange("asks")}
      >
        <span className={styles.modeIcon}>
          <svg viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="12" height="5" rx="1" fill="#FF384F" />
            <rect y="7" width="12" height="5" rx="1" fill="#FF384F" />
          </svg>
        </span>
      </button>
      <button
        className={`${styles.modeBtn} ${mode === "bids" ? styles.modeActive : ""}`}
        aria-label="bids"
        onClick={() => onChange("bids")}
      >
        <span className={styles.modeIcon}>
          <svg viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="12" height="5" rx="1" fill="#1BD289" />
            <rect y="7" width="12" height="5" rx="1" fill="#1BD289" />
          </svg>
        </span>
      </button>
    </div>
  );

  const renderOrderBookControls = () => (
    <>
      <div className={styles.selWrap}>
        <button className={styles.subSel} onClick={() => setOpenMenu(openMenu === "unit" ? null : "unit")}>
          {unit}
          <svg
            className={`${styles.caretSvg} ${openMenu === "unit" ? styles.caretOpen : ""}`}
            width="10"
            height="10"
            viewBox="0 0 256 256"
            fill="currentColor"
          >
            <path d="M213.66,101.66l-80,80a8,8,0,0,1-11.32,0l-80-80A8,8,0,0,1,53.66,90.34L128,164.69l74.34-74.35a8,8,0,0,1,11.32,11.32Z" />
          </svg>
        </button>
        <DropdownMenu
          open={openMenu === "unit"}
          options={UNIT_OPTIONS}
          value={unit}
          onSelect={(v) => {
            setUnit(v);
            setOpenMenu(null);
          }}
        />
      </div>
      <div className={styles.selWrap}>
        <button className={styles.subSel} onClick={() => setOpenMenu(openMenu === "group" ? null : "group")}>
          {group}
          <svg
            className={`${styles.caretSvg} ${openMenu === "group" ? styles.caretOpen : ""}`}
            width="10"
            height="10"
            viewBox="0 0 256 256"
            fill="currentColor"
          >
            <path d="M213.66,101.66l-80,80a8,8,0,0,1-11.32,0l-80-80A8,8,0,0,1,53.66,90.34L128,164.69l74.34-74.35a8,8,0,0,1,11.32,11.32Z" />
          </svg>
        </button>
        <DropdownMenu
          open={openMenu === "group"}
          options={groupOptions}
          value={group}
          onSelect={(v) => {
            setGroup(v);
            setOpenMenu(null);
          }}
        />
      </div>
    </>
  );

  const renderTradesControls = () => (
    <div className={styles.selWrap}>
      <button className={styles.subSel} onClick={() => setOpenMenu(openMenu === "tradeSize" ? null : "tradeSize")}>
        {tradeSizeFilter}
        <svg
          className={`${styles.caretSvg} ${openMenu === "tradeSize" ? styles.caretOpen : ""}`}
          width="10"
          height="10"
          viewBox="0 0 256 256"
          fill="currentColor"
        >
          <path d="M213.66,101.66l-80,80a8,8,0,0,1-11.32,0l-80-80A8,8,0,0,1,53.66,90.34L128,164.69l74.34-74.35a8,8,0,0,1,11.32,11.32Z" />
        </svg>
      </button>
      <DropdownMenu
        open={openMenu === "tradeSize"}
        options={TRADE_SIZE_FILTERS}
        value={tradeSizeFilter}
        className={styles.tradeMenu}
        onSelect={(value) => {
          setTradeSizeFilter(value);
          setOpenMenu(null);
        }}
      />
    </div>
  );

  const renderLayoutButton = () => (
    <div className={styles.menuWrap}>
      <button
        className={styles.menuBtn}
        aria-label="Change order book and trades layout"
        onClick={() => setOpenMenu(openMenu === "layout" ? null : "layout")}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <circle cx="12" cy="5" r="1" />
          <circle cx="12" cy="12" r="1" />
          <circle cx="12" cy="19" r="1" />
        </svg>
      </button>
      <DropdownMenu
        open={openMenu === "layout"}
        options={LAYOUT_OPTIONS}
        value={layout}
        onSelect={(v) => {
          onLayoutChange(v);
          setOpenMenu(null);
        }}
      />
    </div>
  );

  const renderOrderBookBody = () => (
    <>
      <div className={styles.header}>
        <div>
          <Trans>Price</Trans>
        </div>
        <div>
          <Trans>Size</Trans> <span className={styles.unitBadge}>{unit}</span>
        </div>
        <div>
          <Trans>Total</Trans>
        </div>
      </div>
      {orderBookMode !== "bids" && (
        <div className={styles.asks}>
          {askRows.map((l, i) => (
            <Row key={`a${i}`} level={l} side="ask" maxTotal={maxAskTotal} unit={unit} />
          ))}
        </div>
      )}
      {orderBookMode === "all" && (
        <div className={styles.spreadRow}>
          <span className="ltr-mono">{formatSpreadValue(ob.spread)}</span>
          <span className={styles.spreadLabel}>
            <Trans>Spread</Trans>
          </span>
          <span className="ltr-mono">{ob.spreadPct.toFixed(3)}%</span>
        </div>
      )}
      {orderBookMode !== "asks" && (
        <div className={styles.bids}>
          {bidRows.map((l, i) => (
            <Row key={`b${i}`} level={l} side="bid" maxTotal={maxBidTotal} unit={unit} />
          ))}
        </div>
      )}
    </>
  );

  const renderTradesBody = () => (
    <>
      <div className={styles.tradesHeader}>
        <div>
          <Trans>Time</Trans>
        </div>
        <div>
          <Trans>Size</Trans> <span className={styles.unitBadge}>{unit}</span>
        </div>
        <div>
          <Trans>Price</Trans>
        </div>
      </div>
      <div className={styles.tradesList}>
        {filteredTrades.map((t, i) => (
          <div key={i} className={`${styles.tradeRow} ${t.side === "buy" ? styles.tradeBuy : styles.tradeSell}`}>
            <div className={styles.tradeTime}>{t.time}</div>
            <div className={`${styles.tradeSize} ${t.side === "buy" ? "ltr-up" : "ltr-down"} ltr-mono`}>
              {t.size.toFixed(5)}
            </div>
            <div className={`${styles.tradePrice} ltr-mono`}>{t.price.toLocaleString()}</div>
          </div>
        ))}
      </div>
    </>
  );

  const renderSection = (kind: "OrderBook" | "Trades", withLayoutButton: boolean, className?: string) => (
    <section className={`${styles.section} ${className ?? ""}`.trim()}>
      <div className={styles.sectionHeader}>
        <div className={styles.sectionTitlePlain}>
          {kind === "OrderBook" ? <Trans>Order Book</Trans> : <Trans>Trades</Trans>}
        </div>
        <div className={styles.sectionHeaderActions}>
          {withLayoutButton ? renderLayoutButton() : <div className={styles.sectionHeaderSpacer} />}
        </div>
      </div>
      <div className={styles.subbar}>
        {kind === "OrderBook"
          ? renderModeButtons(orderBookMode, setOrderBookMode)
          : renderModeButtons(tradesMode, setTradesMode)}
        <div className={styles.subRight}>
          {kind === "OrderBook" ? renderOrderBookControls() : renderTradesControls()}
        </div>
      </div>
      {kind === "OrderBook" ? renderOrderBookBody() : renderTradesBody()}
    </section>
  );

  return (
    <div className={styles.root} ref={rootRef}>
      {layout === "Tab" ? (
        <>
          <div className={styles.tabs}>
            <button onClick={() => setTab("OrderBook")} className={tab === "OrderBook" ? styles.tabActive : styles.tab}>
              <Trans>Order Book</Trans>
            </button>
            <button onClick={() => setTab("Trades")} className={tab === "Trades" ? styles.tabActive : styles.tab}>
              <Trans>Trades</Trans>
            </button>
            {renderLayoutButton()}
          </div>
          <div className={styles.subbar}>
            {tab === "Trades"
              ? renderModeButtons(tradesMode, setTradesMode)
              : renderModeButtons(orderBookMode, setOrderBookMode)}
            <div className={styles.subRight}>
              {tab === "OrderBook" ? renderOrderBookControls() : renderTradesControls()}
            </div>
          </div>
          <div className={styles.tabMain}>
            {tab === "OrderBook" ? (
              <>
                {renderOrderBookBody()}
                <div className={styles.tabMainSpacer} aria-hidden />
              </>
            ) : (
              renderTradesBody()
            )}
          </div>
        </>
      ) : layout === "Stacked" ? (
        <div className={styles.stackedLayout}>
          {renderSection("OrderBook", true, styles.stackedSection)}
          {renderSection("Trades", false, styles.stackedSection)}
        </div>
      ) : (
        <div className={styles.largeLayout}>
          {renderSection("OrderBook", false)}
          {renderSection("Trades", true)}
        </div>
      )}
    </div>
  );
}
