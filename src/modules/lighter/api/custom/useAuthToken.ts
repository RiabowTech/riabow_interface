import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { useChainId } from "lib/chains";
import { getStoredToken } from "./client";

// Custom event name for auth-token changes in the same tab.
const TOKEN_CHANGE_EVENT = "auth-token-change";

/**
 * Hook to get the current authentication token for the connected wallet.
 * Listens for token changes via polling, storage events, and custom events.
 * @param overrideChainId - Optional chainId to override the global chainId (used in /accounts page)
 */
export function useAuthToken(overrideChainId?: number) {
  const { address } = useAccount();
  const { chainId: globalChainId } = useChainId();
  const chainId = overrideChainId ?? globalChainId;
  const [token, setToken] = useState<string | null>(() => {
    const storedToken = getStoredToken(address, chainId);
    return storedToken;
  });

  useEffect(() => {
    // Check token on mount and when storage changes
    const checkToken = () => {
      const currentToken = getStoredToken(address, chainId);
      setToken((prevToken) => {
        // Only update if token actually changed to avoid unnecessary re-renders
        if (prevToken !== currentToken) {
          return currentToken;
        }
        return prevToken;
      });
    };

    // Check immediately
    checkToken();

    // Listen for storage changes (e.g., when token is set/cleared in another tab)
    window.addEventListener("storage", checkToken);

    // Listen for custom token change events (same tab)
    const handleTokenChange = () => {
      checkToken();
    };
    window.addEventListener(TOKEN_CHANGE_EVENT, handleTokenChange);

    // Poll for token changes (in case token is set/cleared in the same tab)
    // Reduced interval to 500ms for faster detection
    const interval = setInterval(checkToken, 500);

    return () => {
      window.removeEventListener("storage", checkToken);
      window.removeEventListener(TOKEN_CHANGE_EVENT, handleTokenChange);
      clearInterval(interval);
    };
  }, [address, chainId]);

  return { token };
}

/**
 * Dispatch a custom event to notify token change listeners
 * This allows immediate notification when token is set/cleared in the same tab
 */
export function notifyTokenChange(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(TOKEN_CHANGE_EVENT));
  }
}
