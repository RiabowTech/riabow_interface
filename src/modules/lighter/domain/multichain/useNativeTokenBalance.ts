import { AnyChainId } from "config/chains";
import { tryGetContract } from "config/contracts";
import { MULTICALLS_MAP } from "config/multichain";
import { useMulticall } from "lib/multicall";

export function getNativeTokenBalanceMulticallAddress(chainId: AnyChainId | undefined) {
  if (!chainId) {
    return undefined;
  }

  return MULTICALLS_MAP[chainId as keyof typeof MULTICALLS_MAP] ?? tryGetContract(chainId as any, "Multicall");
}

export function useNativeTokenBalance(chainId: AnyChainId | undefined, account: string | undefined) {
  const multicallAddress = getNativeTokenBalanceMulticallAddress(chainId);

  const query = useMulticall(chainId, "useNativeTokenBalance", {
    key: account && chainId && multicallAddress ? [chainId] : null,
    request: {
      balance: {
        abiId: "Multicall",
        contractAddress: multicallAddress!,
        calls: {
          balance: {
            methodName: "getEthBalance",
            params: [account!],
          },
        },
      },
    },
    parseResponse: (response) => {
      return response.data.balance.balance.returnValues[0] as bigint;
    },
  });

  return query.data;
}
