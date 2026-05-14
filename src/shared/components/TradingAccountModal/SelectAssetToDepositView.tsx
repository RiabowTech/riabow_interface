import { Trans } from "@lingui/macro";
import cx from "classnames";
import { useMemo, useState } from "react";
import { Address, erc20Abi } from "viem";
import { useAccount, useReadContracts } from "wagmi";

import { getChainName } from "config/chains";
import { getChainIcon } from "config/icons";
import {
  useTradingAccountDepositViewChain,
  useTradingAccountDepositViewTokenAddress,
  useTradingAccountModalOpen,
} from "@/modules/lighter/context/TradingAccountContext";
import { TokenChainData } from "@/modules/lighter/domain/multichain/types";
import { useWalletTokensConfig } from "@/modules/lighter/api/custom/walletTokens";
import { formatUsd } from "lib/numbers";
import { convertToUsd, getMidPrice } from "sdk/utils/tokens";

import { Amount } from "components/Amount/Amount";
import Button from "components/Button/Button";
import SearchInput from "components/SearchInput/SearchInput";
import { ButtonRowScrollFadeContainer } from "components/TableScrollFade/TableScrollFade";
import { VerticalScrollFadeContainer } from "components/TableScrollFade/VerticalScrollFade";
import TokenIcon from "components/TokenIcon/TokenIcon";

type TokenListItemProps = {
  tokenChainData: DisplayTokenChainData;
  onClick?: () => void;
  className?: string;
};

const TokenListItem = ({ tokenChainData, onClick, className }: TokenListItemProps) => {
  return (
    <div
      key={tokenChainData.symbol + "_" + tokenChainData.sourceChainId}
      className={cx(
        "flex cursor-pointer items-center justify-between px-adaptive py-8 app-hover:bg-fill-surfaceElevated50",
        className
      )}
      onClick={onClick}
    >
      <div className="flex items-center gap-16">
        <TokenIcon symbol={tokenChainData.symbol} displaySize={40} chainIdBadge={tokenChainData.sourceChainId} />
        <div>
          <div className="text-body-large">{tokenChainData.symbol}</div>
          <div className="text-body-small text-typography-secondary">{getFundingChainName(tokenChainData.sourceChainId)}</div>
        </div>
      </div>
      <div className="text-right">
            <Amount
              className="text-body-large"
              amount={tokenChainData.sourceChainBalance}
              decimals={tokenChainData.sourceChainDecimals}
              isStable={tokenChainData.isStable}
              showZero
            />
        <div className="text-body-small text-typography-secondary">
          {tokenChainData.sourceChainBalanceUsd > 0n ? formatUsd(tokenChainData.sourceChainBalanceUsd) : "-"}
        </div>
      </div>
    </div>
  );
};

type DisplayTokenChainData = TokenChainData & {
  sourceChainBalanceUsd: bigint;
};

function getFundingChainName(chainId: number) {
  if (chainId === 97) {
    return "BNB Testnet";
  }
  return getChainName(chainId);
}

function getFundingChainIcon(chainId: number) {
  try {
    return getChainIcon(chainId);
  } catch (_error) {
    return undefined;
  }
}

function getTokenConfigKey(chainId: number, address: string) {
  return `${chainId}:${address.toLowerCase()}`;
}

