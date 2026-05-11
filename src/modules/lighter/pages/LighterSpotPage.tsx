import { Trans, t } from "@lingui/macro";
import { useLingui } from "@lingui/react";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import useSWR, { useSWRConfig } from "swr";
import { useAccount } from "wagmi";

import { useZanbaraAuth } from "@/modules/lighter/api/custom/useZanbaraAuth";
import { useTradingAccountModalOpen } from "@/modules/lighter/context/TradingAccountContext";
import { useTokensFavorites } from "@/modules/lighter/store/TokensFavoritesContext/TokensFavoritesContextProvider";

import "../styles/global.scss";
import styles from "./LighterSpotPage.module.scss";
import {
  cancelSpotOrder,
  createSpotOrder,
  getBalances,
  getMarkets,
  getOrderbook,
  getSpotAccountTrades,
  getSpotOrders,
  getTicker,
  type CreateSpotOrderRequest,
  type MarketsResponse,
  type SpotOrderRecord,
  type SpotTradeRecord,
} from "@/modules/lighter/api/custom/client";
import { useAuthToken } from "@/modules/lighter/api/custom/useAuthToken";
import { useTradeState } from "@/modules/lighter/store/TradeStateContext";
import { DEFAULT_CHAIN_ID } from "config/chains";
import { helperToast } from "lib/helperToast";
import { AccountsPanel } from "../components/AccountsPanel/AccountsPanel";
import { ChartPanel } from "../components/ChartPanel/ChartPanel";
import { OrderBookPanel, type OrderBookLayout } from "../components/OrderBookPanel/OrderBookPanel";
import { PercentSlider } from "../components/PercentSlider/PercentSlider";
import { SymbolBar } from "../components/SymbolBar/SymbolBar";
import { TopNav } from "../components/TopNav/TopNav";

export default function LighterSpotPage() {
  const [orderBookLayout, setOrderBookLayout] = useState<OrderBookLayout>("Tab");
  const [spotOrderSide, setSpotOrderSide] = useState<"buy" | "sell">("buy");

  useEffect(() => {
    document.body.classList.add("lighter-active");
    return () => document.body.classList.remove("lighter-active");
  }, []);

  /** ========= Favorite market 按钮逻辑 =========
   *  - key "spot-market-selector" 与交易对下拉面板共用，
   *    这样 SymbolBar 下方的星星和搜索面板里的星星状态同步。
   *  - token id 是 "BTCUSDT" 形式（与 market.symbol / 收藏 store 格式一致）。
   *    selectedSymbol 形如 "BTCUSDT-USD"，截前半段即可。 */
  const { selectedSymbol, setSelectedSymbol } = useTradeState();
  const { favoriteTokens, toggleFavoriteToken } = useTokensFavorites("spot-market-selector");
  const { data: spotMarketsData } = useSWR(
    ["spot-markets", DEFAULT_CHAIN_ID],
    () => getMarkets(DEFAULT_CHAIN_ID, undefined, "spot"),
    {
      revalidateOnFocus: false,
      refreshInterval: 30_000,
    }
  );
  const spotMarkets = useMemo(() => spotMarketsData?.markets ?? [], [spotMarketsData?.markets]);

  useEffect(() => {
    const firstSpotSymbol = spotMarkets[0]?.symbol;
    if (!firstSpotSymbol) return;

    const selectedMarketKey = selectedSymbol ? normalizeSpotMarketKey(selectedSymbol) : "";
    const selectedExists = selectedMarketKey
      ? spotMarkets.some((market) => normalizeSpotMarketKey(market.symbol) === selectedMarketKey)
      : false;

    if (!selectedExists) {
      setSelectedSymbol(firstSpotSymbol);
    }
  }, [selectedSymbol, setSelectedSymbol, spotMarkets]);

  const currentMarketKey = useMemo(() => {
    if (!selectedSymbol) return "";
    const base = selectedSymbol.split("-")[0]?.toUpperCase();
    if (!base) return "";
    return base.endsWith("USDT") ? base : `${base}USDT`;
  }, [selectedSymbol]);
  const spotBaseSymbol = useMemo(() => currentMarketKey.replace(/USDT$/, "") || "BTC", [currentMarketKey]);
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
          <SpotOrderPanel
            marketsData={spotMarketsData}
            preferredMarketKey={currentMarketKey}
            fallbackBaseSymbol={spotBaseSymbol}
            orderSide={spotOrderSide}
            onOrderSideChange={setSpotOrderSide}
          />
        </div>
        <div className={`${styles.tabs} ${orderBookLayout === "Large" ? styles.tabsLarge : ""}`}>
          <SpotBottomTabs marketKey={currentMarketKey} />
        </div>
        <div className={`${styles.accounts} ${orderBookLayout === "Large" ? styles.accountsLarge : ""}`}>
          <AccountsPanel spotBaseSymbol={spotBaseSymbol} spotQuoteSymbol="USDT" />
        </div>
      </div>
    </div>
  );
}

