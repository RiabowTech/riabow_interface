import { useState, useCallback, useEffect, useRef } from "react";
import { useAccount } from "wagmi";
import { getAddress } from "viem";
import { useSWRConfig } from "swr";

import { getNonce, login, logout as apiLogout, setStoredToken } from "./client";
import { useTokenStorage } from "./useTokenStorage";
import { useWalletChange } from "./useWalletChange";
import { DEFAULT_CHAIN_ID, getChainName } from "config/chains";
import { helperToast } from "lib/helperToast";
import { getRainbowKitConfig } from "lib/wallets/rainbowKitConfig";
import type { LoginResponse } from "../types";

type WalletProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

export interface ZanbaraAuthState {
  isAuthenticated: boolean;
  isAuthenticating: boolean;
  error: string | null;
  token: string | null;
}

export interface UseZanbaraAuthReturn extends ZanbaraAuthState {
  authenticate: () => Promise<LoginResponse | null>;
  logout: () => void;
  clearError: () => void;
}

/**
 * Hook for Zanbara authentication
 * Uses composition of smaller hooks for better maintainability
 */
export function useZanbaraAuth(): UseZanbaraAuthReturn {
  const { address, isConnected, connector } = useAccount();
  const { mutate } = useSWRConfig();
  const authChainId = DEFAULT_CHAIN_ID;

  // Compose smaller hooks
  const { state: tokenState, saveToken, removeToken, refreshState } = useTokenStorage(address, authChainId);

  // Track wallet/chain changes and clear cache automatically
  useWalletChange(address, authChainId);

  // Local state for authenticating and error
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track login timestamp to prevent race conditions
  const justLoggedInRef = useRef<number>(0);

  // Clear auth when wallet disconnects
  useEffect(() => {
    if (!isConnected) {
      removeToken();
    }
  }, [isConnected, removeToken]);

  // Authenticate function
  const authenticate = useCallback(async (): Promise<LoginResponse | null> => {
    if (!address || !authChainId) {
      setError("Wallet not connected");
      return null;
    }

    setIsAuthenticating(true);
    setError(null);

    try {
      const provider = await getConnectorProvider(connector);

      await ensureWalletChain(provider, authChainId);

      // Step 1: Get nonce from backend
      const nonceResponse = await getNonce(authChainId, address);

      if (!isConnected || !address) {
        throw new Error("Wallet is not connected. Please connect your wallet first.");
      }

      if (!nonceResponse.typed_data) {
        throw new Error("Server did not return typed_data in nonce response");
      }

      if (!connector) {
        throw new Error("No wallet connector found. Please connect your wallet first.");
      }

      const typedData = nonceResponse.typed_data;

      // Validate typed_data structure
      if (!typedData.domain || !typedData.types || !typedData.message || !typedData.primaryType) {
        throw new Error("Invalid typed_data structure received from server");
      }

      const timestamp = parseInt(typedData.message.timestamp, 10);
      const checksumAddress = getAddress(address);
      const lowercaseAddress = address.toLowerCase();

      // Verify address match
      if (typedData.message.wallet.toLowerCase() !== lowercaseAddress) {
        throw new Error(
          `Address mismatch: typed_data wallet (${typedData.message.wallet}) does not match connected address (${address})`
        );
      }

      // Build typed data for signing
      const typedDataForSigning = buildTypedDataForSigning(typedData, checksumAddress);

      await ensureWalletChain(provider, Number((typedDataForSigning.domain as any).chainId ?? authChainId));

      const signature = await signTypedDataWithProvider(provider, checksumAddress, typedDataForSigning);

      // Step 3: Login with signature
      const loginResponse = await login(
        authChainId,
        { address, signature, timestamp },
        address
      );

      // Mark login timestamp
      justLoggedInRef.current = Date.now();

      // Ensure token is stored
      await ensureTokenStored(loginResponse, address, authChainId, saveToken, refreshState);

      // Trigger SWR revalidation
      revalidateBalanceKeys(authChainId, address, mutate);

      setIsAuthenticating(false);
      return loginResponse;
    } catch (err) {
      const errorMessage = formatAuthError(err);
      setError(errorMessage);
      helperToast.error(errorMessage);
      setIsAuthenticating(false);
      return null;
    }
  }, [address, authChainId, isConnected, connector, saveToken, refreshState, mutate]);

  // Logout function
  const logout = useCallback(() => {
    apiLogout(address, authChainId);
    removeToken();

    // Clear SWR cache for positions, orders, and balances so tables are emptied immediately
    if (address && authChainId) {
      const cacheKeys = [
        [`zanbara-positions`, authChainId, address],
        [`zanbara-orders`, authChainId, address],
        [`zanbara-balances`, authChainId, address],
        [`zanbara-balances`, authChainId, address],
      ];
      cacheKeys.forEach((key) => {
        mutate(key, undefined, { revalidate: false });
      });
    }
  }, [address, authChainId, removeToken, mutate]);

  // Clear error function
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    isAuthenticated: tokenState.isAuthenticated,
    isAuthenticating,
    error,
    token: tokenState.token,
    authenticate,
    logout,
    clearError,
  };
}

