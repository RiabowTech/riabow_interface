import { useMemo } from "react";

import { ContractsChainId, SourceChainId } from "sdk/configs/chains";
import { getTokensMap, getV2Tokens } from "sdk/configs/tokens";
import { USD_DECIMALS, expandDecimals } from "sdk/utils/numbers";
import { isTradeModeActive } from "@/modules/lighter/store/TradeStateContext/TradeStateContext";
import { getTradingUsdtAddress } from "config/custom/contracts";

import { TokensData } from "./types";
import { useAccountTokenBalances } from "./useAccountTokenBalances";
import { useOnchainTokenConfigs } from "./useOnchainTokenConfigs";
import { useTokenBalances } from "./useTokenBalances";
import { useTokenRecentPricesRequest } from "./useTokenRecentPricesData";
import { useTradingAccountTokenBalances } from "domain/multichain/useTradingAccountTokenBalances";

export type TokensDataResult = {
  tokensData: TokensData | undefined;
  pricesUpdatedAt: number | undefined;
  isAccountBalancesLoaded: boolean; // Renamed from isTradingAccountBalancesLoaded
  isTradingAccountBalancesLoaded: boolean; // Keep for backward compatibility
  isWalletBalancesLoaded: boolean;
  /**
   * If srcChainId is undefined, then this is the wallet balances loaded
   * If srcChainId is defined, then this is the account balances loaded (from REST API)
   */
  isBalancesLoaded: boolean;
  error: Error | undefined;
};

