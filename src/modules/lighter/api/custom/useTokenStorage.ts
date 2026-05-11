import { useState, useCallback, useEffect } from "react";
import { getStoredToken, setStoredToken, clearStoredToken, getLastAddress } from "./client";

/**
 * Token storage state
 */
export interface TokenStorageState {
  token: string | null;
  isAuthenticated: boolean;
}

/**
 * Read token from localStorage with fallback logic
 */
function readTokenState(address: string | undefined, chainId: number | undefined): TokenStorageState {
  let token = getStoredToken(address, chainId);

  // Fallback: if address is undefined, try last address
  if (!token && !address && chainId) {
    const lastAddress = getLastAddress();
    if (lastAddress) {
      token = getStoredToken(lastAddress, chainId);
    }
  }

  return {
    token,
    isAuthenticated: token !== null,
  };
}

/**
 * Hook for managing JWT token storage
 * Single responsibility: read/write token from localStorage
 */
export function useTokenStorage(
  address: string | undefined,
  chainId: number | undefined
): {
  state: TokenStorageState;
  saveToken: (token: string, expiresAt: number) => void;
  removeToken: () => void;
  refreshState: () => TokenStorageState;
} {
  // Initialize state from localStorage
  const [state, setState] = useState<TokenStorageState>(() => readTokenState(address, chainId));

  // Sync state when address or chainId changes
  useEffect(() => {
    const newState = readTokenState(address, chainId);
    setState((prev) => {
      // Only update if values actually changed
      if (prev.token === newState.token && prev.isAuthenticated === newState.isAuthenticated) {
        return prev;
      }
      return newState;
    });
  }, [address, chainId]);

  // Listen for localStorage changes from other tabs
  useEffect(() => {
    const refreshFromStorage = () => {
      const newState = readTokenState(address, chainId);
      setState(newState);
    };

    const handleStorageChange = (e: StorageEvent) => {
      // 兼容新旧两套前缀:zanbara_* 是当前写路径,axblade_* 是历史数据(读到即迁移,见 client.ts)
      if (
        e.key?.includes("zanbara_jwt_token") ||
        e.key?.includes("zanbara_jwt_expiry") ||
        e.key?.includes("axblade_jwt_token") ||
        e.key?.includes("axblade_jwt_expiry")
      ) {
        refreshFromStorage();
      }
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("auth-token-change", refreshFromStorage);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("auth-token-change", refreshFromStorage);
    };
  }, [address, chainId]);

  // Save token to localStorage
  const saveToken = useCallback(
    (token: string, expiresAt: number) => {
      if (address && chainId) {
        setStoredToken(token, expiresAt, address, chainId);
        // Update local state immediately
        setState({
          token,
          isAuthenticated: true,
        });
      }
    },
    [address, chainId]
  );

  // Remove token from localStorage
  const removeToken = useCallback(() => {
    clearStoredToken(address, chainId);
    // Update local state immediately
    setState({
      token: null,
      isAuthenticated: false,
    });
  }, [address, chainId]);

  // Manual refresh
  const refreshState = useCallback(() => {
    const newState = readTokenState(address, chainId);
    setState(newState);
    return newState;
  }, [address, chainId]);

  return {
    state,
    saveToken,
    removeToken,
    refreshState,
  };
}