// ============ Helper Functions ============

/**
 * Build typed data structure for EIP-712 signing
 */
function buildTypedDataForSigning(
  typedData: any,
  checksumAddress: string
): Record<string, unknown> {
  // Deep copy types safely
  let safeTypes: Record<string, unknown>;
  try {
    safeTypes = JSON.parse(JSON.stringify(typedData.types));
  } catch (_error) {
    safeTypes = {};
    for (const key in typedData.types) {
      if (Object.prototype.hasOwnProperty.call(typedData.types, key)) {
        safeTypes[key] = Array.isArray(typedData.types[key])
          ? typedData.types[key].map((item: any) => ({ ...item }))
          : typedData.types[key];
      }
    }
  }

  return JSON.parse(
    JSON.stringify({
      types: safeTypes,
      primaryType: typedData.primaryType,
      domain: {
        name: typedData.domain.name,
        version: typedData.domain.version,
        chainId: typedData.domain.chainId,
        verifyingContract: typedData.domain.verifyingContract,
      },
      message: {
        wallet: checksumAddress,
        nonce: typedData.message.nonce,
        timestamp: typedData.message.timestamp,
      },
    })
  );
}

async function getConnectorProvider(connector: ReturnType<typeof useAccount>["connector"]): Promise<WalletProvider> {
  const provider = (await connector?.getProvider?.()) as Partial<WalletProvider> | undefined;
  if (typeof provider?.request !== "function") {
    throw new Error("No wallet provider found. Please reconnect your wallet.");
  }

  return provider as WalletProvider;
}

async function getWalletChainId(provider: WalletProvider): Promise<number | undefined> {
  if (!provider?.request) {
    return undefined;
  }

  const chainIdHex = (await provider.request({ method: "eth_chainId" })) as string;
  return parseInt(chainIdHex, 16);
}

async function waitForWalletChain(provider: WalletProvider, targetChainId: number): Promise<void> {
  const timeoutAt = Date.now() + 10_000;

  while (Date.now() < timeoutAt) {
    const currentChainId = await getWalletChainId(provider);
    if (currentChainId === targetChainId) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  const currentChainId = await getWalletChainId(provider);
  throw new Error(`Please switch wallet network to ${targetChainId}. Current wallet chain is ${currentChainId ?? "unknown"}.`);
}

async function ensureWalletChain(provider: WalletProvider, targetChainId: number): Promise<void> {
  const currentChainId = await getWalletChainId(provider);
  if (currentChainId === targetChainId) {
    return;
  }

  await switchProviderChain(provider, targetChainId);
  await waitForWalletChain(provider, targetChainId);
}

async function switchProviderChain(provider: WalletProvider, targetChainId: number): Promise<void> {
  if (!provider?.request) {
    throw new Error("No wallet provider found");
  }

  const chainIdHex = `0x${targetChainId.toString(16)}`;

  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: chainIdHex }],
    });
  } catch (switchError: any) {
    if (switchError?.code === 4001) {
      throw new Error("User rejected the chain switch");
    }

    if (switchError?.code !== 4902) {
      throw switchError;
    }

    const targetChain = getRainbowKitConfig().chains.find((chain) => chain.id === targetChainId);
    if (!targetChain) {
      throw new Error(`Unsupported wallet network ${targetChainId}`);
    }

    await provider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: chainIdHex,
          chainName: targetChain.name,
          nativeCurrency: targetChain.nativeCurrency,
          rpcUrls: targetChain.rpcUrls.default.http,
          blockExplorerUrls: targetChain.blockExplorers?.default?.url
            ? [targetChain.blockExplorers.default.url]
            : [],
        },
      ],
    });

    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: chainIdHex }],
    });
  }
}