export function useTokensDataRequest(chainId: ContractsChainId, srcChainId?: SourceChainId): TokensDataResult {
  const tokenConfigs = getTokensMap(chainId);
  const { balancesData: walletBalancesData, error: walletBalancesError } = useTokenBalances(chainId);

  // In trade mode, use the synth-specific API client (custom/client)
  // Otherwise, use the generic API client
  const isTradeMode = isTradeModeActive();
  const genericAccountBalances = useAccountTokenBalances(chainId, { enabled: !isTradeMode });
  const tradingAccountBalances = useTradingAccountTokenBalances(chainId, { enabled: isTradeMode });
  const accountBalancesData = isTradeMode ? tradingAccountBalances.balancesData : genericAccountBalances.balancesData;
  const accountBalancesError = isTradeMode ? tradingAccountBalances.error : genericAccountBalances.error;

  const { pricesData, updatedAt: pricesUpdatedAt, error: pricesError } = useTokenRecentPricesRequest(chainId);
  const { data: onchainConfigsData, error: onchainConfigsError } = useOnchainTokenConfigs(chainId, {
    enabled: !isTradeMode,
  });

  const error = walletBalancesError || pricesError || onchainConfigsError || accountBalancesError;

  return useMemo((): TokensDataResult => {
    const tokenAddresses = getV2Tokens(chainId).map((token) => token.address);

    // For wallet balances, consider loaded if data exists (even if empty object)
    const isWalletBalancesLoaded = walletBalancesData !== undefined;
    // For account balances, consider loaded if not loading (empty object means loaded but no balances)
    // We need to check if the hook is still loading. Since useAccountTokenBalances doesn't expose isLoading,
    // we check if accountBalancesData is defined (even if it's an empty object, it means the request completed)
    const isAccountBalancesLoaded = accountBalancesData !== undefined;

    const isBalancesLoaded = srcChainId === undefined ? isWalletBalancesLoaded : isAccountBalancesLoaded;

    // Early return if pricesData is not available yet
    if (!pricesData) {
      return {
        tokensData: undefined,
        pricesUpdatedAt: undefined,
        isAccountBalancesLoaded: false,
        isTradingAccountBalancesLoaded: false,
        isWalletBalancesLoaded: false,
        isBalancesLoaded: false,
        error,
      };
    }
    return {
      tokensData: tokenAddresses.reduce((acc: TokensData, tokenAddress) => {
        const prices = pricesData[tokenAddress];
        const walletBalance = walletBalancesData?.[tokenAddress];
        // Try both original address and lowercase address for account balance matching
        // This handles cases where address formats differ (checksum vs lowercase)
        const accountBalanceRaw =
          accountBalancesData?.[tokenAddress] ||
          accountBalancesData?.[tokenAddress.toLowerCase()] ||
          accountBalancesData?.[tokenAddress.toUpperCase()];

        // In trade mode, accountBalanceRaw is { available, frozen, total }
        // In normal mode, it's bigint
        // Extract all balance fields
        let accountBalance: bigint | undefined;
        let frozenBalance: bigint | undefined;
        let totalBalance: bigint | undefined;

        if (accountBalanceRaw && typeof accountBalanceRaw === "object" && "available" in accountBalanceRaw) {
          // Trade mode: extract all three fields
          accountBalance = accountBalanceRaw.available;
          frozenBalance = accountBalanceRaw.frozen;
          totalBalance = accountBalanceRaw.total;
        } else {
          // Normal mode: single bigint value
          accountBalance = accountBalanceRaw as bigint | undefined;
        }

        const tokenConfig = tokenConfigs[tokenAddress];
        const onchainConfig = onchainConfigsData?.[tokenAddress];

        // Include token if it has prices OR if it has balances (even without prices)
        // This ensures tokens with balances are shown even if price data is missing
        const hasBalance = accountBalance !== undefined || walletBalance !== undefined;
        if (!prices && !hasBalance) {
          return acc;
        }

        // If no prices but has balance, create a default price structure
        // For USDT (stablecoin), use $1.00 as default price since it's pegged to USD
        let finalPrices = prices;
        if (!finalPrices && hasBalance) {
          // Check if this is USDT token
          const usdtAddress = getTradingUsdtAddress(chainId);
          const isUSDT = usdtAddress && tokenAddress.toLowerCase() === usdtAddress.toLowerCase();
          // Also check if token config indicates it's a stablecoin
          const isStablecoin = tokenConfig?.isStable === true || tokenConfig?.symbol?.toUpperCase() === "USDT";

          if (isUSDT || isStablecoin) {
            // Use $1.00 as default price for USDT and stablecoins
            // Price is stored with USD_DECIMALS (30 decimals)
            const defaultPrice = expandDecimals(1, USD_DECIMALS);
            finalPrices = {
              minPrice: defaultPrice,
              maxPrice: defaultPrice,
            };
          } else {
            // For non-stablecoins, use 0 price (will show as $0.00)
            finalPrices = {
              minPrice: 0n,
              maxPrice: 0n,
            };
          }
        }

        acc[tokenAddress] = {
          ...tokenConfig,
          ...onchainConfig,
          prices: finalPrices,
          walletBalance,
          accountBalance, // New account balance from REST API
          // Keep tradingAccountBalance for backward compatibility (same as accountBalance)
          tradingAccountBalance: accountBalance,
          // Use accountBalance if available, otherwise use walletBalance
          // For settlement chain, we want to show account balances (from REST API)
          balance: accountBalance !== undefined ? accountBalance : walletBalance,
          isAccount: accountBalance !== undefined, // New flag
          // Keep isTradingAccount for backward compatibility
          isTradingAccount: accountBalance !== undefined,
          // Trade mode: add frozen and total balances
          frozenBalance,
          totalBalance,
        };

        return acc;
      }, {} as TokensData),
      pricesUpdatedAt,
      isBalancesLoaded,
      isAccountBalancesLoaded,
      isTradingAccountBalancesLoaded: isAccountBalancesLoaded, // Keep for backward compatibility
      isWalletBalancesLoaded,
      error,
    };
  }, [
    walletBalancesData,
    chainId,
    error,
    accountBalancesData,
    onchainConfigsData,
    pricesData,
    pricesUpdatedAt,
    srcChainId,
    tokenConfigs,
  ]);
}
