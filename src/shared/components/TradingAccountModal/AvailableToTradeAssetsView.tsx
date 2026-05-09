import { MessageDescriptor } from "@lingui/core";
import { msg, t } from "@lingui/macro";
import cx from "classnames";
import { useMemo, useState } from "react";
import { useAccount } from "wagmi";

import { getChainName } from "config/chains";
import { isSettlementChain } from "config/multichain";
import { useTokensDataRequest } from "domain/synthetics/tokens";
import { isTradeModeActive } from "@/modules/lighter/store/TradeStateContext/TradeStateContext";
import { useChainId } from "lib/chains";
import { useLocalizedMap } from "lib/i18n";
import { formatUsd } from "lib/numbers";
import { convertToUsd, getMidPrice } from "sdk/utils/tokens";

import { Amount } from "components/Amount/Amount";
import Button from "components/Button/Button";
import SearchInput from "components/SearchInput/SearchInput";
import { VerticalScrollFadeContainer } from "components/TableScrollFade/VerticalScrollFade";
import TokenIcon from "components/TokenIcon/TokenIcon";

// Virtual chain ID used to represent Zanbara Account (off-chain balances)
const TRADING_ACCOUNT_CHAIN_ID = 0;

type FilterType = "all" | "tradingAccount" | "wallet";

const FILTERS: FilterType[] = ["all", "wallet", "tradingAccount"];

const FILTER_TITLE_MAP: Record<FilterType, MessageDescriptor> = {
  all: msg`All`,
  tradingAccount: msg`Zanbara Account`,
  wallet: msg`Wallet`,
};

type DisplayToken = {
  chainId: number;
  symbol: string;
  isTradingAccount: boolean;
  balance: bigint | undefined;
  balanceUsd: bigint | undefined;
  decimals: number;
  isStable: boolean | undefined;
};

const tokenSorter = (a: DisplayToken, b: DisplayToken): 1 | -1 | 0 => {
  if (a.balanceUsd !== undefined && b.balanceUsd === undefined) {
    return -1;
  }

  if (a.balanceUsd === undefined && b.balanceUsd !== undefined) {
    return 1;
  }

  if (a.balanceUsd !== undefined && b.balanceUsd !== undefined) {
    // sort by balanceUsd
    return b.balanceUsd - a.balanceUsd > 0n ? 1 : -1;
  }

  return 0;
};

const AssetsList = ({ tokens, noChainFilter }: { tokens: DisplayToken[]; noChainFilter?: boolean }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const titles = useLocalizedMap(FILTER_TITLE_MAP);

  const sortedFilteredTokens = useMemo(() => {
    const filteredTokens = tokens.filter((token) => {
      const matchesSearch = token.symbol.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesChainFilter =
        noChainFilter ||
        activeFilter === "all" ||
        (activeFilter === "tradingAccount" && token.isTradingAccount) ||
        (activeFilter === "wallet" && !token.isTradingAccount);

      return matchesSearch && matchesChainFilter;
    });

    return filteredTokens;
  }, [tokens, searchQuery, noChainFilter, activeFilter]);

  return (
    <div className="flex grow flex-col overflow-y-hidden pt-adaptive">
      <div className="mb-16 px-adaptive">
        <SearchInput value={searchQuery} setValue={setSearchQuery} noBorder />
      </div>

      {!noChainFilter && (
        <div className="mb-12 flex gap-4 px-adaptive">
          {FILTERS.map((filter) => (
            <Button
              key={filter}
              type="button"
              variant={activeFilter === filter ? "secondary" : "ghost"}
              size="small"
              className={cx({
                "!text-typography-primary": activeFilter === filter,
              })}
              onClick={() => setActiveFilter(filter)}
            >
              {titles[filter]}
            </Button>
          ))}
        </div>
      )}
      <VerticalScrollFadeContainer className="flex grow flex-col overflow-y-auto">
        {sortedFilteredTokens.map((displayToken) => (
          <div
            key={displayToken.symbol + "_" + displayToken.chainId}
            className="flex items-center justify-between px-adaptive py-8 app-hover:bg-fill-surfaceElevated50"
          >
            <div className="flex items-center gap-16">
              <TokenIcon symbol={displayToken.symbol} displaySize={40} chainIdBadge={displayToken.chainId} />
              <div>
                <div>{displayToken.symbol}</div>
                <div className="text-body-small text-slate-100">
                  {displayToken.chainId === TRADING_ACCOUNT_CHAIN_ID
                    ? t`Zanbara Account`
                    : getChainName(displayToken.chainId)}
                </div>
              </div>
            </div>
            <div className="text-right">
              <Amount
                className="text-body-large"
                amount={displayToken.balance}
                decimals={displayToken.decimals}
                isStable={displayToken.isStable}
              />
              <div className="text-body-small text-slate-100 numbers">{formatUsd(displayToken.balanceUsd)}</div>
            </div>
          </div>
        ))}
      </VerticalScrollFadeContainer>
    </div>
  );
};

