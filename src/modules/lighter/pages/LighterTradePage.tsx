// src/modules/lighter/pages/LighterTradePage.tsx
import { useCallback, useEffect, useMemo, useState } from "react";

import { useTokensFavorites } from "@/modules/lighter/store/TokensFavoritesContext/TokensFavoritesContextProvider";

import "../styles/global.scss";
import styles from "./LighterTradePage.module.scss";
import { useTradeState } from "@/modules/lighter/store/TradeStateContext";
import { AccountsPanel } from "../components/AccountsPanel/AccountsPanel";
import { BottomTabs } from "../components/BottomTabs/BottomTabs";
import { ChartPanel } from "../components/ChartPanel/ChartPanel";
import { OrderBookPanel, type OrderBookLayout } from "../components/OrderBookPanel/OrderBookPanel";
import { OrderFormPanel } from "../components/OrderFormPanel/OrderFormPanel";
import { SymbolBar } from "../components/SymbolBar/SymbolBar";
import { TopNav } from "../components/TopNav/TopNav";

export default function LighterTradePage() {
  const [orderBookLayout, setOrderBookLayout] = useState<OrderBookLayout>("Tab");

  useEffect(() => {
    document.body.classList.add("lighter-active");
    return () => document.body.classList.remove("lighter-active");
  }, []);

  /** ========= Favorite market 按钮逻辑 =========
   *  - key "trade-market-selector" 与交易对下拉面板共用，
   *    这样 SymbolBar 下方的星星和搜索面板里的星星状态同步。
   *  - token id 是 "BTCUSDT" 形式（与 market.symbol / 收藏 store 格式一致）。
   *    selectedSymbol 形如 "BTCUSDT-USD"，截前半段即可。 */
  const { selectedSymbol } = useTradeState();
  const { favoriteTokens, toggleFavoriteToken } = useTokensFavorites("trade-market-selector");
  const currentMarketKey = useMemo(() => {
    if (!selectedSymbol) return "";
    const base = selectedSymbol.split("-")[0]?.toUpperCase();
    if (!base) return "";
    return base.endsWith("USDT") ? base : `${base}USDT`;
  }, [selectedSymbol]);
  const isFavorite = Boolean(currentMarketKey && favoriteTokens?.includes(currentMarketKey));
  const handleToggleFavorite = useCallback(() => {
    if (!currentMarketKey) return;
    toggleFavoriteToken(currentMarketKey);
  }, [currentMarketKey, toggleFavoriteToken]);

  return (
    <div className={`lighter-root ${styles.page}`}>
      <div className={styles.topnav}>
        <TopNav />
      </div>
      {/* <div className={styles.banner}>
        You're accessing Lighter from a restricted jurisdiction. Only withdrawals are available. For more details, see
        the&nbsp;
        <a href="#terms">Terms of Service</a>.
      </div> */}
      <div className={`${styles.tradeGrid} ${orderBookLayout === "Large" ? styles.tradeGridLarge : ""}`}>
        <div className={styles.chartCol}>
          <SymbolBar />
          <div className={styles.favoritesBar}>
            <button
              type="button"
              className={styles.favoriteButton}
              aria-label={isFavorite ? "remove favorite" : "add favorite"}
              aria-pressed={isFavorite}
              onClick={handleToggleFavorite}
              disabled={!currentMarketKey}
              data-favorited={isFavorite ? "true" : "false"}
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill={isFavorite ? "var(--color-yellow-300, #ffe166)" : "none"}
                stroke={isFavorite ? "var(--color-yellow-300, #ffe166)" : "currentColor"}
                strokeWidth="1.9"
              >
                <path
                  d="M12 3.8l2.53 5.12 5.65.82-4.09 3.99.97 5.63L12 16.68l-5.06 2.68.97-5.63L3.82 9.74l5.65-.82L12 3.8z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
          <div className={styles.chart}>
            <ChartPanel />
          </div>
        </div>
        <div className={`${styles.orderbook} ${orderBookLayout === "Large" ? styles.orderbookLarge : ""}`}>
          <OrderBookPanel layout={orderBookLayout} onLayoutChange={setOrderBookLayout} />
        </div>
        <div className={styles.orderform}>
          <OrderFormPanel />
        </div>
        <div className={`${styles.tabs} ${orderBookLayout === "Large" ? styles.tabsLarge : ""}`}>
          <BottomTabs />
        </div>
        <div className={`${styles.accounts} ${orderBookLayout === "Large" ? styles.accountsLarge : ""}`}>
          <AccountsPanel />
        </div>
      </div>
    </div>
  );
}
