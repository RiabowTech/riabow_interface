import { TaskState } from "@gelatonetwork/relay-sdk";
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";

import { useSettings } from "@/modules/lighter/context/SettingsContext";
import { useSubaccountContext } from "@/modules/lighter/context/SubaccountContext";
import { useTokenPermitsContext } from "@/modules/lighter/context/TokenPermitsContext";
import { useTokensBalancesUpdates } from "@/modules/lighter/context/TokensBalancesContext";
import { useWebsocketProvider } from "@/modules/lighter/context/WebsocketContext";
import { subscribeToApprovalEvents } from "@/modules/lighter/context/WebsocketContext/subscribeToEvents";
import { useChainId } from "lib/chains";
import { getIsInsufficientExecutionFeeError, getIsInvalidSignatureError } from "lib/errors/customErrors";
import { helperToast } from "lib/helperToast";
import { sendTxnErrorMetric } from "lib/metrics/utils";
import { setByKey, updateByKey } from "lib/objects";
import { getProvider } from "lib/rpc";
import { sleep } from "lib/sleep";
import { getGelatoTaskDebugInfo } from "lib/transactions/sendExpressTransaction";
import { useHasLostFocus } from "lib/useHasPageLostFocus";
import { userAnalytics } from "lib/userAnalytics";
import { TokenApproveResultEvent } from "lib/userAnalytics/types";
import useWallet from "lib/wallets/useWallet";
import { isDevelopment } from "config/env";
import { NATIVE_TOKEN_ADDRESS } from "sdk/configs/tokens";
import { gelatoRelay } from "sdk/utils/gelatoRelay";
import { getTenderlyAccountParams } from "lib/tenderly";

import { getInsufficientExecutionFeeToastContent, InvalidSignatureToastContent } from "components/Errors/errorToasts";

import {
  ApprovalStatuses,
  GelatoTaskStatus,
  PendingExpressTxnParams,
  SetPendingDeposit,
  SetPendingFundingFeeSettlement,
  SetPendingOrder,
  SetPendingOrderUpdate,
  SetPendingPosition,
  SetPendingShift,
  SetPendingWithdrawal,
  SyntheticsEventsContextType,
} from "./types";
import { useMultichainEvents } from "./useMultichainEvents";
import { extractGelatoError, getGelatoTaskUrl } from "./utils";

/**
 * Why this provider is slim:
 *
 * The historical GMX path (markets / positions / orders / deposits /
 * withdrawals / shifts) is not active in this fork. Lighter uses its own
 * order/position pipelines, and cross-chain movement is handled through
 * LayerZero via `useMultichainEvents`. The `subscribeToV2Events` GMX-style
 * subscription used to listen for `OrderCreated`, `PositionIncrease`,
 * `DepositCreated`, etc.; those contracts are not deployed on the chains
 * we ship to, so the handlers never fired.
 *
 * The `SyntheticsEventsContextType` shape is preserved (empty constants
 * and noop setters) so consumers like `OrderStatusNotification` /
 * `GmStatusNotification` / `DynamicLines` keep type-checking. They render
 * nothing at runtime because their data sources are always empty. A
 * follow-up sweep can delete those components and slim the context type.
 *
 * What stays live here:
 *   - `useMultichainEvents` — LayerZero deposits / withdrawals / approvals
 *   - `subscribeToApprovalEvents` — ERC-20 approval events feed onboarding
 *   - Native token balance refresh on wallet activity
 *   - Gelato relay task subscription + insufficient-fee / invalid-signature
 *     error surfacing for express transactions
 *   - `setPendingExpressTxn` / `updatePendingExpressTxn` — used by express
 *     relay callers (withdrawal, cross-chain referral code)
 */

const EMPTY_OBJECT = Object.freeze({}) as Record<string, never>;
const EMPTY_ARRAY: never[] = [];

