import { ethers } from "ethers";
import { useMemo } from "react";
import type { Account, Chain, Client, Transport } from "viem";
import { Config, useAccount, useConnectorClient } from "wagmi";

import { UncheckedJsonRpcSigner } from "lib/rpc/UncheckedJsonRpcSigner";
import { getRainbowKitConfig } from "lib/wallets/rainbowKitConfig";

import { WalletSigner } from ".";

function getConfiguredChain(chainId?: number): Chain | undefined {
  if (!chainId) return undefined;
  return getRainbowKitConfig().chains.find((chain) => chain.id === chainId) as Chain | undefined;
}

export function clientToSigner(
  client: Client<Transport, Chain, Account>,
  account: string,
  fallbackChain?: Chain
): WalletSigner {
  const { chain, transport } = client;
  const resolvedChain = chain ?? fallbackChain;

  if (!resolvedChain) {
    throw new Error("Wallet client chain is unavailable");
  }

  const network = {
    chainId: resolvedChain.id,
    name: resolvedChain.name,
    ensAddress: resolvedChain.contracts?.ensRegistry?.address,
  };

  const provider = new ethers.BrowserProvider(transport, network);
  const signer = new UncheckedJsonRpcSigner(provider, account);

  if (!signer.address) {
    signer.address = account;
  }

  return signer as WalletSigner;
}

/** Hook to convert a Viem Client to an ethers.js Signer. */
export function useEthersSigner({ chainId }: { chainId?: number } = {}) {
  const { address, chainId: accountChainId } = useAccount();
  const { data: client } = useConnectorClient<Config>({ chainId });

  return useMemo(() => {
    if (!address || !client?.account) {
      return undefined;
    }

    try {
      return clientToSigner(client, address, getConfiguredChain(chainId ?? accountChainId));
    } catch (error) {
      return undefined;
    }
  }, [accountChainId, chainId, client, address]);
}
