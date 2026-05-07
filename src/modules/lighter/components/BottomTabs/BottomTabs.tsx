import { Trans, t } from "@lingui/macro";
import { useLingui } from "@lingui/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import TokenIcon from "components/TokenIcon/TokenIcon";

import { AssetsTab } from "./AssetsTab";
import styles from "./BottomTabs.module.scss";
import { FundingHistoryTab } from "./FundingHistoryTab";
import { OpenOrdersTab } from "./OpenOrdersTab";
import { OrderHistoryTab } from "./OrderHistoryTab";
import { PositionsTab } from "./PositionsTab";
import { TradeHistoryTab } from "./TradeHistoryTab";
import { useAssetsAdapter } from "../../adapters/useAssetsAdapter";
import { useOpenOrdersAdapter } from "../../adapters/useOpenOrdersAdapter";
import { useOrderHistoryAdapter } from "../../adapters/useOrderHistoryAdapter";
import { usePositionsAdapter } from "../../adapters/usePositionsAdapter";
import { useTradeHistoryAdapterState } from "../../adapters/useTradeHistoryAdapter";
import type { LighterTradeHistoryRow } from "../../adapters/useTradeHistoryAdapter";

type Tab = "Positions" | "Assets" | "Open Orders" | "Order History" | "Trade History" | "Funding History";
export type BottomTabFilterMode = "all" | "asks" | "bids";
export type OpenOrdersMarketFilter = "All" | string;
export type OpenOrdersTypeFilter = "All" | "Market" | "Limit" | "S/L Market" | "S/L Limit" | "T/P Market" | "T/P Limit";
export type TradeHistoryTypeFilter = "All" | "Trade" | "Liquidation" | "Deleverage" | "Market Settlement";

function MarketFilterIcon() {
  return (
    <span className={styles.filterSvgIcon}>
      <svg viewBox="0 0 21 22" fill="none" xmlns="http://www.w3.org/2000/svg">
        <g>
          <path
            d="M7.875 10.3438C11.4994 10.3438 14.4375 9.02159 14.4375 7.39062C14.4375 5.75966 11.4994 4.4375 7.875 4.4375C4.25063 4.4375 1.3125 5.75966 1.3125 7.39062C1.3125 9.02159 4.25063 10.3438 7.875 10.3438Z"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M1.3125 7.39062V10.6719C1.3125 12.3027 4.25086 13.625 7.875 13.625C11.4991 13.625 14.4375 12.3027 14.4375 10.6719V7.39062"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M5.25 10.0977V13.3789" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
          <path
            d="M14.4375 8.43408C17.4333 8.70807 19.6875 9.89916 19.6875 11.3281C19.6875 12.9589 16.7491 14.2813 13.125 14.2813C11.5172 14.2813 10.0439 14.0212 8.90283 13.5889"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M6.5625 13.5659V14.6094C6.5625 16.2402 9.50086 17.5625 13.125 17.5625C16.7491 17.5625 19.6875 16.2402 19.6875 14.6094V11.3281"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M15.75 14.0352V17.3164" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M10.5 10.0977V17.3164" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </svg>
    </span>
  );
}

function TypeFilterIcon() {
  return (
    <span className={styles.filterSvgIcon}>
      <svg viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
        <g clipPath="url(#openOrdersTypeFilterClip)">
          <path
            d="M3.46274 3.4624L1.29858 9.95486H5.62689L3.46274 3.4624Z"
            stroke="currentColor"
            strokeWidth="0.865661"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M8.44014 6.49209C9.75489 6.49209 10.8207 5.42628 10.8207 4.11153C10.8207 2.79677 9.75489 1.73096 8.44014 1.73096C7.12539 1.73096 6.05957 2.79677 6.05957 4.11153C6.05957 5.42628 7.12539 6.49209 8.44014 6.49209Z"
            stroke="currentColor"
            strokeWidth="0.865661"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M12.1193 8.22363H7.35815V11.2534H12.1193V8.22363Z"
            stroke="currentColor"
            strokeWidth="0.865661"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
        <defs>
          <clipPath id="openOrdersTypeFilterClip">
            <rect width="13.8506" height="13.8506" fill="white" />
          </clipPath>
        </defs>
      </svg>
    </span>
  );
}