async function signTypedDataWithProvider(
  provider: WalletProvider,
  checksumAddress: string,
  typedData: Record<string, unknown>
): Promise<string> {
  if (!provider?.request) {
    throw new Error("No wallet provider found");
  }

  const requiredChainId = Number((typedData.domain as any)?.chainId);
  const currentChainId = await getWalletChainId(provider);
  if (requiredChainId && currentChainId !== requiredChainId) {
    throw new Error(
      `Wallet is on ${getChainName(currentChainId as any) || currentChainId}, but this signature requires ${getChainName(requiredChainId as any) || requiredChainId}.`
    );
  }

  const signature = (await provider.request({
    method: "eth_signTypedData_v4",
    params: [checksumAddress, JSON.stringify(typedData)],
  })) as string;

  if (!signature || typeof signature !== "string" || !signature.startsWith("0x")) {
    throw new Error("Invalid signature format received from wallet");
  }

  return signature;
}

/**
 * @deprecated This function is no longer used.
 * We now use wagmi's signTypedDataAsync which works with all wallet types including WalletConnect.
 * Kept for reference only.
 */
// async function signTypedData(
//   checksumAddress: string,
//   typedData: Record<string, unknown>
// ): Promise<string> {
//   const ethereumProvider = window.ethereum;
//   if (!ethereumProvider) {
//     throw new Error("No Ethereum provider found");
//   }
//
//   const typedDataString = JSON.stringify(typedData);
//
//   const requestPromise = ethereumProvider.request({
//     method: "eth_signTypedData_v4",
//     params: [checksumAddress, typedDataString],
//   }) as Promise<string>;
//
//   // Add timeout protection (30 seconds)
//   const timeoutPromise = new Promise<never>((_, reject) => {
//     setTimeout(() => reject(new Error("Signature request timeout after 30 seconds")), 30000);
//   });
//
//   const signature = await Promise.race([requestPromise, timeoutPromise]);
//
//   if (!signature || typeof signature !== "string" || !signature.startsWith("0x")) {
//     throw new Error("Invalid signature format received from wallet");
//   }
//
//   return signature;
// }

/**
 * Ensure token is stored after login
 */
async function ensureTokenStored(
  loginResponse: LoginResponse,
  address: string,
  chainId: number,
  saveToken: (token: string, expiresAt: number) => void,
  refreshState: () => { token: string | null; isAuthenticated: boolean }
): Promise<void> {
  // Small delay to ensure token is written
  await new Promise((resolve) => setTimeout(resolve, 100));

  const { token } = refreshState();

  if (!token && loginResponse.token) {
    // Manually store if not found
    saveToken(loginResponse.token, loginResponse.expires_at);
  }
}

/**
 * Revalidate SWR balance keys after login
 */
function revalidateBalanceKeys(
  chainId: number,
  address: string,
  mutate: ReturnType<typeof useSWRConfig>["mutate"]
): void {
  setTimeout(() => {
    const balanceKeys = [
      ["zanbara-balances", chainId, address],
      ["zanbara-balances", chainId, address],
    ];
    balanceKeys.forEach((key) => {
      mutate(key, undefined, { revalidate: true });
    });
  }, 100);
}

/**
 * Format authentication error message
 */
function formatAuthError(error: unknown): string {
  if (!(error instanceof Error)) {
    return "Authentication failed";
  }

  const message = error.message;

  if (message.includes("User rejected") || message.includes("User denied")) {
    return "User rejected the signature request";
  }
  if (message.includes("Network") || message.includes("fetch")) {
    return "Network error: Please check your connection";
  }
  if (message.includes("401") || message.includes("Unauthorized")) {
    return "Authentication failed: Invalid signature";
  }
  if (message.includes("404")) {
    return "Backend endpoint not found";
  }
  if (message.includes("500") || message.includes("Internal Server Error")) {
    return "Backend server error";
  }

  return message;
}

export default useZanbaraAuth;
