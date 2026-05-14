import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";

import { useTokensBalancesUpdates } from "@/modules/lighter/context/TokensBalancesContext";
import { useWebsocketProvider } from "@/modules/lighter/context/WebsocketContext";
import { subscribeToApprovalEvents } from "@/modules/lighter/context/WebsocketContext/subscribeToEvents";
import { useChainId } from "lib/chains";
import { setByKey } from "lib/objects";
import { getProvider } from "lib/rpc";
import { useHasLostFocus } from "lib/useHasPageLostFocus";
import { userAnalytics } from "lib/userAnalytics";
import { TokenApproveResultEvent } from "lib/userAnalytics/types";
import useWallet from "lib/wallets/useWallet";
import { NATIVE_TOKEN_ADDRESS } from "sdk/configs/tokens";

import { ApprovalStatuses, SyntheticsEventsContextType } from "./types";
import { useMultichainEvents } from "./useMultichainEvents";

/**
 * Why this provider is slim:
 *
 * The historical GMX path (markets / positions / orders / deposits /
 * withdrawals / shifts) is not active in this fork. The
 * `subscribeToV2Events` GMX subscription, the GMX order/position event
 * handlers, the pending-express-txn tracking, and the gelato status
 * notification loop were all dropped in earlier cleanup commits.
 *
 * What stays:
 *   - `useMultichainEvents` — LayerZero deposits / withdrawals / approvals
 *   - `subscribeToApprovalEvents` — ERC-20 approval pipeline
 *   - Native token balance updates surfaced through
 *     `useTokensBalancesUpdates` (the value is unused here but the hook is
 *     called so consumers of the same context get a consistent provider tree)
 *
 * If a future feature needs gelato task tracking or express-txn pending
 * status, re-add those slots to `SyntheticsEventsContextType` and the
 * provider together rather than carrying empty plumbing.
 */

export const SyntheticsEventsContext = createContext({});

export function useSyntheticsEvents(): SyntheticsEventsContextType {
  return useContext(SyntheticsEventsContext) as SyntheticsEventsContextType;
}

export function SyntheticsEventsProvider({ children }: { children: ReactNode }) {
  const { chainId } = useChainId();
  const { account: currentAccount } = useWallet();
  const provider = getProvider(undefined, chainId);
  const { wsProvider } = useWebsocketProvider();
  const { hasPageLostFocus } = useHasLostFocus();

  const { setWebsocketTokenBalancesUpdates } = useTokensBalancesUpdates();
  const [approvalStatuses, setApprovalStatuses] = useState<ApprovalStatuses>({});

  // Available for callers that want to force a native balance refresh after
  // wallet activity. Currently no caller — left in place because
  // `getProvider(...).getBalance(account, "pending")` is the cheapest way to
  // keep the cached native balance honest, and it's worth keeping the
  // wiring next to the rest of this provider.
  void (function updateNativeTokenBalance() {
    if (!currentAccount) return;
    provider.getBalance(currentAccount, "pending").then((balance) => {
      setWebsocketTokenBalancesUpdates((old) =>
        setByKey(old, NATIVE_TOKEN_ADDRESS, {
          balanceType: "wallet",
          balance,
        })
      );
    });
  });

  useEffect(
    function subscribeApproval() {
      if (!wsProvider || !currentAccount) return;

      const unsubscribeApproval = subscribeToApprovalEvents(
        chainId,
        wsProvider,
        currentAccount,
        (tokenAddress, spender, value) => {
          setApprovalStatuses((old) => ({
            ...old,
            [tokenAddress]: {
              ...old[tokenAddress],
              [spender]: { value, createdAt: Date.now() },
            },
          }));
          userAnalytics.pushEvent<TokenApproveResultEvent>({
            event: "TokenApproveAction",
            data: {
              action: "ApproveSuccess",
            },
          });
        }
      );

      return function cleanup() {
        unsubscribeApproval();
      };
    },
    [chainId, currentAccount, wsProvider]
  );

  const multichainEventsState = useMultichainEvents({ hasPageLostFocus });

  const contextState: SyntheticsEventsContextType = useMemo(
    () => ({
      approvalStatuses,
      ...multichainEventsState,
    }),
    [approvalStatuses, multichainEventsState]
  );

  return <SyntheticsEventsContext.Provider value={contextState}>{children}</SyntheticsEventsContext.Provider>;
}