function SpotOrderPanel({
  marketsData,
  preferredMarketKey,
  fallbackBaseSymbol,
  orderSide,
  onOrderSideChange,
}: {
  marketsData?: MarketsResponse;
  preferredMarketKey: string;
  fallbackBaseSymbol: string;
  orderSide: "buy" | "sell";
  onOrderSideChange: (side: "buy" | "sell") => void;
}) {
  const { i18n } = useLingui();
  const { address, isConnected } = useAccount();
  const { token: authToken } = useAuthToken(DEFAULT_CHAIN_ID);
  const { openConnectModal, connectModalOpen } = useConnectModal();
  const { isAuthenticated, isAuthenticating, authenticate, clearError } = useZanbaraAuth();
  const [, setTradingAccountModalOpen] = useTradingAccountModalOpen();
  const { mutate } = useSWRConfig();
  const [orderType, setOrderType] = useState<"limit" | "market">("limit");
  const [price, setPrice] = useState("");
  const [amount, setAmount] = useState("");
  const [total, setTotal] = useState("");
  const [pct, setPct] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const selectedMarket = useMemo(() => {
    const markets = marketsData?.markets ?? [];
    const preferred = preferredMarketKey ? preferredMarketKey.toUpperCase() : "";
    return markets.find((market) => market.symbol.replace("-USD", "USDT").toUpperCase() === preferred) ?? markets[0];
  }, [marketsData?.markets, preferredMarketKey]);

  const apiSymbol = selectedMarket?.symbol.replace("-USD", "USDT").toUpperCase() || `${fallbackBaseSymbol}USDT`;
  const baseSymbol = selectedMarket?.base_asset || fallbackBaseSymbol;
  const quoteSymbol = selectedMarket?.quote_asset || "USDT";

  const { data: ticker } = useSWR(
    apiSymbol ? ["spot-ticker-24hr", DEFAULT_CHAIN_ID, apiSymbol] : null,
    () => getTicker(DEFAULT_CHAIN_ID, apiSymbol, "spot"),
    { revalidateOnFocus: false, refreshInterval: 5_000 }
  );
  const { data: orderbook } = useSWR(
    apiSymbol ? ["spot-orderbook-lite", DEFAULT_CHAIN_ID, apiSymbol] : null,
    () => getOrderbook(DEFAULT_CHAIN_ID, apiSymbol, "spot"),
    { revalidateOnFocus: false, refreshInterval: 3_000 }
  );

  const balancesKey = address && authToken ? ["spot-balances", DEFAULT_CHAIN_ID, address, authToken] : null;
  const { data: balancesData } = useSWR(
    balancesKey,
    () => getBalances(DEFAULT_CHAIN_ID, address, "spot"),
    { revalidateOnFocus: true, refreshInterval: 10_000 }
  );

  const marketPrice = ticker?.last_price && Number(ticker.last_price) > 0 ? ticker.last_price : selectedMarket?.last_price || "";

  useEffect(() => {
    if (!price && orderType === "limit" && marketPrice) {
      setPrice(trimDecimal(marketPrice));
    }
  }, [marketPrice, orderType, price]);

  const balancesByToken = useMemo(() => {
    const map = new Map<string, { available: string; frozen: string; total: string }>();
    for (const balance of balancesData?.balances ?? []) {
      const token = (balance.token || balance.symbol).toUpperCase();
      map.set(token, balance);
    }
    return map;
  }, [balancesData?.balances]);

  const baseBalance = balancesByToken.get(baseSymbol.toUpperCase());
  const quoteBalance = balancesByToken.get(quoteSymbol.toUpperCase());
  const availableToken = orderSide === "buy" ? quoteSymbol : baseSymbol;
  const availableBalance = orderSide === "buy" ? quoteBalance?.available : baseBalance?.available;
  const isBuy = orderSide === "buy";
  const bestBid = orderbook?.bids?.[0]?.[0] || "";
  const bestAsk = orderbook?.asks?.[0]?.[0] || "";
  const referencePrice =
    orderType === "market" ? (isBuy ? bestAsk : bestBid) || marketPrice : price || marketPrice;
  const actionLabel = isBuy ? `${i18n._(t`Buy`)} ${baseSymbol}` : `${i18n._(t`Sell`)} ${baseSymbol}`;
  const feeRate = selectedMarket ? (isBuy ? selectedMarket.taker_fee_bps : selectedMarket.maker_fee_bps) / 100 : 0.1;
  const computedTotal = Number(amount) > 0 && Number(referencePrice) > 0 ? Number(amount) * Number(referencePrice) : 0;
  const canSubmit =
    !!address &&
    !!authToken &&
    !!apiSymbol &&
    Number(amount) > 0 &&
    (orderType === "market" || Number(price) > 0) &&
    !submitting;

  const updateAmount = (nextAmount: string) => {
    setAmount(nextAmount);
    const nextTotal = Number(nextAmount) > 0 && Number(referencePrice) > 0 ? Number(nextAmount) * Number(referencePrice) : 0;
    setTotal(nextTotal > 0 ? formatTotalAmount(nextTotal) : "");
  };

  const updatePrice = (nextPrice: string) => {
    setPrice(nextPrice);
    const nextTotal = Number(amount) > 0 && Number(nextPrice || marketPrice) > 0 ? Number(amount) * Number(nextPrice || marketPrice) : 0;
    setTotal(nextTotal > 0 ? formatTotalAmount(nextTotal) : "");
  };

  const updateTotal = (nextTotal: string) => {
    setTotal(nextTotal);
    const numericReferencePrice = Number(orderType === "market" ? referencePrice : price || marketPrice);
    if (numericReferencePrice > 0 && Number(nextTotal) > 0) {
      setAmount(normalizeStep(String(Number(nextTotal) / numericReferencePrice), selectedMarket?.lot_size));
    }
  };

  const handlePercent = (nextPct: number) => {
    setPct(nextPct);
    const available = Number(availableBalance);
    if (!Number.isFinite(available) || available <= 0) return;
    if (isBuy) {
      const numericReferencePrice = Number(referencePrice);
      if (numericReferencePrice <= 0) return;
      updateAmount(normalizeStep(String((available * nextPct) / 100 / numericReferencePrice), selectedMarket?.lot_size));
    } else {
      updateAmount(normalizeStep(String((available * nextPct) / 100), selectedMarket?.lot_size));
    }
  };

  const handleOpenDeposit = useCallback(async () => {
    if (!isConnected || !address) {
      if (!connectModalOpen) {
        openConnectModal?.();
      }
      return;
    }

    if (!authToken || !isAuthenticated) {
      if (isAuthenticating) return;
      clearError();
      const response = await authenticate();
      if (!response) return;
    }

    setTradingAccountModalOpen("deposit");
  }, [
    address,
    authToken,
    authenticate,
    clearError,
    connectModalOpen,
    isAuthenticated,
    isAuthenticating,
    isConnected,
    openConnectModal,
    setTradingAccountModalOpen,
  ]);

  const submit = async () => {
    if (!address || !authToken) {
      helperToast.error(i18n._(t`Please connect your wallet and sign in first`));
      return;
    }
    if (!canSubmit) return;

    const normalizedAmount = normalizeStep(amount, selectedMarket?.lot_size);
    const normalizedPrice = orderType === "limit" ? normalizeStep(price, selectedMarket?.tick_size) : "";
    const numericReferencePrice = Number(orderType === "limit" ? normalizedPrice : referencePrice);
    const quoteAmount =
      orderType === "market" && orderSide === "buy" ? trimDecimal(total || String(Number(normalizedAmount) * numericReferencePrice)) : "";
    const orderNotional =
      orderType === "market" && orderSide === "buy" ? Number(quoteAmount) : Number(normalizedAmount) * numericReferencePrice;
    const minNotional = Number(selectedMarket?.min_notional || 0);

    if (!normalizedAmount || Number(normalizedAmount) <= 0) {
      const lotSize = selectedMarket?.lot_size || i18n._(t`the market lot size`);
      helperToast.error(i18n._(t`Amount must be a multiple of ${lotSize}`));
      return;
    }
    if (orderType === "limit" && (!normalizedPrice || Number(normalizedPrice) <= 0)) {
      const tickSize = selectedMarket?.tick_size || i18n._(t`the market tick size`);
      helperToast.error(i18n._(t`Price must be a multiple of ${tickSize}`));
      return;
    }
    if (minNotional > 0 && orderNotional < minNotional) {
      const minNotionalText = formatAmount(String(minNotional));
      helperToast.error(i18n._(t`Minimum order value is ${minNotionalText} ${quoteSymbol}`));
      return;
    }
    if (normalizedAmount !== trimDecimal(amount)) {
      updateAmount(normalizedAmount);
    }
    if (normalizedPrice && normalizedPrice !== trimDecimal(price)) {
      updatePrice(normalizedPrice);
    }

    const request: CreateSpotOrderRequest = {
      symbol: apiSymbol,
      side: orderSide,
      type: orderType,
      tif: orderType === "limit" ? "gtc" : "ioc",
    };

    if (orderType === "limit") {
      request.price = normalizedPrice;
      request.quantity = normalizedAmount;
    } else if (orderSide === "buy") {
      request.quote_quantity = quoteAmount;
    } else {
      request.quantity = normalizedAmount;
    }

    try {
      setSubmitting(true);
      const response = await createSpotOrder(DEFAULT_CHAIN_ID, request, address);
      if (response.status?.toLowerCase() === "rejected") {
        throw new Error(response.reject_reason || "Spot order was rejected");
      }
      helperToast.success(i18n._(t`Order submitted: ${response.id}`));
      setAmount("");
      setTotal("");
      setPct(0);
      mutate(balancesKey);
      mutate((key) => Array.isArray(key) && String(key[0]).startsWith("spot-account-"), undefined, {
        revalidate: true,
      });
    } catch (error: any) {
      helperToast.error(error?.message || i18n._(t`Failed to submit spot order`));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.spotOrderPanel}>
      <div className={styles.spotSideSwitch}>
        <button
          type="button"
          className={`${styles.spotSideButton} ${isBuy ? styles.spotSideBuyActive : ""}`}
          onClick={() => onOrderSideChange("buy")}
        >
          <Trans>Buy</Trans>
        </button>
        <button
          type="button"
          className={`${styles.spotSideButton} ${!isBuy ? styles.spotSideSellActive : ""}`}
          onClick={() => onOrderSideChange("sell")}
        >
          <Trans>Sell</Trans>
        </button>
      </div>

      <div className={styles.spotOrderCard}>
        <div className={styles.spotOrderTabs}>
          <button
            type="button"
            className={`${styles.spotOrderTab} ${orderType === "limit" ? styles.spotOrderTabActive : ""}`}
            onClick={() => setOrderType("limit")}
          >
            <Trans>Limit</Trans>
          </button>
          <button
            type="button"
            className={`${styles.spotOrderTab} ${orderType === "market" ? styles.spotOrderTabActive : ""}`}
            onClick={() => setOrderType("market")}
          >
            <Trans>Market</Trans>
          </button>
          <button type="button" className={`${styles.spotOrderTab} ${styles.spotOrderType}`}>
            {orderType === "limit" ? <Trans>Limit Order</Trans> : <Trans>Market Order</Trans>}{" "}
            <span className={styles.chevron}>⌄</span>
          </button>
        </div>

        <div className={styles.spotOrderBody}>
          <div className={styles.availableRow}>
            <span>
              <Trans>Available</Trans>
            </span>
            <span className={styles.availableValue}>
              {availableBalance ? formatAmount(availableBalance) : "--"} {availableToken}
              <button
                type="button"
                className={styles.addCircle}
                onClick={handleOpenDeposit}
                disabled={isAuthenticating}
                aria-label={i18n._(t`Deposit`)}
              >
                +
              </button>
            </span>
          </div>

          {orderType === "limit" ? (
            <SpotOrderInput
              label={<Trans>Price</Trans>}
              value={price}
              onChange={updatePrice}
              placeholder={marketPrice || "0.00"}
              suffix={quoteSymbol}
            />
          ) : null}
          <SpotOrderInput
            label={<Trans>Amount</Trans>}
            value={amount}
            onChange={updateAmount}
            placeholder={i18n._(t`Enter amount`)}
            suffix={baseSymbol}
          />

          <div className={styles.percentControl}>
            <PercentSlider value={pct} onChange={handlePercent} side={orderSide} />
          </div>

          <SpotOrderInput
            label={<Trans>Total</Trans>}
            value={total || (computedTotal > 0 ? formatTotalAmount(computedTotal) : "")}
            onChange={updateTotal}
            placeholder="0.00"
            suffix={quoteSymbol}
          />

          <button
            type="button"
            className={`${styles.spotSubmitButton} ${isBuy ? styles.spotSubmitBuy : styles.spotSubmitSell}`}
            disabled={!canSubmit}
            onClick={submit}
          >
            {submitting ? <Trans>Submitting...</Trans> : actionLabel}
          </button>

          <div className={styles.feeRow}>
            <span>
              <Trans>Fee</Trans> ({feeRate}%)
            </span>
            <span>{computedTotal > 0 ? formatAmount(String((computedTotal * feeRate) / 100)) : "--"} {quoteSymbol}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function SpotOrderInput({
  label,
  value,
  onChange,
  placeholder,
  suffix,
}: {
  label: ReactNode;
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  suffix: string;
}) {
  return (
    <label className={styles.spotField}>
      <span className={styles.spotFieldLabel}>
        {label}
        <span className={styles.chevron}>⌄</span>
      </span>
      <span className={styles.spotInputShell}>
        <input value={value ?? ""} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} inputMode="decimal" />
        <span>{suffix}</span>
      </span>
    </label>
  );
}

function trimDecimal(value: string): string {
  if (!value || !Number.isFinite(Number(value))) return "";
  return value.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}

function formatTotalAmount(value: number | string): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "";
  return numeric.toFixed(2);
}

