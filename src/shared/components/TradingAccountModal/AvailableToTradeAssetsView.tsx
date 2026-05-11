import { MessageDescriptor } from "@lingui/core";
import { msg, t } from "@lingui/macro";
import cx from "classnames";
import { useMemo, useState } from "react";
import { Address, erc20Abi, parseUnits } from "viem";
import { useAccount, useReadContracts } from "wagmi";

import { useZanbaraBalancesForProduct } from "@/modules/lighter/api";
import { findWalletTokenConfig, useWalletTokensConfig } from "@/modules/lighter/api/custom/walletTokens";
import { getChainName } from "config/chains";
import { DEFAULT_SPOT_CHAIN_ID } from "config/custom/contracts";
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

// Virtual chain ID used to represent Futures account (off-chain balances)
const TRADING_ACCOUNT_CHAIN_ID = 0;

type FilterType = "all" | "arb" | "bsc" | "futures" | "spot";

const FILTERS: FilterType[] = ["all", "arb", "bsc", "futures", "spot"];

const FILTER_TITLE_MAP: Record<FilterType, MessageDescriptor> = {
  all: msg`ALL`,
  arb: msg`Arb`,
  bsc: msg`BSC`,
  futures: msg`Futures`,
  spot: msg`Spot`,
};

type DisplayToken = {
  chainId: number;
  symbol: string;
  source: Exclude<FilterType, "all">;
  isTradingAccount: boolean;
  isSpotAccount?: boolean;
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

function getWalletSource(chainId: number): Exclude<FilterType, "all" | "futures" | "spot"> {
  return chainId === DEFAULT_SPOT_CHAIN_ID ? "bsc" : "arb";
}

function getAssetSourceLabel(token: DisplayToken) {
  if (token.source === "futures") {
    return t`Futures`;
  }

  if (token.source === "spot") {
    return t`Spot`;
  }

  if (token.source === "bsc") {
    return "BSC";
  }

  return getChainName(token.chainId) || "Arb";
}

const AssetsList = ({ tokens, noChainFilter }: { tokens: DisplayToken[]; noChainFilter?: boolean }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const titles = useLocalizedMap(FILTER_TITLE_MAP);

  const sortedFilteredTokens = useMemo(() => {
    const seenKeys = new Set<string>();
    const uniqueTokens = tokens.filter((token) => {
      const key = `${token.source}:${token.chainId}:${token.symbol.toUpperCase()}`;

      if (seenKeys.has(key)) {
        return false;
      }

      seenKeys.add(key);
      return true;
    });

    const filteredTokens = uniqueTokens.filter((token) => {
      const matchesSearch = token.symbol.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesChainFilter =
        noChainFilter ||
        activeFilter === "all" ||
        activeFilter === token.source;

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
            key={`${displayToken.source}_${displayToken.symbol}_${displayToken.chainId}`}
            className="flex items-center justify-between px-adaptive py-8 app-hover:bg-fill-surfaceElevated50"
          >
            <div className="flex items-center gap-16">
              <TokenIcon
                symbol={displayToken.symbol}
                displaySize={40}
                chainIdBadge={displayToken.isTradingAccount ? undefined : displayToken.chainId}
              />
              <div>
                <div>{displayToken.symbol}</div>
                <div className="text-body-small text-slate-100">
                  {getAssetSourceLabel(displayToken)}
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

function parseBalanceAmount(value: string | undefined, decimals: number) {
  try {
    return parseUnits(value || "0", decimals);
  } catch (_error) {
    return 0n;
  }
}

function getTokenConfigKey(chainId: number, address: string) {
  return `${chainId}:${address.toLowerCase()}`;
}

function useConfiguredWalletDisplayTokens(currentChainId: number) {
  const { address: account } = useAccount();
  const { data: walletTokenConfigs } = useWalletTokensConfig();
  const configuredBalanceContracts = useMemo(
    () =>
      walletTokenConfigs?.map((token) => ({
        address: token.contract as Address,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [account as Address],
        chainId: token.chainId,
      })) ?? [],
    [account, walletTokenConfigs]
  );
  const { data: configuredBalanceResults } = useReadContracts({
    contracts: configuredBalanceContracts,
    query: {
      enabled: Boolean(account && configuredBalanceContracts.length > 0),
    },
  });

  return useMemo(() => {
    const balances = new Map<string, bigint>();

    walletTokenConfigs?.forEach((token, index) => {
      const result = configuredBalanceResults?.[index];
      if (result?.status === "success" && typeof result.result === "bigint") {
        balances.set(getTokenConfigKey(token.chainId, token.contract), result.result);
      }
    });

    return (walletTokenConfigs ?? [])
      .filter((token) => token.chainId !== currentChainId)
      .map((token): DisplayToken | undefined => {
        const balance = balances.get(getTokenConfigKey(token.chainId, token.contract)) ?? 0n;

        if (balance <= 0n) {
          return undefined;
        }

        const symbol = token.symbol.toUpperCase();
        const isStable = symbol.includes("USD");

        return {
          chainId: token.chainId,
          symbol: token.symbol,
          source: getWalletSource(token.chainId),
          isTradingAccount: false,
          balance,
          balanceUsd: isStable ? (balance * 10n ** 30n) / 10n ** BigInt(token.decimals) : undefined,
          decimals: token.decimals,
          isStable,
        };
      })
      .filter((token): token is DisplayToken => token !== undefined);
  }, [configuredBalanceResults, currentChainId, walletTokenConfigs]);
}

function useSpotDisplayTokens() {
  const { chainId } = useChainId();
  const { data: walletTokenConfigs } = useWalletTokensConfig();
  const { data: spotBalances } = useZanbaraBalancesForProduct("spot", chainId, {
    refreshInterval: 10000,
  });

  return useMemo(() => {
    return (spotBalances?.balances ?? [])
      .map((balance): DisplayToken | undefined => {
        const symbol = balance.symbol || balance.token;
        const tokenConfig = findWalletTokenConfig(walletTokenConfigs, DEFAULT_SPOT_CHAIN_ID, symbol);
        const decimals = tokenConfig?.decimals ?? 18;
        const total = parseBalanceAmount(balance.total, decimals);

        if (total <= 0n) {
          return undefined;
        }

        return {
          chainId: DEFAULT_SPOT_CHAIN_ID,
          symbol,
          source: "spot",
          isTradingAccount: false,
          isSpotAccount: true,
          balance: total,
          balanceUsd: symbol.toUpperCase() === "USDT" ? parseBalanceAmount(balance.total, 30) : undefined,
          decimals,
          isStable: symbol.toUpperCase() === "USDT",
        };
      })
      .filter((token): token is DisplayToken => token !== undefined);
  }, [spotBalances?.balances, walletTokenConfigs]);
}

function useConfiguredCurrentChainSymbols(currentChainId: number) {
  const { data: walletTokenConfigs } = useWalletTokensConfig();

  return useMemo(() => {
    if (!walletTokenConfigs) {
      return undefined;
    }

    return new Set(
      walletTokenConfigs
        .filter((token) => token.chainId === currentChainId)
        .map((token) => token.symbol.toUpperCase())
    );
  }, [currentChainId, walletTokenConfigs]);
}

const AssetListMultichain = () => {
  const { chainId, srcChainId } = useChainId();
  const { tokensData } = useTokensDataRequest(chainId, srcChainId);
  const spotDisplayTokens = useSpotDisplayTokens();
  const configuredWalletDisplayTokens = useConfiguredWalletDisplayTokens(chainId);

  const displayTokens = useMemo(() => {
    const tradingAccountTokens = Object.values(tokensData || {})
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
          source: "futures",
          isTradingAccount: true,
          balance: token.tradingAccountBalance,
          balanceUsd: convertToUsd(token.tradingAccountBalance, token.decimals, getMidPrice(token.prices)),
          decimals: token.decimals,
          isStable: token.isStable,
        })
      )
      .sort(tokenSorter);

    return [...configuredWalletDisplayTokens, ...spotDisplayTokens, ...tradingAccountTokens].sort(tokenSorter);
  }, [configuredWalletDisplayTokens, spotDisplayTokens, tokensData]);

  return <AssetsList tokens={displayTokens} />;
};

const AssetListSettlementChain = () => {
  const { chainId, srcChainId } = useChainId();
  const { tokensData } = useTokensDataRequest(chainId, srcChainId);
  const spotDisplayTokens = useSpotDisplayTokens();
  const configuredWalletDisplayTokens = useConfiguredWalletDisplayTokens(chainId);
  const configuredCurrentChainSymbols = useConfiguredCurrentChainSymbols(chainId);

  const displayTokens = useMemo(() => {
    const displayTokens: DisplayToken[] = Object.values(tokensData || {})
      .filter((tokenData) => isTradableSymbol(tokenData.symbol))
      .flatMap((tokenData): DisplayToken[] => [
        {
          ...tokenData,
          source: "futures",
          isTradingAccount: true,
          balance: tokenData.tradingAccountBalance,
          balanceUsd: convertToUsd(tokenData.tradingAccountBalance, tokenData.decimals, getMidPrice(tokenData.prices)),
          chainId: TRADING_ACCOUNT_CHAIN_ID,
          isStable: tokenData.isStable,
        },
        {
          ...tokenData,
          source: getWalletSource(chainId),
          isTradingAccount: false,
          balance: tokenData.walletBalance,
          balanceUsd: convertToUsd(tokenData.walletBalance, tokenData.decimals, getMidPrice(tokenData.prices)),
          chainId: chainId,
          isStable: tokenData.isStable,
        },
      ])
      .filter((token) => token.balance !== undefined && token.balance > 0n)
      .filter(
        (token) =>
          token.isTradingAccount ||
          configuredCurrentChainSymbols === undefined ||
          configuredCurrentChainSymbols.has(token.symbol.toUpperCase())
      )
      .sort(tokenSorter);

    return [...configuredWalletDisplayTokens, ...spotDisplayTokens, ...displayTokens].sort(tokenSorter);
  }, [chainId, configuredCurrentChainSymbols, configuredWalletDisplayTokens, spotDisplayTokens, tokensData]);

  return <AssetsList tokens={displayTokens} />;
};

export const AvailableToTradeAssetsView = () => {
  const { chainId } = useAccount();

  return isSettlementChain(chainId!) ? <AssetListSettlementChain /> : <AssetListMultichain />;
};
