import { useChainId } from "lib/chains";

import { useAvailableToTradeAssetSettlementChain } from "components/TradingAccountModal/hooks";

export function useTradingAccountShowDepositButton() {
  const { srcChainId } = useChainId();
  const { apiAccountUsd, isTradingAccountLoading } = useAvailableToTradeAssetSettlementChain();
  const shouldShowDepositButton = !isTradingAccountLoading && apiAccountUsd === 0n && srcChainId !== undefined;

  return { shouldShowDepositButton };
}