function SearchIcon() {
  return (
    <span className={styles.marketSearchIcon}>
      <svg viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path d="M14.3519 13.6464L11.2226 10.5176C12.1296 9.42871 12.5819 8.03201 12.4853 6.6181C12.3888 5.20419 11.7509 3.88193 10.7043 2.92638C9.65768 1.97082 8.28297 1.45555 6.86613 1.48775C5.4493 1.51995 4.09942 2.09714 3.0973 3.09926C2.09519 4.10137 1.518 5.45125 1.4858 6.86808C1.4536 8.28492 1.96887 9.65963 2.92442 10.7062C3.87997 11.7528 5.20224 12.3908 6.61615 12.4873C8.03006 12.5838 9.42676 12.1315 10.5157 11.2245L13.6444 14.3539C13.6909 14.4003 13.746 14.4372 13.8067 14.4623C13.8674 14.4875 13.9325 14.5004 13.9982 14.5004C14.0639 14.5004 14.1289 14.4875 14.1896 14.4623C14.2503 14.4372 14.3055 14.4003 14.3519 14.3539C14.3984 14.3074 14.4352 14.2523 14.4604 14.1916C14.4855 14.1309 14.4985 14.0658 14.4985 14.0001C14.4985 13.9344 14.4855 13.8694 14.4604 13.8087C14.4352 13.748 14.3984 13.6928 14.3519 13.6464ZM2.49819 7.00014C2.49819 6.11013 2.76211 5.2401 3.25658 4.50008C3.75104 3.76006 4.45385 3.18328 5.27611 2.84268C6.09838 2.50209 7.00318 2.41298 7.8761 2.58661C8.74901 2.76024 9.55083 3.18883 10.1802 3.81816C10.8095 4.4475 11.2381 5.24932 11.4117 6.12224C11.5854 6.99515 11.4962 7.89995 11.1556 8.72222C10.8151 9.54449 10.2383 10.2473 9.49826 10.7418C8.75824 11.2362 7.88821 11.5001 6.99819 11.5001C5.80512 11.4988 4.6613 11.0243 3.81767 10.1807C2.97404 9.33704 2.49951 8.19321 2.49819 7.00014Z" />
      </svg>
    </span>
  );
}

function CaretDownIcon({ open = false }: { open?: boolean }) {
  return (
    <span className={`${styles.filterCaret} ${open ? styles.filterCaretOpen : ""}`}>
      <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 256 256">
        <path d="M213.66,101.66l-80,80a8,8,0,0,1-11.32,0l-80-80A8,8,0,0,1,53.66,90.34L128,164.69l74.34-74.35a8,8,0,0,1,11.32,11.32Z" />
      </svg>
    </span>
  );
}

