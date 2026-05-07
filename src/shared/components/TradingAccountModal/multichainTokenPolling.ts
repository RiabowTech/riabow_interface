import type { Address } from "viem";

import type { ContractsChainId, SettlementChainId } from "config/chains";
import { fetchMultichainTokenBalances } from "@/modules/lighter/domain/multichain/fetchMultichainTokenBalances";
import { FREQUENT_UPDATE_INTERVAL } from "lib/timeConstants";

type MultichainBalanceState = {
  tokenBalances: Record<number, Record<string, bigint>> | undefined;
  isLoading: boolean;
};

export function startMultichainTokenBalancePolling(
  settlementChainId: ContractsChainId,
  account: Address,
  next: (state: MultichainBalanceState) => void
) {
  let tokenBalances: Record<number, Record<string, bigint>> | undefined;
  let isLoaded = false;

  const poll = () => {
    void fetchMultichainTokenBalances(settlementChainId as SettlementChainId, account, (chainId, tokensChainData) => {
      tokenBalances = { ...tokenBalances, [chainId]: tokensChainData };
      next({ tokenBalances, isLoading: isLoaded ? false : true });
    }).then((finalTokenBalances) => {
      if (!isLoaded) {
        isLoaded = true;
        next({ tokenBalances: finalTokenBalances, isLoading: false });
      }
    });
  };

  poll();
  const interval = window.setInterval(poll, FREQUENT_UPDATE_INTERVAL);

  return () => {
    window.clearInterval(interval);
  };
}
