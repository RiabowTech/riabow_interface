import { ethers, JsonRpcProvider, Network, Signer, WebSocketProvider } from "ethers";
import { useEffect, useMemo, useState } from "react";

import {
  AnyChainId,
  ARBITRUM,
  ARBITRUM_SEPOLIA,
  AVALANCHE,
  AVALANCHE_FUJI,
  BOTANIX,
  FALLBACK_PROVIDERS,
  getAlchemyArbitrumSepoliaWsUrl,
  getAlchemyArbitrumWsUrl,
  getAlchemyBaseMainnetWsUrl,
  getAlchemyBotanixWsUrl,
  getAlchemyBscMainnetWsUrl,
  getAlchemyOptimismSepoliaWsUrl,
  getAlchemySepoliaWsUrl,
  getFallbackRpcUrl,
  SOURCE_BASE_MAINNET,
  SOURCE_BSC_MAINNET,
  SOURCE_OPTIMISM_SEPOLIA,
  SOURCE_SEPOLIA,
} from "config/chains";
import { isDevelopment } from "config/env";
import { getCurrentRpcUrls, useCurrentRpcUrls } from "lib/rpc/bestRpcTracker";

export function getProvider(signer: undefined, chainId: number): ethers.JsonRpcProvider;
export function getProvider(signer: Signer, chainId: number): Signer;
export function getProvider(signer: Signer | undefined, chainId: number): ethers.JsonRpcProvider | Signer;
export function getProvider(signer: Signer | undefined, chainId: number): ethers.JsonRpcProvider | Signer {
  let url;

  if (signer) {
    return signer;
  }

  url = getCurrentRpcUrls(chainId).primary;

  const network = Network.from(chainId);

  return new ethers.JsonRpcProvider(url, chainId, { staticNetwork: network });
}

export function getWsProvider(chainId: AnyChainId): WebSocketProvider | JsonRpcProvider {
  const network = Network.from(chainId);

  if (chainId === ARBITRUM) {
    return new ethers.WebSocketProvider(getAlchemyArbitrumWsUrl(), network, { staticNetwork: network });
  }

  if (chainId === AVALANCHE) {
    const provider = new ethers.WebSocketProvider("wss://api.avax.network/ext/bc/C/ws", network, {
      staticNetwork: network,
    });
    return provider;
  }

  if (chainId === AVALANCHE_FUJI) {
    const provider = new ethers.JsonRpcProvider(getCurrentRpcUrls(AVALANCHE_FUJI).primary, network, {
      staticNetwork: network,
    });
    provider.pollingInterval = 2000;
    return provider;
  }

  if (chainId === ARBITRUM_SEPOLIA) {
    const provider = new ethers.WebSocketProvider(getAlchemyArbitrumSepoliaWsUrl(), network, {
      staticNetwork: network,
    });
    return provider;
  }

  if (chainId === SOURCE_SEPOLIA) {
    const provider = new ethers.WebSocketProvider(getAlchemySepoliaWsUrl(), network, {
      staticNetwork: network,
    });
    return provider;
  }

  if (chainId === SOURCE_OPTIMISM_SEPOLIA) {
    const provider = new ethers.WebSocketProvider(getAlchemyOptimismSepoliaWsUrl(), network, {
      staticNetwork: network,
    });
    return provider;
  }

  if (chainId === BOTANIX) {
    return new ethers.WebSocketProvider(getAlchemyBotanixWsUrl(), network, { staticNetwork: network });
  }

  if (chainId === SOURCE_BASE_MAINNET) {
    return new ethers.WebSocketProvider(getAlchemyBaseMainnetWsUrl(), network, { staticNetwork: network });
  }

  if (chainId === SOURCE_BSC_MAINNET) {
    return new ethers.WebSocketProvider(getAlchemyBscMainnetWsUrl(), network, { staticNetwork: network });
  }

  const castedChainId: never = chainId;

  throw new Error(`Unsupported websocket provider for chain id: ${castedChainId}`);
}

export function getFallbackProvider(chainId: number) {
  if (!FALLBACK_PROVIDERS[chainId]) {
    return;
  }

  const providerUrl = getFallbackRpcUrl(chainId);

  return new ethers.JsonRpcProvider(providerUrl, chainId, {
    staticNetwork: Network.from(chainId),
  });
}

export function useJsonRpcProvider(chainId: number | undefined) {
  const [provider, setProvider] = useState<JsonRpcProvider>();

  const { primary } = useCurrentRpcUrls(chainId);
  const rpcUrl = useMemo(() => primary, [primary]);

  useEffect(() => {
    if (!chainId) {
      return;
    }

    async function initializeProvider() {
      if (!rpcUrl) return;

      const provider = new ethers.JsonRpcProvider(rpcUrl, chainId);

      provider._start();
      await provider._waitUntilReady();

      setProvider(provider);
    }

    initializeProvider();
  }, [chainId, rpcUrl]);

  return { provider };
}

export function isWebsocketProvider(provider: any): provider is WebSocketProvider {
  return Boolean(provider?.websocket);
}

export enum WSReadyState {
  CONNECTING = 0,
  OPEN = 1,
  CLOSING = 2,
  CLOSED = 3,
}

const readyStateByEnum = {
  [WSReadyState.CONNECTING]: "connecting",
  [WSReadyState.OPEN]: "open",
  [WSReadyState.CLOSING]: "closing",
  [WSReadyState.CLOSED]: "closed",
};

export function isProviderInClosedState(wsProvider: WebSocketProvider) {
  return [WSReadyState.CLOSED, WSReadyState.CLOSING].includes(wsProvider.websocket.readyState);
}

export function closeWsConnection(wsProvider: WebSocketProvider) {
  if (isDevelopment()) {
  }

  if (isProviderInClosedState(wsProvider)) {
    return;
  }

  wsProvider.removeAllListeners();
  wsProvider.websocket.close();
}
