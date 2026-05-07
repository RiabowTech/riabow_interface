import { useCallback } from "react";

import type { SourceChainId } from "config/chains";

import {
  useTradingAccountDepositViewChain,
  useTradingAccountDepositViewTokenAddress,
  useTradingAccountModalOpen,
} from "./hooks";

export function useOpenMultichainDepositModal(): (tokenAddress: string, chainId: SourceChainId) => void {
  const [, setIsVisibleOrView] = useTradingAccountModalOpen();
  const [, setDepositViewChain] = useTradingAccountDepositViewChain();
  const [, setDepositViewTokenAddress] = useTradingAccountDepositViewTokenAddress();

  const onDepositTokenAddress = useCallback(
    (tokenAddress: string, chainId: SourceChainId) => {
      setDepositViewChain(chainId);
      setDepositViewTokenAddress(tokenAddress);
      setIsVisibleOrView("deposit");
    },
    [setDepositViewChain, setDepositViewTokenAddress, setIsVisibleOrView]
  );

  return onDepositTokenAddress;
}
