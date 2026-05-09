/**
 * Hook to fetch deposit and withdraw history for the exchange trading mode
 */

import { useMemo, useEffect, useState } from "react";
import useSWR, { SWRConfiguration } from "swr";
import { useAccount } from "wagmi";

import { getDepositHistory } from "./deposit";
import { getWithdrawHistory, getStoredToken, getLastAddress } from "./client";
import type { DepositRecord, WithdrawRecord } from "../types";
import type { TradeProduct } from "./productRouting";

const defaultConfig: SWRConfiguration = {
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
  refreshInterval: 30000, // Refresh every 30 seconds
};

export interface TradingFundingHistoryItem {
  id: string;
  type: "deposit" | "withdraw";
  token: string;
  amount: string;
  tx_hash: string | null;
  status: string;
  created_at: number;
  // Additional fields for withdraw
  nonce?: number;
  expiry?: number;
  backend_signature?: string;
}

type UseTradingFundingHistoryResult = {
  fundingHistory: TradingFundingHistoryItem[] | undefined;
  isLoading: boolean;
  error?: Error;
  mutate: () => void;
};

export function useTradingFundingHistory(
  chainId: number | undefined,
  config?: SWRConfiguration,
  product?: TradeProduct
): UseTradingFundingHistoryResult {
  const { address: account, chainId: wagmiChainId } = useAccount();
  const effectiveChainId = chainId || wagmiChainId;
  
  // Use state to track token existence so component re-renders when token changes
  const [hasToken, setHasToken] = useState(() => {
    // Use same logic as apiFetch: try account first, then fallback to last address
    let targetAddress: string | null | undefined = account;
    if (!targetAddress) {
      targetAddress = getLastAddress();
    }
    const token = getStoredToken(targetAddress, effectiveChainId);
    return token !== null;
  });

  // Poll for token changes to trigger re-render
  useEffect(() => {
    const checkToken = () => {
      // Use same logic as apiFetch: try account first, then fallback to last address
      let targetAddress: string | null | undefined = account;
      if (!targetAddress) {
        targetAddress = getLastAddress();
      }
      const token = getStoredToken(targetAddress, effectiveChainId);
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
  }, [account, effectiveChainId]);
  
  const authenticated = hasToken;
  const depositKey = effectiveChainId && account && authenticated ? [`trade-deposit-history`, product, effectiveChainId] : null;
  const withdrawKey = effectiveChainId && account && authenticated ? [`trade-withdraw-history`, product, effectiveChainId] : null;

  // Fetch deposit history
  const {
    data: depositData,
    error: depositError,
    isLoading: isDepositLoading,
    mutate: mutateDeposits,
  } = useSWR<{ deposits: DepositRecord[] }>(
    depositKey,
    async () => {
      try {
        const result = await getDepositHistory(effectiveChainId!, product);
        console.log("[useTradingFundingHistory] ✅ Deposit history fetched", { depositCount: result.deposits?.length || 0 });
        return result;
      } catch (err) {
        console.error("[useTradingFundingHistory] ❌ Deposit history fetch error", err);
        throw err;
      }
    },
    { 
      ...defaultConfig, 
      ...config,
      onError: (err) => {
        console.error("[useTradingFundingHistory] Deposit onError", err);
        config?.onError?.(err, "trade-deposit-history", config as any);
      },
    }
  );

  // Fetch withdraw history
  const {
    data: withdrawData,
    error: withdrawError,
    isLoading: isWithdrawLoading,
    mutate: mutateWithdraws,
  } = useSWR<{ withdrawals: WithdrawRecord[] }>(
    withdrawKey,
    async () => {
      try {
        const result = await getWithdrawHistory(effectiveChainId!, product);
        console.log("[useTradingFundingHistory] ✅ Withdraw history fetched", { withdrawCount: result.withdrawals?.length || 0 });
        return result;
      } catch (err) {
        console.error("[useTradingFundingHistory] ❌ Withdraw history fetch error", err);
        throw err;
      }
    },
    { 
      ...defaultConfig, 
      ...config,
      onError: (err) => {
        console.error("[useTradingFundingHistory] Withdraw onError", err);
        config?.onError?.(err, "trade-withdraw-history", config as any);
      },
    }
  );

  // Combine and sort by created_at (newest first)
  const fundingHistory = useMemo(() => {
    const items: TradingFundingHistoryItem[] = [];

    // Add deposits
    if (depositData?.deposits) {
      for (const deposit of depositData.deposits) {
        items.push({
          id: deposit.id,
          type: "deposit",
          token: deposit.token,
          amount: deposit.amount,
          tx_hash: deposit.tx_hash,
          status: deposit.status,
          created_at: deposit.created_at,
        });
      }
    }

    // Add withdrawals
    if (withdrawData?.withdrawals) {
      for (const withdraw of withdrawData.withdrawals) {
        items.push({
          id: withdraw.id,
          type: "withdraw",
          token: withdraw.token,
          amount: withdraw.amount,
          tx_hash: withdraw.tx_hash || null,
          status: withdraw.status,
          created_at: withdraw.created_at,
          nonce: withdraw.nonce,
          expiry: withdraw.expiry,
          backend_signature: withdraw.backend_signature,
        });
      }
    }

    // Sort by created_at descending (newest first)
    items.sort((a, b) => b.created_at - a.created_at);

    return items;
  }, [depositData?.deposits, withdrawData?.withdrawals]);

  const mutate = () => {
    mutateDeposits();
    mutateWithdraws();
  };

  return {
    fundingHistory,
    isLoading: isDepositLoading || isWithdrawLoading,
    error: depositError || withdrawError,
    mutate,
  };
}
