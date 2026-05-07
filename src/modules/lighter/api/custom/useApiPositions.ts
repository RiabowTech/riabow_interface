/**
 * useApiPositions - Hook that fetches positions from REST API
 * and converts them to SDK PositionsData format for compatibility
 */

import { useMemo } from "react";
import useSWR, { SWRConfiguration } from "swr";
import { useAccount } from "wagmi";

import type { PositionsData } from "sdk/types/positions";

import { getPositions, getStoredToken, getLastAddress, type PositionsResponse } from "./client";
import { convertApiPositionsToSdk } from "./positionAdapter";
import { useEffect, useState } from "react";

// Default SWR configuration for positions
const defaultConfig: SWRConfiguration = {
  revalidateOnFocus: false,
  dedupingInterval: 2000,
  refreshInterval: 2000,
  keepPreviousData: true, // Keep showing data even when key changes temporarily
};

type UseApiPositionsResult = {
  positionsData?: PositionsData;
  isLoading: boolean;
  error?: Error;
  totalUnrealizedPnl?: string;
  totalCollateral?: string;
  mutate: () => void;
};

/**
 * Fetch positions from API and convert to SDK format
 */
export function useApiPositions(
  chainId: number | undefined,
  account: string | null | undefined,
  config?: SWRConfiguration
): UseApiPositionsResult {
  // Use state to track token existence so component re-renders when token changes
  const [hasToken, setHasToken] = useState(() => {
    // Use same logic as apiFetch: try account first, then fallback to last address
    let targetAddress = account;
    if (!targetAddress) {
      targetAddress = getLastAddress();
    }
    const token = getStoredToken(targetAddress, chainId);
    return token !== null;
  });

  // Poll for token changes to trigger re-render
  useEffect(() => {
    const checkToken = () => {
      // Use same logic as apiFetch: try account first, then fallback to last address
      let targetAddress = account;
      if (!targetAddress) {
        targetAddress = getLastAddress();
      }
      const token = getStoredToken(targetAddress, chainId);
      const newHasToken = token !== null;
      
      setHasToken((prev) => {
        if (prev !== newHasToken) {
          return newHasToken;
        }
        return prev;
      });
    };

    checkToken();
    const interval = setInterval(checkToken, 500);
    
    // Also listen for token change events
    const handleTokenChange = () => {
      checkToken();
    };
    window.addEventListener("auth-token-change", handleTokenChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener("auth-token-change", handleTokenChange);
    };
  }, [account, chainId]);
  
  const authenticated = hasToken;
  // Use account or fallback to lastAddress for SWR key
  const effectiveAccount = account || getLastAddress();
  const swrKey = chainId && effectiveAccount && authenticated ? [`api-positions`, chainId, effectiveAccount] : null;

  const {
    data: apiResponse,
    error,
    isLoading,
    mutate,
  } = useSWR<PositionsResponse>(
    swrKey,
    async () => {
      try {
        // Pass effectiveAccount to getPositions for consistent token lookup
        const result = await getPositions(chainId!, effectiveAccount);
        return result;
      } catch (err) {
        console.error("[useApiPositions] ❌ Positions fetch error", err);
        throw err;
      }
    },
    {
      ...defaultConfig,
      ...config,
      onError: (err, key, swrConfig) => {
        console.error("[useApiPositions] onError", err);
        config?.onError?.(err, key, swrConfig);
      },
    }
  );

  const positionsData = useMemo(() => {
    if (!apiResponse?.positions || !chainId || !effectiveAccount) {
      return undefined;
    }

    return convertApiPositionsToSdk(apiResponse.positions, chainId, effectiveAccount);
  }, [apiResponse?.positions, chainId, effectiveAccount]);

  return {
    positionsData,
    isLoading,
    error: error as Error | undefined,
    totalUnrealizedPnl: apiResponse?.total_unrealized_pnl,
    totalCollateral: apiResponse?.total_collateral,
    mutate,
  };
}

/**
 * Hook with auto-detected account from wagmi
 */
export function useUserApiPositions(config?: SWRConfiguration): UseApiPositionsResult {
  const { address, chainId } = useAccount();
  return useApiPositions(chainId, address, config);
}

/**
 * Feature flag to control the positions data source.
 * Set VITE_USE_API_POSITIONS=true to use the REST API instead of multicall.
 * Also returns true when the trading page runtime is active.
 */
export function shouldUseApiPositions(): boolean {
  if (typeof window === "undefined") return false;
  // Check for the trading-page runtime flag.
  const tradeModeFlag = localStorage.getItem("trade_mode");
  if (tradeModeFlag === "true") return true;
  // Check for environment variable or localStorage flag
  const envFlag = import.meta.env.VITE_USE_API_POSITIONS;
  const localFlag = localStorage.getItem("use_api_positions");
  return envFlag === "true" || localFlag === "true";
}

/**
 * Enable API positions data source
 */
export function enableApiPositions(): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("use_api_positions", "true");
    window.location.reload();
  }
}

/**
 * Disable API positions data source (use multicall)
 */
export function disableApiPositions(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem("use_api_positions");
    window.location.reload();
  }
}