function FilterModeButtons({
  mode,
  onChange,
}: {
  mode: BottomTabFilterMode;
  onChange: (mode: BottomTabFilterMode) => void;
}) {
  return (
    <div className={styles.modeBtns}>
      <button
        type="button"
        aria-label="all"
        className={`${styles.modeBtn} ${mode === "all" ? styles.modeActive : ""}`}
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
        type="button"
        aria-label="asks"
        className={`${styles.modeBtn} ${mode === "asks" ? styles.modeActive : ""}`}
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
        type="button"
        aria-label="bids"
        className={`${styles.modeBtn} ${mode === "bids" ? styles.modeActive : ""}`}
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
}

function TabFilters({
  tab,
  mode,
  onModeChange,
  openOrdersMarkets,
  orderHistoryMarkets,
  openOrdersMarketFilter,
  onOpenOrdersMarketFilterChange,
  orderHistoryMarketFilter,
  onOrderHistoryMarketFilterChange,
  openOrdersTypeFilter,
  onOpenOrdersTypeFilterChange,
  tradeHistoryMarkets,
  tradeHistoryMarketFilter,
  onTradeHistoryMarketFilterChange,
  tradeHistoryTypeFilter,
  onTradeHistoryTypeFilterChange,
  onTradeHistoryExport,
  isTradeHistoryExportDisabled,
}: {
  tab: Tab;
  mode: BottomTabFilterMode;
  onModeChange: (mode: BottomTabFilterMode) => void;
  openOrdersMarkets: string[];
  orderHistoryMarkets: string[];
  openOrdersMarketFilter: OpenOrdersMarketFilter;
  onOpenOrdersMarketFilterChange: (value: OpenOrdersMarketFilter) => void;
  orderHistoryMarketFilter: OpenOrdersMarketFilter;
  onOrderHistoryMarketFilterChange: (value: OpenOrdersMarketFilter) => void;
  openOrdersTypeFilter: OpenOrdersTypeFilter;
  onOpenOrdersTypeFilterChange: (value: OpenOrdersTypeFilter) => void;
  tradeHistoryMarkets: string[];
  tradeHistoryMarketFilter: OpenOrdersMarketFilter;
  onTradeHistoryMarketFilterChange: (value: OpenOrdersMarketFilter) => void;
  tradeHistoryTypeFilter: TradeHistoryTypeFilter;
  onTradeHistoryTypeFilterChange: (value: TradeHistoryTypeFilter) => void;
  onTradeHistoryExport: () => void;
  isTradeHistoryExportDisabled: boolean;
}) {
  const { i18n } = useLingui();
  const [marketMenuOpen, setMarketMenuOpen] = useState(false);
  const [typeMenuOpen, setTypeMenuOpen] = useState(false);
  const [tradeTypeMenuOpen, setTradeTypeMenuOpen] = useState(false);
  const [marketSearch, setMarketSearch] = useState("");
  const showsMarketDropdown = tab === "Open Orders" || tab === "Order History" || tab === "Trade History";
  const activeMarketFilter =
    tab === "Trade History"
      ? tradeHistoryMarketFilter
      : tab === "Order History"
        ? orderHistoryMarketFilter
        : openOrdersMarketFilter;
  const marketOptions =
    tab === "Trade History" ? tradeHistoryMarkets : tab === "Order History" ? orderHistoryMarkets : openOrdersMarkets;
  const filteredMarkets = marketOptions.filter((market) => market.toLowerCase().includes(marketSearch.toLowerCase()));
  const applyMarketFilter = (value: OpenOrdersMarketFilter) => {
    if (tab === "Trade History") onTradeHistoryMarketFilterChange(value);
    else if (tab === "Order History") onOrderHistoryMarketFilterChange(value);
    else onOpenOrdersMarketFilterChange(value);
  };
  // 跟下单面板保持一致:基本(Market / Limit)+ 高级(S/L / T/P 四档)。
  const openOrderTypeOptions: OpenOrdersTypeFilter[] = [
    "All",
    "Market",
    "Limit",
    "S/L Market",
    "S/L Limit",
    "T/P Market",
    "T/P Limit",
  ];
  const tradeTypeOptions: TradeHistoryTypeFilter[] = ["All", "Trade", "Liquidation", "Deleverage", "Market Settlement"];

  // Trade History 型别下拉的静态多语言(同样绕开 Lingui catalog 短词冲突)。zh 跟随项目繁体风格。
  const tradeTypeLabelMap: Record<Exclude<TradeHistoryTypeFilter, "All">, { en: string; zh: string }> = {
    Trade: { en: "Trade", zh: "成交" },
    Liquidation: { en: "Liquidation", zh: "強平" },
    Deleverage: { en: "Deleverage", zh: "自動減倉" },
    "Market Settlement": { en: "Market Settlement", zh: "市場結算" },
  };
  const pickTradeTypeLabel = (option: TradeHistoryTypeFilter) => {
    if (option === "All") return i18n._(t`All`);
    const entry = tradeTypeLabelMap[option];
    return i18n.locale.startsWith("zh") ? entry.zh : entry.en;
  };

  // Open Orders 型别下拉:同套路避开 Lingui catalog 短词冲突(Limit / Market 等在项目内有多处条目)。
  // "S/L" / "T/P" / "TWAP" 是交易术语,繁体不翻,只给 Limit / Market 中文。
  const openOrderTypeLabelMap: Record<Exclude<OpenOrdersTypeFilter, "All">, { en: string; zh: string }> = {
    Market: { en: "Market", zh: "市價" },
    Limit: { en: "Limit", zh: "限價" },
    // 对齐下单面板 Advanced 下拉的全称用字(止損/止盈 + 市價/限價 + 單)。
    "S/L Market": { en: "S/L Market", zh: "止損市價單" },
    "S/L Limit": { en: "S/L Limit", zh: "止損限價單" },
    "T/P Market": { en: "T/P Market", zh: "止盈市價單" },
    "T/P Limit": { en: "T/P Limit", zh: "止盈限價單" },
  };
  const pickOpenOrderTypeLabel = (option: OpenOrdersTypeFilter) => {
    if (option === "All") return i18n._(t`All`);
    const entry = openOrderTypeLabelMap[option];
    return i18n.locale.startsWith("zh") ? entry.zh : entry.en;
  };

  const typeLabel = tradeHistoryTypeFilter === "All" ? i18n._(t`Type`) : pickTradeTypeLabel(tradeHistoryTypeFilter);

  return (
    <div className={styles.filters}>
      <FilterModeButtons mode={mode} onChange={onModeChange} />
      {showsMarketDropdown && (
        <div className={styles.filterMenuWrap}>
          <button
            type="button"
            className={styles.filterButton}
            onClick={() => {
              setMarketMenuOpen((prev) => !prev);
              setTypeMenuOpen(false);
              setTradeTypeMenuOpen(false);
            }}
          >
            <MarketFilterIcon />
            <span>{activeMarketFilter === "All" ? <Trans>All</Trans> : activeMarketFilter}</span>
            <CaretDownIcon open={marketMenuOpen} />
          </button>
          {marketMenuOpen && (
            <div className={styles.marketMenu}>
              <div className={styles.marketSearchSticky}>
                <div className={styles.marketSearchWrap}>
                  <SearchIcon />
                  <input
                    className={styles.marketSearchInput}
                    value={marketSearch}
                    onChange={(event) => setMarketSearch(event.target.value)}
                    placeholder={i18n._(t`Search`)}
                  />
                </div>
              </div>
              <div className={styles.marketMenuList}>
                <button
                  type="button"
                  className={`${styles.marketOption} ${activeMarketFilter === "All" ? styles.marketOptionActive : ""}`}
                  onClick={() => {
                    applyMarketFilter("All");
                    setMarketMenuOpen(false);
                    setMarketSearch("");
                  }}
                >
                  <span>
                    <Trans>All</Trans>
                  </span>
                  <MarketFilterIcon />
                </button>
                {filteredMarkets.map((market) => (
                  <button
                    key={market}
                    type="button"
                    className={`${styles.marketOption} ${activeMarketFilter === market ? styles.marketOptionActive : ""}`}
                    onClick={() => {
                      applyMarketFilter(market);
                      setMarketMenuOpen(false);
                      setMarketSearch("");
                    }}
                  >
                    <span>{market}</span>
                    <TokenIcon symbol={market} displaySize={16} />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      {tab === "Open Orders" && (
        <div className={styles.filterMenuWrap}>
          <button
            type="button"
            className={styles.filterButton}
            onClick={() => {
              setTypeMenuOpen((prev) => !prev);
              setMarketMenuOpen(false);
            }}
          >
            <TypeFilterIcon />
            <span>
              <Trans>Type</Trans>
            </span>
            <CaretDownIcon open={typeMenuOpen} />
          </button>
          {typeMenuOpen && (
            <div className={styles.typeMenu}>
              <div className={styles.typeMenuList}>
                {openOrderTypeOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={`${styles.typeOption} ${openOrdersTypeFilter === option ? styles.typeOptionActive : ""}`}
                    onClick={() => {
                      onOpenOrdersTypeFilterChange(option);
                      setTypeMenuOpen(false);
                    }}
                  >
                    <span>{pickOpenOrderTypeLabel(option)}</span>
                    {openOrdersTypeFilter === option && <span className={styles.typeCheck}>✓</span>}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      {tab === "Trade History" && (
        <div className={styles.filterMenuWrap}>
          <button
            type="button"
            className={styles.filterButton}
            onClick={() => {
              setTradeTypeMenuOpen((prev) => !prev);
              setMarketMenuOpen(false);
            }}
          >
            <TypeFilterIcon />
            <span>{typeLabel}</span>
            <CaretDownIcon open={tradeTypeMenuOpen} />
          </button>
          {tradeTypeMenuOpen && (
            <div className={styles.typeMenu}>
              <div className={styles.typeMenuList}>
                {tradeTypeOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={`${styles.typeOption} ${tradeHistoryTypeFilter === option ? styles.typeOptionActive : ""}`}
                    onClick={() => {
                      onTradeHistoryTypeFilterChange(option);
                      setTradeTypeMenuOpen(false);
                    }}
                  >
                    <span>{pickTradeTypeLabel(option)}</span>
                    {tradeHistoryTypeFilter === option && <span className={styles.typeCheck}>✓</span>}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      {tab === "Trade History" && (
        <button
          type="button"
          className={styles.filterButton}
          onClick={onTradeHistoryExport}
          disabled={isTradeHistoryExportDisabled}
          title={isTradeHistoryExportDisabled ? i18n._(t`Nothing to export`) : i18n._(t`Download as CSV`)}
        >
          <Trans>Export</Trans>
        </button>
      )}
    </div>
  );
}

/**
 * Trade History 前端筛选:按 Market + Type 过滤(均大小写不敏感,"All" 放行)。
 * 保持函数纯,便于单测 / 导出逻辑共用同一份结果。
 */
export function filterTradeHistory(
  trades: LighterTradeHistoryRow[],
  marketFilter: OpenOrdersMarketFilter,
  typeFilter: TradeHistoryTypeFilter
): LighterTradeHistoryRow[] {
  const wantType = typeFilter === "All" ? null : typeFilter.toLowerCase();
  return trades.filter((trade) => {
    if (marketFilter !== "All" && trade.market !== marketFilter) return false;
    if (wantType != null && (trade.type || "").toLowerCase() !== wantType) return false;
    return true;
  });
}

/** 把聚合后的 Trade History 行导出为 CSV(当前筛选态的快照,不含未来数据)。 */
function buildTradeHistoryCsv(rows: LighterTradeHistoryRow[]): string {
  const header = [
    "market",
    "side",
    "date",
    "trade_value_usd",
    "size",
    "price",
    "closed_pnl_usd",
    "fee_usd",
    "role",
    "type",
  ];
  const esc = (v: string) => {
    if (v.includes(",") || v.includes('"') || v.includes("\n")) {
      return `"${v.replace(/"/g, '""')}"`;
    }
    return v;
  };
  const num = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? "" : String(v));
  const lines = [header.join(",")];
  for (const row of rows) {
    lines.push(
      [
        esc(row.market),
        esc(row.side),
        esc(new Date(row.date).toISOString()),
        num(row.tradeValue),
        num(row.size),
        num(row.price),
        num(row.closedPnl),
        num(row.fee),
        esc(row.role || ""),
        esc(row.type || ""),
      ].join(",")
    );
  }
  return lines.join("\n");
}

function downloadCsv(filename: string, csv: string) {
  if (typeof window === "undefined") return;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function BottomTabs() {
  const { i18n } = useLingui();
  const [tab, setTab] = useState<Tab>("Positions");
  const [mode, setMode] = useState<BottomTabFilterMode>("all");
  const [openOrdersMarketFilter, setOpenOrdersMarketFilter] = useState<OpenOrdersMarketFilter>("All");
  const [orderHistoryMarketFilter, setOrderHistoryMarketFilter] = useState<OpenOrdersMarketFilter>("All");
  const [openOrdersTypeFilter, setOpenOrdersTypeFilter] = useState<OpenOrdersTypeFilter>("All");
  const [tradeHistoryMarketFilter, setTradeHistoryMarketFilter] = useState<OpenOrdersMarketFilter>("All");
  const [tradeHistoryTypeFilter, setTradeHistoryTypeFilter] = useState<TradeHistoryTypeFilter>("All");
  const tabs: Tab[] = ["Positions", "Assets", "Open Orders", "Order History", "Trade History"];
  const positions = usePositionsAdapter();
  const assets = useAssetsAdapter();
  const openOrders = useOpenOrdersAdapter();
  const orderHistory = useOrderHistoryAdapter();
  const { rows: trades, refreshTradeHistory } = useTradeHistoryAdapterState();

  useEffect(() => {
    if (tab === "Trade History") {
      refreshTradeHistory();
    }
  }, [refreshTradeHistory, tab]);

  const handleTabClick = useCallback(
    (nextTab: Tab) => {
      if (nextTab === "Trade History") {
        refreshTradeHistory();
      }

      setTab(nextTab);
    },
    [refreshTradeHistory]
  );

  // Market + Type 筛选后的 trades,供表格渲染和 CSV 导出共用,保证口径一致。
  // long/short mode 颜色筛选仍交给 TradeHistoryTab 处理(已有),导出时一并应用。
  const prefilteredTrades = useMemo(
    () => filterTradeHistory(trades, tradeHistoryMarketFilter, tradeHistoryTypeFilter),
    [trades, tradeHistoryMarketFilter, tradeHistoryTypeFilter]
  );

  const visibleTradesForExport = useMemo(
    () =>
      prefilteredTrades.filter((trade) => {
        if (mode === "all") return true;
        if (mode === "asks") return trade.side.includes("Short");
        return trade.side.includes("Long");
      }),
    [mode, prefilteredTrades]
  );

  const visibleTradesRef = useRef(visibleTradesForExport);
  visibleTradesRef.current = visibleTradesForExport;

  const handleTradeHistoryExport = useCallback(() => {
    const rows = visibleTradesRef.current;
    if (!rows.length) return;
    const stamp = new Date().toISOString().replace(/[:]/g, "-").replace(/\..+$/, "");
    downloadCsv(`trade-history-${stamp}.csv`, buildTradeHistoryCsv(rows));
  }, []);

  const tabLabelMap: Record<Tab, string> = {
    Positions: i18n._(t`Positions (${positions.length})`),
    Assets: i18n._(t`Assets (${assets.length})`),
    "Open Orders": i18n._(t`Open Orders (${openOrders.length})`),
    "Order History": i18n._(t`Order History`),
    "Trade History": i18n._(t`Trade History`),
    "Funding History": i18n._(t`Funding History`),
  };
  const openOrdersMarkets = Array.from(new Set(openOrders.map((order) => order.market))).sort();
  const orderHistoryMarkets = Array.from(
    new Set(orderHistory.map((order) => order.market).filter((market) => market && market !== "--"))
  ).sort();
  const tradeHistoryMarkets = Array.from(
    new Set(trades.map((trade) => trade.market).filter((market) => market && market !== "--"))
  ).sort();

  return (
    <div className={styles.root}>
      <div className={styles.tabs}>
        {tabs.map((t) => (
          <button key={t} onClick={() => handleTabClick(t)} className={tab === t ? styles.tabActive : styles.tab}>
            {tabLabelMap[t]}
          </button>
        ))}
        <TabFilters
          tab={tab}
          mode={mode}
          onModeChange={setMode}
          openOrdersMarkets={openOrdersMarkets}
          orderHistoryMarkets={orderHistoryMarkets}
          openOrdersMarketFilter={openOrdersMarketFilter}
          onOpenOrdersMarketFilterChange={setOpenOrdersMarketFilter}
          orderHistoryMarketFilter={orderHistoryMarketFilter}
          onOrderHistoryMarketFilterChange={setOrderHistoryMarketFilter}
          openOrdersTypeFilter={openOrdersTypeFilter}
          onOpenOrdersTypeFilterChange={setOpenOrdersTypeFilter}
          tradeHistoryMarkets={tradeHistoryMarkets}
          tradeHistoryMarketFilter={tradeHistoryMarketFilter}
          onTradeHistoryMarketFilterChange={setTradeHistoryMarketFilter}
          tradeHistoryTypeFilter={tradeHistoryTypeFilter}
          onTradeHistoryTypeFilterChange={setTradeHistoryTypeFilter}
          onTradeHistoryExport={handleTradeHistoryExport}
          isTradeHistoryExportDisabled={visibleTradesForExport.length === 0}
        />
      </div>
      <div className={styles.body}>
        {tab === "Positions" && <PositionsTab mode={mode} />}
        {tab === "Assets" && <AssetsTab mode={mode} />}
        {tab === "Open Orders" && (
          <OpenOrdersTab mode={mode} marketFilter={openOrdersMarketFilter} typeFilter={openOrdersTypeFilter} />
        )}
        {tab === "Order History" && <OrderHistoryTab mode={mode} marketFilter={orderHistoryMarketFilter} />}
        {tab === "Trade History" && <TradeHistoryTab mode={mode} trades={prefilteredTrades} />}
        {tab === "Funding History" && <FundingHistoryTab mode={mode} />}
      </div>
    </div>
  );
}