export const SelectAssetToDepositView = () => {
  const { address: account } = useAccount();
  const [, setIsVisibleOrView] = useTradingAccountModalOpen();
  const [, setDepositViewChain] = useTradingAccountDepositViewChain();
  const [, setDepositViewTokenAddress] = useTradingAccountDepositViewTokenAddress();

  const [selectedNetwork, setSelectedNetwork] = useState<number | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");

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
  const configuredBalanceByToken = useMemo(() => {
    const balances = new Map<string, bigint>();
    walletTokenConfigs?.forEach((token, index) => {
      const result = configuredBalanceResults?.[index];
      if (result?.status === "success" && typeof result.result === "bigint") {
        balances.set(getTokenConfigKey(token.chainId, token.contract), result.result);
      }
    });
    return balances;
  }, [configuredBalanceResults, walletTokenConfigs]);

  // Deposit assets MUST come from backend `walletTokenConfigs` — it encodes
  // the only (chain, token) tuples this app can actually credit. The legacy
  // multichain array fallback exposed unsupported chains/tokens (e.g.
  // BSC USDT on a settlement chain that doesn't accept it) and caused a
  // production fund-loss incident on sibling forks. While the config is
  // loading or empty, render nothing rather than risk surfacing a bad option.
  const tokenChainDataArray = useMemo(() => {
    if (!walletTokenConfigs || walletTokenConfigs.length === 0) {
      return [];
    }

    return walletTokenConfigs.map(
      (token): TokenChainData => ({
        name: token.symbol,
        symbol: token.symbol,
        decimals: token.decimals,
        address: token.contract,
        isStable: token.symbol.toUpperCase().includes("USD"),
        imageUrl: token.image || undefined,
        sourceChainId: token.chainId as TokenChainData["sourceChainId"],
        sourceChainDecimals: token.decimals,
        sourceChainPrices: undefined,
        sourceChainBalance: configuredBalanceByToken.get(getTokenConfigKey(token.chainId, token.contract)) ?? 0n,
      })
    );
  }, [configuredBalanceByToken, walletTokenConfigs]);

  const NETWORKS_FILTER = useMemo(() => {
    const wildCard = { id: "all" as const, name: "All Networks" };

    const seen = new Set<number>();
    const chainFilters = tokenChainDataArray
      .map((token) => Number(token.sourceChainId))
      .filter((sourceChainId) => {
        if (!Number.isFinite(sourceChainId) || seen.has(sourceChainId)) {
          return false;
        }
        seen.add(sourceChainId);
        return true;
      })
      .map((sourceChainId) => ({
        id: sourceChainId,
        name: getFundingChainName(sourceChainId),
      }));

    return [wildCard, ...chainFilters];
  }, [tokenChainDataArray]);

  const filteredBalances: DisplayTokenChainData[] = useMemo(() => {
    return tokenChainDataArray
      .filter((tokenChainData) => {
        const matchesSearch = tokenChainData.symbol.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesNetwork = selectedNetwork === "all" || tokenChainData.sourceChainId === selectedNetwork;
        return matchesSearch && matchesNetwork;
      })
      .map((tokenChainData) => {
        let balanceUsd = 0n;

        if (tokenChainData.sourceChainPrices) {
          balanceUsd =
            convertToUsd(
              tokenChainData.sourceChainBalance,
              tokenChainData.sourceChainDecimals,
              getMidPrice(tokenChainData.sourceChainPrices)
            ) ?? 0n;
        }

        return {
          ...tokenChainData,
          sourceChainBalanceUsd: balanceUsd,
        };
      })
      .sort((a, b) => {
        if (a.sourceChainBalanceUsd === b.sourceChainBalanceUsd) {
          return 0;
        }

        return a.sourceChainBalanceUsd > b.sourceChainBalanceUsd ? -1 : 1;
      });
  }, [tokenChainDataArray, searchQuery, selectedNetwork]);

  return (
    <div className="flex grow flex-col overflow-y-hidden">
      <div className="mb-16 px-adaptive pt-adaptive">
        <SearchInput value={searchQuery} setValue={(value) => setSearchQuery(value)} noBorder />
      </div>

      <div className="mb-12 px-adaptive">
        <ButtonRowScrollFadeContainer>
          <div className="flex gap-4">
            {NETWORKS_FILTER.map((network) => (
              <Button
                key={network.id}
                type="button"
                variant={selectedNetwork === network.id ? "secondary" : "ghost"}
                size="small"
                className={cx("whitespace-nowrap", {
                  "!text-typography-primary": selectedNetwork === network.id,
                })}
                onClick={() => setSelectedNetwork(network.id as number | "all")}
                imgSrc={network.id !== "all" ? getFundingChainIcon(network.id) : undefined}
                imgClassName="size-16 !mr-4"
              >
                {network.name}
              </Button>
            ))}
          </div>
        </ButtonRowScrollFadeContainer>
      </div>

      <VerticalScrollFadeContainer className="flex grow flex-col overflow-y-auto">
        {filteredBalances.map((tokenChainData) => (
          <TokenListItem
            key={tokenChainData.symbol + "_" + tokenChainData.sourceChainId}
            tokenChainData={tokenChainData}
            onClick={() => {
              setDepositViewChain(tokenChainData.sourceChainId);
              setDepositViewTokenAddress(tokenChainData.address);
              setIsVisibleOrView("deposit");
            }}
          />
        ))}
        {filteredBalances.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-8 p-adaptive text-typography-secondary">
            {selectedNetwork === "all" ? (
              <Trans>No assets are available for deposit</Trans>
            ) : (
              <Trans>No eligible tokens available on {getFundingChainName(selectedNetwork)} for deposit</Trans>
            )}
          </div>
        )}
      </VerticalScrollFadeContainer>
    </div>
  );
};
