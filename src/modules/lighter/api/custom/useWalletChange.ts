import { useEffect, useRef, useCallback } from "react";
import { swrCache } from "app/swrConfig";

/**
 * Wallet change detection result
 */
export interface WalletChangeInfo {
  addressChanged: boolean;
  chainIdChanged: boolean;
  prevAddress: string | undefined;
  prevChainId: number | undefined;
}

/**
 * SWR cache keys related to Primit
 */
const PRIMIT_CACHE_KEYS = [
  "primit-balances",
  "primit-positions",
  "primit-orders",
  "primit-balances",
];

/**
 * Clear SWR cache entries for a specific address and/or chain
 */
function clearPrimitCache(options: {
  address?: string;
  chainId?: number;
  onlyChainId?: boolean;
}): void {
  const { address, chainId, onlyChainId } = options;
  const cacheKeys = Array.from(swrCache.keys());

  cacheKeys.forEach((key) => {
    const keyArray = Array.isArray(key) ? key : [key];

    // Check if this is a Primit-related key
    const isPrimitKey = keyArray.some(
      (k) => typeof k === "string" && PRIMIT_CACHE_KEYS.includes(k)
    );

    if (!isPrimitKey) return;

    // Check address match
    const hasAddress =
      address &&
      keyArray.some(
        (k) => typeof k === "string" && k.toLowerCase() === address.toLowerCase()
      );

    // Check chainId match
    const hasChainId =
      chainId !== undefined &&
      keyArray.some((k) => typeof k === "number" && k === chainId);

    // Delete based on criteria
    if (onlyChainId) {
      // Only match chainId (for chain switch)
      if (hasChainId && hasAddress) {
        swrCache.delete(key);
      }
    } else {
      // Match address (for address switch)
      if (hasAddress) {
        swrCache.delete(key);
      }
    }
  });
}

/**
 * Hook for detecting wallet address and chain changes
 * Single responsibility: track changes and clear related cache
 */
export function useWalletChange(
  address: string | undefined,
  chainId: number | undefined,
  options?: {
    onAddressChange?: (info: WalletChangeInfo) => void;
    onChainIdChange?: (info: WalletChangeInfo) => void;
  }
): WalletChangeInfo {
  const prevAddressRef = useRef<string | undefined>(undefined);
  const prevChainIdRef = useRef<number | undefined>(undefined);
  const isFirstRenderRef = useRef(true);

  const { onAddressChange, onChainIdChange } = options || {};

  // Detect changes
  const addressChanged = !isFirstRenderRef.current && prevAddressRef.current !== address;
  const chainIdChanged = !isFirstRenderRef.current && prevChainIdRef.current !== chainId;

  const changeInfo: WalletChangeInfo = {
    addressChanged,
    chainIdChanged,
    prevAddress: prevAddressRef.current,
    prevChainId: prevChainIdRef.current,
  };

  // Handle changes in useEffect to avoid side effects during render
  useEffect(() => {
    // Skip first render
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      prevAddressRef.current = address;
      prevChainIdRef.current = chainId;
      return;
    }

    const prevAddress = prevAddressRef.current;
    const prevChainId = prevChainIdRef.current;
    const didAddressChange = prevAddress !== address;
    const didChainIdChange = prevChainId !== chainId;

    // Handle chain change: clear old chain's cache
    if (didChainIdChange && prevChainId && address) {
      clearPrimitCache({
        address,
        chainId: prevChainId,
        onlyChainId: true,
      });

      onChainIdChange?.({
        addressChanged: didAddressChange,
        chainIdChanged: true,
        prevAddress,
        prevChainId,
      });
    }

    // Handle address change: clear old address's cache
    if (didAddressChange && prevAddress) {
      clearPrimitCache({
        address: prevAddress,
      });

      onAddressChange?.({
        addressChanged: true,
        chainIdChanged: didChainIdChange,
        prevAddress,
        prevChainId,
      });
    }

    // Update refs
    prevAddressRef.current = address;
    prevChainIdRef.current = chainId;
  }, [address, chainId, onAddressChange, onChainIdChange]);

  return changeInfo;
}
