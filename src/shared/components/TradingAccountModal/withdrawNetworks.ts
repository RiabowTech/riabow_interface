import { getChainName } from "config/chains";

export function getWithdrawNetworksForSourceChains(sourceChains: number[]) {
  return sourceChains.map((sourceChainId) => {
    return {
      id: sourceChainId,
      name: getChainName(sourceChainId),
    };
  });
}

export function getWithdrawNetworks(params: { sourceChains: number[]; chainId: number; isTradeMode: boolean }) {
  const { sourceChains, chainId, isTradeMode } = params;

  if (isTradeMode) {
    return [
      {
        id: chainId,
        name: getChainName(chainId),
      },
    ];
  }

  return getWithdrawNetworksForSourceChains(sourceChains);
}
