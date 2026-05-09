import { useMemo, useRef } from "react";
import { useLocation } from "react-router-dom";

import { getMarketAddressFromSymbol, getTradingUsdtAddress } from "config/custom/contracts";
import { metrics, TickersErrorsCounter, TickersPartialDataCounter } from "lib/metrics";
import { registerOracleKeeperFailure, useOracleKeeperFetcher } from "lib/oracleKeeperFetcher/useOracleKeeperFetcher";
import { LEADERBOARD_PRICES_UPDATE_INTERVAL, PRICES_CACHE_TTL, PRICES_UPDATE_INTERVAL } from "lib/timeConstants";
import { ARBITRUM_SEPOLIA } from "sdk/configs/chainIds";
import { getToken, getWrappedToken, NATIVE_TOKEN_ADDRESS } from "sdk/configs/tokens";
import type { Token } from "sdk/types/tokens";

import { TokenPricesData } from "./types";
import { useSequentialTimedSWR } from "./useSequentialTimedSWR";
import { parseContractPrice } from "./utils";

export type TokenPricesDataResult = {
  pricesData?: TokenPricesData;
  updatedAt?: number;
  error?: Error;
  isPriceDataLoading: boolean;
};

export function useTokenRecentPricesRequest(chainId: number): TokenPricesDataResult {
  const oracleKeeperFetcher = useOracleKeeperFetcher(chainId);
  const pathname = useLocation().pathname;

  // TODO temp workaround
  const refreshPricesInterval = useMemo(() => {
    return pathname.startsWith("/leaderboard") ? LEADERBOARD_PRICES_UPDATE_INTERVAL : PRICES_UPDATE_INTERVAL;
  }, [pathname]);

  const pricesCacheRef = useRef<TokenPricesData>({});
  const pricesCacheUpdatedRef = useRef<{ [address: string]: number }>({});

  const { data, error, isLoading } = useSequentialTimedSWR([chainId, oracleKeeperFetcher.url, "useTokenRecentPrices"], {
    refreshInterval: refreshPricesInterval,

    keepPreviousData: true,

    fetcher: async ([chainId]) => {
      const result: TokenPricesData = {};

      let priceItems = await oracleKeeperFetcher.fetchTickers().catch(() => {
        metrics.pushCounter<TickersErrorsCounter>("tickersErrors");
        return [];
      });

      priceItems.forEach((priceItem) => {
        let tokenConfig: Token;

        try {
          tokenConfig = getToken(chainId, priceItem.tokenAddress);
        } catch (e) {
          // ignore unknown token errors

          return;
        }

        result[tokenConfig.address] = {
          minPrice: parseContractPrice(BigInt(priceItem.minPrice), tokenConfig.decimals),
          maxPrice: parseContractPrice(BigInt(priceItem.maxPrice), tokenConfig.decimals),
        };

        // Update cache of new received tokens
        pricesCacheRef.current[tokenConfig.address] = result[tokenConfig.address];
        pricesCacheUpdatedRef.current[tokenConfig.address] = Date.now();
      });

      const hasPartialData = Object.keys(result).length < Object.keys(pricesCacheRef.current).length;

      if (hasPartialData) {
        // eslint-disable-next-line no-console
        console.warn("tickersPartialData");
        metrics.pushCounter<TickersPartialDataCounter>("tickersPartialData");
        registerOracleKeeperFailure(chainId, "tickers");

        Object.keys(pricesCacheUpdatedRef.current).forEach((address) => {
          const cacheUpdatedAt = pricesCacheUpdatedRef.current[address];
          const canUseCache = cacheUpdatedAt && Date.now() - cacheUpdatedAt < PRICES_CACHE_TTL;

          if (!result[address] && canUseCache) {
            result[address] = pricesCacheRef.current[address];
          }
        });
      }

      const wrappedToken = getWrappedToken(chainId);

      if (result[wrappedToken.address] && !result[NATIVE_TOKEN_ADDRESS]) {
        result[NATIVE_TOKEN_ADDRESS] = result[wrappedToken.address];
      }

      // Inject stable token price ($1) for Arbitrum Sepolia
      // This stable token is pegged to $1, Oracle Keeper doesn't have its price
      const protocolStableAddress = getMarketAddressFromSymbol(chainId, "ZANBARA-USD") ||
                           getMarketAddressFromSymbol(chainId, "ZANBARAUSDT");
      if (chainId === ARBITRUM_SEPOLIA && protocolStableAddress && !result[protocolStableAddress]) {
        // Price format: $1 = 1e30 (30 decimal precision standard)
        const stablePrice = BigInt("1000000000000000000000000000000"); // 1e30 = $1
        result[protocolStableAddress] = {
          minPrice: stablePrice,
          maxPrice: stablePrice,
        };
      }

      // Inject USDT stable price ($1) for Arbitrum Sepolia
      // USDT is a stablecoin pegged to $1, ensure it has a price so it appears in "Available to Trade"
      const USDT_ADDRESS_ARBITRUM_SEPOLIA = getTradingUsdtAddress(chainId);
      if (chainId === ARBITRUM_SEPOLIA && USDT_ADDRESS_ARBITRUM_SEPOLIA && !result[USDT_ADDRESS_ARBITRUM_SEPOLIA]) {
        // Price format: $1 = 1e30 (30 decimal precision standard)
        const usdtPrice = BigInt("1000000000000000000000000000000"); // 1e30 = $1
        result[USDT_ADDRESS_ARBITRUM_SEPOLIA] = {
          minPrice: usdtPrice,
          maxPrice: usdtPrice,
        };
      }

      return {
        pricesData: result,
        updatedAt: Date.now(),
      };
    },
  });

  return {
    pricesData: data?.pricesData,
    updatedAt: data?.updatedAt,
    error,
    isPriceDataLoading: isLoading,
  };
}
