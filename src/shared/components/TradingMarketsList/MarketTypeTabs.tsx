/**
 * MarketTypeTabs - Dynamic market type tabs
 *
 * 与 TradeBox 订单类型一致：Primit 用普通 block Tab（底部分割线 + 指示条），Legacy 用 inline；
 * 容器背景与下拉内表头同为 slate-900。
 */

import type { MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/macro";
import { useLingui } from "@lingui/react";
import cx from "classnames";
import { useMemo } from "react";

import type { TradingMarket } from "@/modules/lighter/api/custom/useTradingMarkets";
import type { TokenFavoritesTabOption } from "@/modules/lighter/store/TokensFavoritesContext/TokensFavoritesContextProvider";
import { useDesignSystem } from "shared/context/DesignSystemContext/DesignSystemContext";
import { Tabs } from "shared/ui";


const MARKET_TYPE_MSG: Record<string, MessageDescriptor> = {
  all: msg`All`,
  favorites: msg`Favorites`,
  layer1: msg`Layer 1`,
  layer2: msg`Layer 2`,
  defi: msg`DeFi`,
  meme: msg`Meme`,
  ai: msg`AI`,
  rwa: msg`RWA`,
};

interface MarketTypeTabsProps {
  markets: TradingMarket[];
  selectedTab: string;
  onTabChange: (tab: TokenFavoritesTabOption) => void;
  showFavorites?: boolean;
  className?: string;
}

export function MarketTypeTabs({
  markets,
  selectedTab,
  onTabChange,
  showFavorites = true,
  className,
}: MarketTypeTabsProps) {
  const { i18n } = useLingui();
  const { isPrimit } = useDesignSystem();

  const marketTypes = useMemo(() => {
    const types = new Set<string>();
    markets.forEach((market) => {
      if (market.type) {
        types.add(market.type);
      }
    });
    return Array.from(types).sort();
  }, [markets]);

  const tabOptionValues = useMemo(() => {
    const options: string[] = ["all"];
    if (showFavorites) {
      options.push("favorites");
    }
    options.push(...marketTypes);
    return options;
  }, [marketTypes, showFavorites]);

  const tabsOptions = useMemo(
    () =>
      tabOptionValues.map((value) => ({
        value,
        label: MARKET_TYPE_MSG[value]
          ? i18n._(MARKET_TYPE_MSG[value])
          : value.charAt(0).toUpperCase() + value.slice(1),
      })),
    [tabOptionValues, i18n],
  );

  const usePrimitBlock = isPrimit;

  return (
    <div className={cx("min-w-0 bg-slate-900", className)}>
      <Tabs
        options={tabsOptions}
        selectedValue={selectedTab}
        onChange={(v) => onTabChange(v as TokenFavoritesTabOption)}
        type={usePrimitBlock ? "block" : "inline"}
        qa="trade-market-type-tabs"
        className={cx("bg-slate-900 text-13", usePrimitBlock && "min-w-0 !rounded-none")}
        regularOptionClassname={
          usePrimitBlock ? "min-w-0 shrink-0 whitespace-nowrap px-8" : "shrink-0 whitespace-nowrap"
        }
      />
    </div>
  );
}