function normalizeStep(value: string, step?: string): string {
  const numeric = Number(value);
  const numericStep = Number(step);
  if (!Number.isFinite(numeric) || numeric <= 0) return "";
  if (!Number.isFinite(numericStep) || numericStep <= 0) return trimDecimal(value);

  const decimals = getStepDecimals(step || "");
  const rounded = Math.floor((numeric + Number.EPSILON) / numericStep) * numericStep;
  return trimDecimal(rounded.toFixed(decimals));
}

function getStepDecimals(step: string): number {
  if (!step.includes(".")) return 0;
  return step.split(".")[1]?.replace(/0+$/, "").length ?? 0;
}

function formatAmount(value: string): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value;
  return numeric.toLocaleString(undefined, { maximumFractionDigits: 8 });
}

function normalizeSpotMarketKey(symbol: string): string {
  const compact = symbol.toUpperCase().trim().replace(/[/-]/g, "");
  if (!compact) return "";
  if (compact.endsWith("USDT")) return compact;
  if (compact.endsWith("USD")) return compact.replace(/USD$/, "USDT");
  return `${compact}USDT`;
}

type SpotBottomTab = "Open Orders" | "Order History" | "Trade History";

function SpotBottomTabs({ marketKey }: { marketKey: string }) {
  const { i18n } = useLingui();
  const { address } = useAccount();
  const { token: authToken } = useAuthToken(DEFAULT_CHAIN_ID);
  const { mutate } = useSWRConfig();
  const [activeTab, setActiveTab] = useState<SpotBottomTab>("Open Orders");
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const apiSymbol = normalizeSpotMarketKey(marketKey || "BTCUSDT");

  const openOrdersKey =
    address && authToken ? ["spot-account-open-orders", DEFAULT_CHAIN_ID, address, apiSymbol, authToken] : null;
  const orderHistoryKey =
    address && authToken ? ["spot-account-order-history", DEFAULT_CHAIN_ID, address, apiSymbol, authToken] : null;
  const tradeHistoryKey =
    address && authToken ? ["spot-account-trade-history", DEFAULT_CHAIN_ID, address, apiSymbol, authToken] : null;

  const { data: openOrders = [], isLoading: openOrdersLoading } = useSWR(
    openOrdersKey,
    async () => {
      const [open, partial] = await Promise.all([
        getSpotOrders(DEFAULT_CHAIN_ID, { symbol: apiSymbol, status: "open", limit: 200 }, address),
        getSpotOrders(DEFAULT_CHAIN_ID, { symbol: apiSymbol, status: "partially_filled", limit: 200 }, address),
      ]);
      return dedupeSpotOrders([...open, ...partial]);
    },
    { revalidateOnFocus: true, refreshInterval: 8_000 }
  );

  const { data: orderHistory = [], isLoading: orderHistoryLoading } = useSWR(
    orderHistoryKey,
    () => getSpotOrders(DEFAULT_CHAIN_ID, { symbol: apiSymbol, limit: 200 }, address),
    { revalidateOnFocus: true, refreshInterval: 12_000 }
  );

  const { data: tradeHistory = [], isLoading: tradeHistoryLoading } = useSWR(
    tradeHistoryKey,
    () => getSpotAccountTrades(DEFAULT_CHAIN_ID, { symbol: apiSymbol, limit: 200 }, address),
    { revalidateOnFocus: true, refreshInterval: 12_000 }
  );

  const cancel = async (orderId: string) => {
    if (!address || !authToken || !orderId || cancellingId) return;
    try {
      setCancellingId(orderId);
      await cancelSpotOrder(DEFAULT_CHAIN_ID, orderId, address);
      helperToast.success(i18n._(t`Order cancelled`));
      mutate(openOrdersKey);
      mutate(orderHistoryKey);
    } catch (error: any) {
      helperToast.error(error?.message || i18n._(t`Failed to cancel order`));
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <section className={styles.spotBottomTabs}>
      <div className={styles.spotBottomTabBar}>
        {(["Open Orders", "Order History", "Trade History"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            className={`${styles.spotBottomTabButton} ${activeTab === tab ? styles.spotBottomTabButtonActive : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {getSpotBottomTabLabel(tab, i18n)}
            {tab === "Open Orders" ? ` (${openOrders.length})` : ""}
          </button>
        ))}
      </div>

      {activeTab === "Open Orders" ? (
        <SpotOrdersTable
          orders={openOrders}
          loading={openOrdersLoading}
          emptyText={i18n._(t`No open orders`)}
          showCancel
          cancellingId={cancellingId}
          onCancel={cancel}
        />
      ) : null}
      {activeTab === "Order History" ? (
        <SpotOrdersTable orders={orderHistory} loading={orderHistoryLoading} emptyText={i18n._(t`No order history`)} />
      ) : null}
      {activeTab === "Trade History" ? (
        <SpotTradesTable trades={tradeHistory} loading={tradeHistoryLoading} emptyText={i18n._(t`No trade history`)} />
      ) : null}
    </section>
  );
}

function SpotOrdersTable({
  orders,
  loading,
  emptyText,
  showCancel = false,
  cancellingId,
  onCancel,
}: {
  orders: SpotOrderRecord[];
  loading: boolean;
  emptyText: string;
  showCancel?: boolean;
  cancellingId?: string | null;
  onCancel?: (orderId: string) => void;
}) {
  const { i18n } = useLingui();
  return (
    <div className={styles.spotTableWrap}>
      <table className={styles.spotTable}>
        <thead>
          <tr>
            <th><Trans>Market</Trans></th>
            <th><Trans>Side</Trans></th>
            <th><Trans>Type</Trans></th>
            <th><Trans>Price</Trans></th>
            <th><Trans>Amount</Trans></th>
            <th><Trans>Filled</Trans></th>
            <th><Trans>Average</Trans></th>
            <th><Trans>Status</Trans></th>
            <th><Trans>Date</Trans></th>
            {showCancel ? <th><Trans>Action</Trans></th> : null}
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => {
            const orderId = getSpotOrderId(order);
            return (
              <tr key={orderId || `${order.symbol}-${order.created_at}-${order.price}`}>
                <td>{formatSpotSymbol(order.symbol)}</td>
                <td className={order.side === "buy" ? styles.spotSideBuyText : styles.spotSideSellText}>
                  {formatSpotSide(order.side, i18n)}
                </td>
                <td>{formatSpotOrderType(order.type, i18n)}</td>
                <td>{formatSpotCell(order.price)}</td>
                <td>{formatSpotCell(order.quantity)}</td>
                <td>{formatSpotCell(order.filled_qty)}</td>
                <td>{formatSpotCell(order.avg_fill_price)}</td>
                <td>{formatSpotStatus(order.status)}</td>
                <td>{formatSpotTime(order.created_at)}</td>
                {showCancel ? (
                  <td>
                    <button
                      type="button"
                      className={styles.spotCancelButton}
                      disabled={!orderId || cancellingId === orderId}
                      onClick={() => orderId && onCancel?.(orderId)}
                    >
                    {cancellingId === orderId ? <Trans>Cancelling</Trans> : <Trans>Cancel</Trans>}
                    </button>
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
      {!orders.length ? (
        <div className={styles.spotTableEmpty}>{loading ? <Trans>Loading...</Trans> : emptyText}</div>
      ) : null}
    </div>
  );
}

function SpotTradesTable({
  trades,
  loading,
  emptyText,
}: {
  trades: SpotTradeRecord[];
  loading: boolean;
  emptyText: string;
}) {
  const { i18n } = useLingui();
  return (
    <div className={styles.spotTableWrap}>
      <table className={styles.spotTable}>
        <thead>
          <tr>
            <th><Trans>Market</Trans></th>
            <th><Trans>Side</Trans></th>
            <th><Trans>Price</Trans></th>
            <th><Trans>Amount</Trans></th>
            <th><Trans>Value</Trans></th>
            <th><Trans>Fee</Trans></th>
            <th><Trans>Role</Trans></th>
            <th><Trans>Date</Trans></th>
          </tr>
        </thead>
        <tbody>
          {trades.map((trade) => (
            <tr key={trade.trade_id || `${trade.order_id}-${trade.created_at}-${trade.price}`}>
              <td>{formatSpotSymbol(trade.symbol)}</td>
              <td className={trade.side === "buy" ? styles.spotSideBuyText : styles.spotSideSellText}>
                {formatSpotSide(trade.side, i18n)}
              </td>
              <td>{formatSpotCell(trade.price)}</td>
              <td>{formatSpotCell(trade.quantity)}</td>
              <td>{formatSpotValue(trade.price, trade.quantity)}</td>
              <td>{formatSpotFee(trade)}</td>
              <td>{trade.role ? formatSpotRole(trade.role, i18n) : "--"}</td>
              <td>{formatSpotTime(trade.created_at ?? trade.timestamp)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!trades.length ? (
        <div className={styles.spotTableEmpty}>{loading ? <Trans>Loading...</Trans> : emptyText}</div>
      ) : null}
    </div>
  );
}

type SpotI18n = ReturnType<typeof useLingui>["i18n"];

function getSpotBottomTabLabel(tab: SpotBottomTab, i18n: SpotI18n): string {
  if (tab === "Open Orders") return i18n._(t`Open Orders`);
  if (tab === "Order History") return i18n._(t`Order History`);
  return i18n._(t`Trade History`);
}

function formatSpotSide(side: string | undefined, i18n: SpotI18n): string {
  const normalized = String(side || "").toLowerCase();
  if (normalized === "buy") return i18n._(t`Buy`);
  if (normalized === "sell") return i18n._(t`Sell`);
  return titleCase(String(side || "--"));
}

function formatSpotOrderType(type: string | undefined, i18n: SpotI18n): string {
  const normalized = String(type || "").toLowerCase();
  if (normalized === "limit") return i18n._(t`Limit`);
  if (normalized === "market") return i18n._(t`Market`);
  return titleCase(String(type || "--"));
}

function formatSpotRole(role: string | undefined, i18n: SpotI18n): string {
  const normalized = String(role || "").toLowerCase();
  if (normalized === "maker") return i18n._(t`Maker`);
  if (normalized === "taker") return i18n._(t`Taker`);
  return titleCase(String(role || "--"));
}

function dedupeSpotOrders(orders: SpotOrderRecord[]): SpotOrderRecord[] {
  const seen = new Map<string, SpotOrderRecord>();
  for (const order of orders) {
    const id = getSpotOrderId(order) || `${order.symbol}-${order.created_at}-${order.price}-${order.quantity}`;
    seen.set(id, order);
  }
  return Array.from(seen.values()).sort((a, b) => toTimeMs(b.created_at) - toTimeMs(a.created_at));
}

function getSpotOrderId(order: SpotOrderRecord): string {
  return String(order.id || order.order_id || "");
}

function formatSpotSymbol(symbol: string): string {
  const key = normalizeSpotMarketKey(symbol);
  if (!key.endsWith("USDT")) return symbol || "--";
  return `${key.replace(/USDT$/, "")}/USDT`;
}

function formatSpotCell(value?: string | number | null): string {
  if (value === undefined || value === null || value === "") return "--";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return String(value);
  return numeric.toLocaleString(undefined, { maximumFractionDigits: 8 });
}

function formatSpotValue(price?: string, quantity?: string): string {
  const value = Number(price) * Number(quantity);
  if (!Number.isFinite(value) || value <= 0) return "--";
  return `${formatSpotCell(value)} USDT`;
}

function formatSpotFee(trade: SpotTradeRecord): string {
  if (!trade.fee) return "--";
  return `${formatSpotCell(trade.fee)} ${trade.fee_token || ""}`.trim();
}

function formatSpotStatus(status?: string): string {
  return titleCase(String(status || "--").replace(/_/g, " "));
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .map((part) => (part ? `${part[0].toUpperCase()}${part.slice(1)}` : part))
    .join(" ");
}

function formatSpotTime(value?: string | number | null): string {
  const ms = toTimeMs(value);
  if (!ms) return "--";
  return new Date(ms).toLocaleString(undefined, {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toTimeMs(value?: string | number | null): number {
  if (value === undefined || value === null || value === "") return 0;
  if (typeof value === "number") return value < 10_000_000_000 ? value * 1000 : value;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return numeric < 10_000_000_000 ? numeric * 1000 : numeric;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