const noop = () => undefined;

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
  const { executionFeeBufferBps, setIsSettingsVisible } = useSettings();

  const { resetTokenPermits } = useTokenPermitsContext();
  const { refreshSubaccountData } = useSubaccountContext();

  const { setWebsocketTokenBalancesUpdates, setOptimisticTokensBalancesUpdates } = useTokensBalancesUpdates();
  const [approvalStatuses, setApprovalStatuses] = useState<ApprovalStatuses>({});

  const [pendingExpressTxnParams, setPendingExpressTxnParams] = useState<{
    [key: string]: Partial<PendingExpressTxnParams>;
  }>({});
  const [gelatoTaskStatuses, setGelatoTaskStatuses] = useState<{ [taskId: string]: GelatoTaskStatus }>({});
  const pendingOrderToastIdRef = { current: undefined as number | undefined };

  /**
   * Express relay calls this when an order successfully creates so cached
   * token permits and the subaccount session refresh. Cross-chain referral
   * code and the multichain withdrawal flow both rely on this side effect.
   */
  const handleExpressTxnSuccess = useCallback(
    (pendingExpressTxn: Partial<PendingExpressTxnParams>) => {
      const key = pendingExpressTxn.key;
      if (!key) return;
      refreshSubaccountData();
      if (pendingExpressTxn?.tokenPermits?.length) {
        resetTokenPermits();
      }
    },
    [refreshSubaccountData, resetTokenPermits]
  );

  const updateNativeTokenBalance = useCallback(() => {
    if (!currentAccount) return;
    provider.getBalance(currentAccount, "pending").then((balance) => {
      setWebsocketTokenBalancesUpdates((old) =>
        setByKey(old, NATIVE_TOKEN_ADDRESS, {
          balanceType: "wallet",
          balance,
        })
      );
    });
  }, [currentAccount, provider, setWebsocketTokenBalancesUpdates]);

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

  useEffect(() => {
    const handler = async (taskStatus) => {
      if (isDevelopment()) {
        const { accountSlug, projectSlug } = getTenderlyAccountParams();
        void getGelatoTaskDebugInfo(taskStatus.taskId, accountSlug, projectSlug);
      }

      switch (taskStatus.taskState) {
        case TaskState.ExecSuccess:
        case TaskState.ExecReverted:
        case TaskState.Cancelled: {
          gelatoRelay.unsubscribeTaskStatusUpdate(taskStatus.taskId);
          setGelatoTaskStatuses((old) =>
            setByKey(old, taskStatus.taskId, {
              taskId: taskStatus.taskId,
              taskState: taskStatus.taskState,
              lastCheckMessage: taskStatus.lastCheckMessage,
              transactionHash: taskStatus.transactionHash,
            })
          );

          if (taskStatus.taskState === TaskState.ExecSuccess) {
            const matched = Object.values(pendingExpressTxnParams).find((p) => p.taskId === taskStatus.taskId);
            if (matched) handleExpressTxnSuccess(matched);
          }
          break;
        }
        default:
          break;
      }
    };

    gelatoRelay.onTaskStatusUpdate(handler);

    return () => {
      gelatoRelay.offTaskStatusUpdate(handler);
    };
    // The handler closes over `pendingExpressTxnParams`/`handleExpressTxnSuccess`
    // intentionally — gelato fires once per task and re-subscribing on every
    // param change would race the off/on calls.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(
    function notifyPendingExpressTxn() {
      Object.values(pendingExpressTxnParams).forEach((pendingExpressTxn) => {
        if (pendingExpressTxn.taskId && pendingExpressTxn.key && gelatoTaskStatuses[pendingExpressTxn.taskId]) {
          const status = gelatoTaskStatuses[pendingExpressTxn.taskId].taskState;

          if (status === TaskState.ExecSuccess && pendingExpressTxn.successMessage && !pendingExpressTxn.isViewed) {
            helperToast.success(pendingExpressTxn.successMessage);
            setPendingExpressTxnParams((old) => updateByKey(old, pendingExpressTxn.key!, { isViewed: true }));
          }

          if (status === TaskState.ExecReverted || status === TaskState.Cancelled) {
            let isRelayerMetricSent = false;
            let isViewed = false;

            if (pendingExpressTxn.metricId && !pendingExpressTxn.isRelayerMetricSent) {
              const gelatoError = extractGelatoError(gelatoTaskStatuses[pendingExpressTxn.taskId]);

              sendTxnErrorMetric(pendingExpressTxn.metricId, gelatoError, "relayer");

              const executionFeeErrorParams = getIsInsufficientExecutionFeeError(gelatoError);

              if (executionFeeErrorParams.isErrorMatched) {
                const toastContent = getInsufficientExecutionFeeToastContent({
                  minExecutionFee: executionFeeErrorParams.args.minExecutionFee,
                  executionFee: executionFeeErrorParams.args.executionFee,
                  chainId,
                  executionFeeBufferBps,
                  estimatedExecutionGasLimit: pendingExpressTxn.estimatedExecutionGasLimit ?? 0n,
                  txUrl: getGelatoTaskUrl({
                    taskId: pendingExpressTxn.taskId,
                    isDebug: false,
                  }),
                  errorMessage: executionFeeErrorParams.errorData.errorMessage,
                  shouldOfferExpress: false,
                  setIsSettingsVisible,
                });

                sleep(500).then(() => {
                  if (pendingOrderToastIdRef.current !== undefined) {
                    toast.dismiss(pendingOrderToastIdRef.current);
                  }
                  helperToast.error(toastContent);
                });
                isViewed = true;
              }

              const invalidSignatureErrorParams = getIsInvalidSignatureError(gelatoError);

              if (invalidSignatureErrorParams.isErrorMatched) {
                sleep(500).then(() => {
                  if (pendingOrderToastIdRef.current !== undefined) {
                    toast.dismiss(pendingOrderToastIdRef.current);
                  }
                  helperToast.error(<InvalidSignatureToastContent />, {});
                });
                isViewed = true;
              }

              isRelayerMetricSent = true;
            }

            if (pendingExpressTxn.errorMessage && !pendingExpressTxn.isViewed) {
              helperToast.error(pendingExpressTxn.errorMessage);
              isViewed = true;
            }

            if (isViewed || isRelayerMetricSent) {
              setPendingExpressTxnParams((old) =>
                updateByKey(old, pendingExpressTxn.key!, { isViewed, isRelayerMetricSent })
              );
              setOptimisticTokensBalancesUpdates((old) => {
                const newState = { ...old };
                pendingExpressTxn.payTokenAddresses?.forEach((tokenAddress) => {
                  delete newState[tokenAddress];
                });
                return newState;
              });
            }
          }
        }
      });
    },
    [
      chainId,
      executionFeeBufferBps,
      gelatoTaskStatuses,
      pendingExpressTxnParams,
      setIsSettingsVisible,
      setOptimisticTokensBalancesUpdates,
    ]
  );

  // Used to ensure native balance stays in sync when explicit refresh isn't
  // wired anywhere else. Currently this is only invoked from the multichain
  // hook when relevant; kept available for hooks that may want it.
  void updateNativeTokenBalance;

  const multichainEventsState = useMultichainEvents({
    hasPageLostFocus,
  });

  const setPendingOrder: SetPendingOrder = noop;
  const setPendingOrderUpdate: SetPendingOrderUpdate = noop;
  const setPendingFundingFeeSettlement: SetPendingFundingFeeSettlement = noop;
  const setPendingPosition: SetPendingPosition = noop;
  const setPendingDeposit: SetPendingDeposit = noop;
  const setPendingWithdrawal: SetPendingWithdrawal = noop;
  const setPendingShift: SetPendingShift = noop;

  const contextState: SyntheticsEventsContextType = useMemo(
    () => ({
      orderStatuses: EMPTY_OBJECT,
      depositStatuses: EMPTY_OBJECT,
      withdrawalStatuses: EMPTY_OBJECT,
      shiftStatuses: EMPTY_OBJECT,
      approvalStatuses,
      pendingOrdersUpdates: EMPTY_OBJECT,
      pendingPositionsUpdates: EMPTY_OBJECT,
      positionIncreaseEvents: EMPTY_ARRAY,
      positionDecreaseEvents: EMPTY_ARRAY,
      pendingExpressTxns: pendingExpressTxnParams,
      gelatoTaskStatuses,
      setPendingExpressTxn: (params: PendingExpressTxnParams) => {
        setPendingExpressTxnParams((old) => setByKey(old, params.key, params));
      },
      updatePendingExpressTxn: (params: Partial<PendingExpressTxnParams>) => {
        setPendingExpressTxnParams((old) => {
          if (!params.key) return old;
          const key = params.key;
          if (old[key]) {
            return updateByKey(old, key, { ...params });
          }
          return setByKey(old, key, params);
        });
      },
      setPendingOrder,
      setPendingOrderUpdate,
      setPendingFundingFeeSettlement,
      setPendingPosition,
      setPendingDeposit,
      setPendingWithdrawal,
      setPendingShift,
      setOrderStatusViewed: noop,
      setDepositStatusViewed: noop,
      setWithdrawalStatusViewed: noop,
      setShiftStatusViewed: noop,
      ...multichainEventsState,
    }),
    [approvalStatuses, pendingExpressTxnParams, gelatoTaskStatuses, multichainEventsState]
  );

  return <SyntheticsEventsContext.Provider value={contextState}>{children}</SyntheticsEventsContext.Provider>;
}
