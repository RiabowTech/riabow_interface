import useSWRSubscription, { SWRSubscription } from "swr/subscription";
import { useAccount } from "wagmi";

import type { SettlementChainId } from "config/chains";
import { executeMulticall } from "lib/multicall";
import { CONFIG_UPDATE_INTERVAL } from "lib/timeConstants";

import {
  buildTradingAccountTokenBalancesRequest,
  parseTradingAccountTokenBalancesData,
} from "./tradingAccountTokenBalancesMulticallRequest";

const subscribeEmptyTradingAccounts: SWRSubscription<
  [name: string, chainIds: SettlementChainId[], account: string],
  {
    emptyTradingAccounts: Partial<Record<SettlementChainId, boolean>>;
    isLoading: boolean;
  }
> = (key, options) => {
  const [, chainIds, account] = key as [string, SettlementChainId[], string];

  const emptyTradingAccounts: Partial<Record<SettlementChainId, boolean>> = {};
  let isLoaded = false;
  const didLoadMap: Partial<Record<SettlementChainId, boolean>> = {};

  function fetchEmptyTradingAccounts() {
    const requests = chainIds.map(async (chainId) => {
      const req = buildTradingAccountTokenBalancesRequest(chainId, account);
      const res = await executeMulticall(chainId, req, didLoadMap[chainId] ? "background" : "urgent");
      const parsedRes = parseTradingAccountTokenBalancesData(res);
      let isEmpty = true;
      for (const balance of Object.values(parsedRes)) {
        if (balance > 0n) {
          isEmpty = false;
          break;
        }
      }

      emptyTradingAccounts[chainId] = isEmpty;
      didLoadMap[chainId] = true;

      options.next(null, { emptyTradingAccounts, isLoading: !isLoaded });
    });

    Promise.all(requests).then(() => {
      if (!isLoaded) {
        isLoaded = true;
        options.next(null, { emptyTradingAccounts, isLoading: !isLoaded });
      }
    });
  }

  fetchEmptyTradingAccounts();
  const interval = window.setInterval(() => {
    fetchEmptyTradingAccounts();
  }, CONFIG_UPDATE_INTERVAL);

  return () => {
    window.clearInterval(interval);
  };
};

export function useEmptyTradingAccounts(chainIds: SettlementChainId[] | undefined): {
  emptyTradingAccounts: Partial<Record<SettlementChainId, boolean>> | undefined;
  isLoading: boolean;
} {
  const { address: account } = useAccount();

  const { data } = useSWRSubscription(
    account && chainIds && chainIds.length > 0 ? ["emptyTradingAccounts", chainIds, account] : null,
    subscribeEmptyTradingAccounts
  );
  const emptyTradingAccounts = data?.emptyTradingAccounts;
  const isLoading = data?.isLoading;

  return {
    emptyTradingAccounts,
    isLoading: isLoading ?? true,
  };
}