// Trading-mode product requirement: only USDT is "available to trade".
// Other balances (USDC/ETH/etc.) belong to the wallet but cannot fund a trade.
const isTradableSymbol = (symbol: string) => !isTradeModeActive() || symbol === "USDT";

const AssetListMultichain = () => {
  const { chainId, srcChainId } = useChainId();
  const { tokensData } = useTokensDataRequest(chainId, srcChainId);

  const displayTokens = useMemo(() => {
    return Object.values(tokensData || {})
      .filter(
        (token) =>
          !token.isNative &&
          token.tradingAccountBalance !== 0n &&
          token.tradingAccountBalance !== undefined &&
          isTradableSymbol(token.symbol)
      )
      .map(
        (token): DisplayToken => ({
          chainId: TRADING_ACCOUNT_CHAIN_ID,
          symbol: token.symbol,
          isTradingAccount: true,
          balance: token.tradingAccountBalance,
          balanceUsd: convertToUsd(token.tradingAccountBalance, token.decimals, getMidPrice(token.prices)),
          decimals: token.decimals,
          isStable: token.isStable,
        })
      )
      .sort(tokenSorter);
  }, [tokensData]);

  return <AssetsList noChainFilter tokens={displayTokens} />;
};

const AssetListSettlementChain = () => {
  const { chainId, srcChainId } = useChainId();
  const { tokensData } = useTokensDataRequest(chainId, srcChainId);

  const displayTokens = useMemo(() => {
    const displayTokens: DisplayToken[] = Object.values(tokensData || {})
      .filter((tokenData) => isTradableSymbol(tokenData.symbol))
      .flatMap((tokenData): DisplayToken[] => [
        {
          ...tokenData,
          isTradingAccount: true,
          balance: tokenData.tradingAccountBalance,
          balanceUsd: convertToUsd(tokenData.tradingAccountBalance, tokenData.decimals, getMidPrice(tokenData.prices)),
          chainId: TRADING_ACCOUNT_CHAIN_ID,
          isStable: tokenData.isStable,
        },
        {
          ...tokenData,
          isTradingAccount: false,
          balance: tokenData.walletBalance,
          balanceUsd: convertToUsd(tokenData.walletBalance, tokenData.decimals, getMidPrice(tokenData.prices)),
          chainId: chainId,
          isStable: tokenData.isStable,
        },
      ])
      .filter((token) => token.balance !== undefined && token.balance > 0n)
      .sort(tokenSorter);

    return displayTokens;
  }, [chainId, tokensData]);

  return <AssetsList tokens={displayTokens} />;
};

export const AvailableToTradeAssetsView = () => {
  const { chainId } = useAccount();

  return isSettlementChain(chainId!) ? <AssetListSettlementChain /> : <AssetListMultichain />;
};
