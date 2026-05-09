import useSWR from "swr";

import { DEFAULT_CHAIN_ID } from "config/chains";
import { getTradingBackendUrl } from "config/backend";

export interface WalletTokenConfig {
  symbol: string;
  image?: string;
  decimals: number;
  chainId: number;
  contract: string;
}

interface WalletTokensResponse {
  success: boolean;
  data?: WalletTokenConfig[];
  error?: unknown;
}

export async function getWalletTokens(): Promise<WalletTokenConfig[]> {
  const response = await fetch(`${getTradingBackendUrl(DEFAULT_CHAIN_ID)}/api/v1/wallet/tokens`);
  if (!response.ok) {
    throw new Error(`Failed to fetch wallet token config: ${response.status}`);
  }

  const payload = (await response.json()) as WalletTokensResponse;
  if (!payload.success) {
    throw new Error("Failed to fetch wallet token config");
  }

  return payload.data ?? [];
}

export function useWalletTokensConfig() {
  return useSWR<WalletTokenConfig[]>(["wallet-token-config"], getWalletTokens, {
    refreshInterval: 60_000,
    revalidateOnFocus: false,
  });
}

export function findWalletTokenConfig(tokens: WalletTokenConfig[] | undefined, chainId: number, symbol?: string) {
  return tokens?.find(
    (token) => token.chainId === chainId && (!symbol || token.symbol.toLowerCase() === symbol.toLowerCase())
  );
}
