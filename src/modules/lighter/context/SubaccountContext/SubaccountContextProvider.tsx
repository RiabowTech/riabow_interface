import { t } from "@lingui/macro";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";

import { selectExpressGlobalParams } from "@/modules/lighter/store/SyntheticsStateContext/selectors/expressSelectors";
import { selectIsSponsoredCallAvailable } from "@/modules/lighter/store/SyntheticsStateContext/selectors/globalSelectors";
import { selectTradeboxIsFromTokenTradingAccount } from "@/modules/lighter/store/SyntheticsStateContext/selectors/tradeboxSelectors";
import { useCalcSelector } from "@/modules/lighter/store/SyntheticsStateContext/utils";
import { getSubaccountApprovalKey, getSubaccountConfigKey } from "config/localStorage";
import { removeSubaccountExpressTxn, removeSubaccountWalletTxn } from "domain/synthetics/subaccount";
import { generateSubaccount } from "domain/synthetics/subaccount/generateSubaccount";
import type {
  SignedSubacсountApproval,
  Subaccount,
  SubaccountSerializedConfig,
} from "domain/synthetics/subaccount/types";
import { useSubaccountOnchainData } from "domain/synthetics/subaccount/useSubaccountOnchainData";
import {
  getActualApproval,
  getInitialSubaccountApproval,
  getIsSubaccountActive,
  getSubaccountSigner,
  signUpdatedSubaccountSettings,
} from "domain/synthetics/subaccount/utils";
import { useChainId } from "lib/chains";
import { helperToast } from "lib/helperToast";
import { useLocalStorageSerializeKey } from "lib/localStorage";
import { metrics } from "lib/metrics";
import { useJsonRpcProvider } from "lib/rpc";
import { useEthersSigner } from "lib/wallets/useEthersSigner";
import useWallet from "lib/wallets/useWallet";

import { StatusNotification } from "components/StatusNotification/StatusNotification";
import { TransactionStatus, TransactionStatusType } from "components/TransactionStatus/TransactionStatus";

enum SubaccountActivationState {
  Generating = 0,
  GeneratingError = 1,
  ApprovalSigning = 2,
  ApprovalSigningError = 3,
  Success = 4,
}

enum SubaccountDeactivationState {
  Deactivating = 0,
  Error = 1,
  Success = 2,
}

export type SubaccountState = {
  subaccountConfig: SubaccountSerializedConfig | undefined;
  subaccount: Subaccount | undefined;
  subaccountActivationState: SubaccountActivationState | undefined;
  subaccountDeactivationState: SubaccountDeactivationState | undefined;
  updateSubaccountSettings: (params: {
    nextRemainigActions?: bigint;
    nextRemainingSeconds?: bigint;
    nextIsTradingAccount?: boolean;
  }) => Promise<boolean>;
  resetSubaccountApproval: () => void;
  tryEnableSubaccount: () => Promise<boolean>;
  tryDisableSubaccount: () => Promise<boolean>;
  refreshSubaccountData: () => void;
};

const SubaccountContext = createContext<SubaccountState | undefined>(undefined);

const FALLBACK_SUBACCOUNT_STATE: SubaccountState = {
  subaccountConfig: undefined,
  subaccount: undefined,
  subaccountActivationState: undefined,
  subaccountDeactivationState: undefined,
  updateSubaccountSettings: async () => false,
  resetSubaccountApproval: () => undefined,
  tryEnableSubaccount: async () => false,
  tryDisableSubaccount: async () => false,
  refreshSubaccountData: () => undefined,
};

export function useSubaccountContext() {
  const context = useContext(SubaccountContext);
  if (!context) {
    return FALLBACK_SUBACCOUNT_STATE;
  }
  return context;
}

export function SubaccountContextProvider({ children }: { children: React.ReactNode }) {
  const { chainId, srcChainId } = useChainId();
  const signer = useEthersSigner();
  const { account } = useWallet();
  const { provider } = useJsonRpcProvider(chainId);

  const {
    subaccountConfig,
    signedApproval,
    setSubaccountConfig,
    setSignedApproval,
    resetStoredApproval,
    resetStoredConfig,
  } = useStoredSubaccountData(chainId, signer?.address);

  const [subaccountActivationState, setSubaccountActivationState] = useState<SubaccountActivationState | undefined>(
    undefined
  );

  const [subaccountDeactivationState, setSubaccountDeactivationState] = useState<
    SubaccountDeactivationState | undefined
  >(undefined);
  const activationToastIdRef = useRef<number | undefined>(undefined);
  const deactivationToastIdRef = useRef<number | undefined>(undefined);

  const { subaccountData, refreshSubaccountData } = useSubaccountOnchainData(chainId, {
    account: signer?.address,
    subaccountAddress: subaccountConfig?.address,
    srcChainId,
  });

  const subaccount: Subaccount | undefined = useMemo(() => {
    if (!subaccountConfig?.isNew || !signer?.address || !subaccountData || !signer?.provider) {
      return undefined;
    }

    const subaccountSigner = getSubaccountSigner(subaccountConfig, signer?.address, signer?.provider);

    const composedSubacсount: Subaccount = {
      address: subaccountConfig.address,
      signer: subaccountSigner,
      onchainData: subaccountData,
      signedApproval: getActualApproval({
        chainId,
        address: subaccountConfig.address,
        onchainData: subaccountData,
        signedApproval,
      }),
      chainId,
      signerChainId: srcChainId ?? chainId,
    };

    if (!getIsSubaccountActive(composedSubacсount)) {
      return undefined;
    }

    return composedSubacсount;
  }, [chainId, signedApproval, signer?.address, signer?.provider, srcChainId, subaccountConfig, subaccountData]);

  const calcSelector = useCalcSelector();

  const updateSubaccountSettings = useCallback(
    async function updateSubaccountSettings({
      nextRemainigActions,
      nextRemainingSeconds,
      nextIsTradingAccount,
    }: {
      nextRemainigActions?: bigint;
      nextRemainingSeconds?: bigint;
      nextIsTradingAccount?: boolean;
    }): Promise<boolean> {
      if (!signer || !subaccount?.address || !provider) {
        return false;
      }

      helperToast.success(
        <StatusNotification key="updateSubaccountSettings" title={t`Update 1CT (One-Click Trading) settings`}>
          <TransactionStatus status="loading" text={t`Updating settings...`} />
        </StatusNotification>
      );

      const isTradingAccount = nextIsTradingAccount ?? calcSelector(selectTradeboxIsFromTokenTradingAccount);

      try {
        const signedSubaccountApproval = await signUpdatedSubaccountSettings({
          chainId,
          signer,
          provider,
          subaccount,
          nextRemainigActions,
          nextRemainingSeconds,
          isTradingAccount,
        });

        helperToast.success(
          <StatusNotification key="updateSubaccountSettingsSuccess" title={t`Update 1CT (One-Click Trading) settings`}>
            <TransactionStatus status="success" text={t`Settings updated.`} />
          </StatusNotification>
        );
        setSignedApproval(signedSubaccountApproval);
        return true;
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(error);
        metrics.pushError(error, "subaccount.updateSubaccountSettings");
        toast.dismiss();
        helperToast.error(
          <StatusNotification key="updateSubaccountSettingsError" title={t`Update 1CT (One-Click Trading) settings`}>
            <TransactionStatus status="error" text={t`Failed to update settings.`} />
          </StatusNotification>
        );
        return false;
      }
    },
    [signer, subaccount, provider, calcSelector, chainId, setSignedApproval]
  );

  const resetSubaccountApproval = useCallback(() => {
    resetStoredApproval();
    refreshSubaccountData();
  }, [refreshSubaccountData, resetStoredApproval]);

  const tryEnableSubaccount = useCallback(async () => {
    if (!provider || !signer) {
      return false;
    }

    let config = subaccountConfig;

    const toastId = Date.now();
    activationToastIdRef.current = toastId;

    helperToast.success(<SubaccountActivateNotification toastId={toastId} subaccountActivationState={undefined} />, {
      autoClose: false,
      toastId,
    });

    if (!config?.address) {
      try {
        setSubaccountActivationState(SubaccountActivationState.Generating);
        config = await generateSubaccount(signer);

        setSubaccountConfig(config);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(error);

        setSubaccountActivationState(SubaccountActivationState.GeneratingError);
        metrics.pushError(error, "subaccount.generateSubaccount");
        return false;
      }
    }

    if (!config?.address) {
      const error = "Missed subaccount config";
      // eslint-disable-next-line no-console
      console.error(error);
      setSubaccountActivationState(SubaccountActivationState.GeneratingError);

      metrics.pushError(error, "subaccount.missedSubaccountConfigAfterGeneration");
      resetStoredConfig();
      return false;
    }

    const isTradingAccount = calcSelector(selectTradeboxIsFromTokenTradingAccount);

    try {
      setSubaccountActivationState(SubaccountActivationState.ApprovalSigning);

      const defaultSubaccountApproval = await getInitialSubaccountApproval({
        chainId,
        signer,
        provider,
        subaccountAddress: config!.address,
        isTradingAccount,
      });

      setSubaccountActivationState(SubaccountActivationState.Success);

      setSignedApproval(defaultSubaccountApproval);

      if (!config.isNew) {
        setSubaccountConfig({ ...config, isNew: true });
      }

      return true;
    } catch (error) {
      setSubaccountActivationState(SubaccountActivationState.ApprovalSigningError);
      // eslint-disable-next-line no-console
      console.error(error);
      metrics.pushError(error, "subaccount.signDefaultApproval");
      return false;
    }
  }, [
    provider,
    signer,
    subaccountConfig,
    calcSelector,
    setSubaccountConfig,
    resetStoredConfig,
    chainId,
    setSignedApproval,
  ]);

  const tryDisableSubaccount = useCallback(async (): Promise<boolean> => {
    if (!signer || !subaccount?.address || !account) {
      return false;
    }

    const toastId = Date.now();
    deactivationToastIdRef.current = toastId;

    helperToast.success(
      <SubaccountDeactivateNotification toastId={toastId} subaccountDeactivationState={undefined} />,
      {
        autoClose: false,
        toastId,
      }
    );

    setSubaccountDeactivationState(SubaccountDeactivationState.Deactivating);

    let removeSubaccount: () => Promise<void>;

    if (srcChainId !== undefined) {
      const globalExpressParams = calcSelector(selectExpressGlobalParams);
      const isSponsoredCallAvailable = calcSelector(selectIsSponsoredCallAvailable);

      if (!provider || !globalExpressParams) {
        return false;
      }

      removeSubaccount = () =>
        removeSubaccountExpressTxn({
          chainId,
          provider,
          account,
          srcChainId,
          signer,
          subaccount,
          globalExpressParams,
          isSponsoredCallAvailable,
        });
    } else {
      removeSubaccount = () => removeSubaccountWalletTxn(chainId, signer, subaccount.address);
    }

    try {
      await removeSubaccount();

      setSubaccountDeactivationState(SubaccountDeactivationState.Success);

      resetStoredApproval();
      resetStoredConfig();
      refreshSubaccountData();
      return true;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(error);
      metrics.pushError(error, "subaccount.tryDisableSubaccount");
      setSubaccountDeactivationState(SubaccountDeactivationState.Error);
      return false;
    }
  }, [
    signer,
    subaccount,
    account,
    srcChainId,
    calcSelector,
    provider,
    chainId,
    resetStoredApproval,
    resetStoredConfig,
    refreshSubaccountData,
  ]);

  useEffect(
    function notifySubaccountActivation() {
      if (subaccount) {
        refreshSubaccountData();
      }
    },
    [subaccount, refreshSubaccountData]
  );

  useEffect(() => {
    const toastId = activationToastIdRef.current;

    if (!toastId) return;

    toast.update(toastId, {
      render: (
        <SubaccountActivateNotification
          toastId={toastId}
          subaccountActivationState={subaccountActivationState}
        />
      ),
    });
  }, [subaccountActivationState]);

  useEffect(() => {
    const toastId = deactivationToastIdRef.current;

    if (!toastId) return;

    toast.update(toastId, {
      render: (
        <SubaccountDeactivateNotification
          toastId={toastId}
          subaccountDeactivationState={subaccountDeactivationState}
        />
      ),
    });
  }, [subaccountDeactivationState]);

  const state: SubaccountState = useMemo(() => {
    return {
      subaccountConfig,
      subaccount,
      subaccountActivationState,
      subaccountDeactivationState,
      updateSubaccountSettings,
      resetSubaccountApproval,
      tryEnableSubaccount,
      tryDisableSubaccount,
      refreshSubaccountData,
    };
  }, [
    subaccountConfig,
    subaccount,
    subaccountActivationState,
    subaccountDeactivationState,
    updateSubaccountSettings,
    resetSubaccountApproval,
    tryEnableSubaccount,
    tryDisableSubaccount,
    refreshSubaccountData,
  ]);

  return <SubaccountContext.Provider value={state}>{children}</SubaccountContext.Provider>;
}

function SubaccountActivateNotification({
  toastId,
  subaccountActivationState,
}: {
  toastId: number;
  subaccountActivationState: SubaccountActivationState | undefined;
}) {
  const dismissTimerId = useRef<NodeJS.Timeout | undefined>(undefined);

  const hasError =
    subaccountActivationState === SubaccountActivationState.GeneratingError ||
    subaccountActivationState === SubaccountActivationState.ApprovalSigningError;

  const isCompleted = subaccountActivationState === SubaccountActivationState.Success || hasError;

  const generatingStatus = useMemo(() => {
    let text = t`Generating session...`;
    let status: TransactionStatusType = "loading";

    if (subaccountActivationState === SubaccountActivationState.GeneratingError) {
      status = "error";
      text = t`Failed to generate session`;
    } else if (subaccountActivationState && subaccountActivationState >= SubaccountActivationState.ApprovalSigning) {
      status = "success";
      text = t`Session generated`;
    }

    return <TransactionStatus status={status} text={text} />;
  }, [subaccountActivationState]);

  const approvalSigningStatus = useMemo(() => {
    let status: TransactionStatusType = "muted";
    let text = t`Signing approval...`;

    if (subaccountActivationState === SubaccountActivationState.ApprovalSigning) {
      status = "loading";
    } else if (subaccountActivationState === SubaccountActivationState.ApprovalSigningError) {
      status = "error";
      text = t`Failed to sign approval`;
    } else if (subaccountActivationState === SubaccountActivationState.Success) {
      status = "success";
      text = t`Approval signed`;
    }

    return <TransactionStatus status={status} text={text} />;
  }, [subaccountActivationState]);

  useEffect(
    function cleanup() {
      if (isCompleted && !dismissTimerId.current) {
        dismissTimerId.current = setTimeout(() => {
          toast.dismiss(toastId);
          dismissTimerId.current = undefined;
        }, 5000);
      }

      return () => {
        if (dismissTimerId.current) {
          clearTimeout(dismissTimerId.current);
        }
      };
    },
    [isCompleted, subaccountActivationState, toastId]
  );

  useEffect(() => {
    if (hasError) {
      toast.update(toastId, { type: "error" });
    }
  }, [hasError, toastId]);

  return (
    <StatusNotification key="updateSubaccountSettingsSuccess" title={t`Activate 1CT (One-Click Trading)`}>
      {generatingStatus}
      {approvalSigningStatus}
    </StatusNotification>
  );
}

function SubaccountDeactivateNotification({
  toastId,
  subaccountDeactivationState,
}: {
  toastId: number;
  subaccountDeactivationState: SubaccountDeactivationState | undefined;
}) {
  const dismissTimerId = useRef<NodeJS.Timeout | undefined>(undefined);

  const hasError = subaccountDeactivationState === SubaccountDeactivationState.Error;
  const isCompleted =
    subaccountDeactivationState === SubaccountDeactivationState.Success ||
    subaccountDeactivationState === SubaccountDeactivationState.Error;

  const deactivatingStatus = useMemo(() => {
    let text = t`Deactivating...`;
    let status: TransactionStatusType = "loading";

    if (subaccountDeactivationState === SubaccountDeactivationState.Error) {
      status = "error";
      text = t`Failed to deactivate`;
    } else if (subaccountDeactivationState === SubaccountDeactivationState.Success) {
      status = "success";
      text = t`Deactivated`;
    }

    return <TransactionStatus status={status} text={text} />;
  }, [subaccountDeactivationState]);

  useEffect(() => {
    if (hasError) {
      toast.update(toastId, { type: "error" });
    }
  }, [hasError, toastId]);

  useEffect(
    function cleanup() {
      if (isCompleted && !dismissTimerId.current) {
        dismissTimerId.current = setTimeout(() => {
          toast.dismiss(toastId);
          dismissTimerId.current = undefined;
        }, 5000);
      }

      return () => {
        if (dismissTimerId.current) {
          clearTimeout(dismissTimerId.current);
        }
      };
    },
    [isCompleted, subaccountDeactivationState, toastId]
  );

  return <StatusNotification title={t`Deactivate 1CT (One-Click Trading)`}>{deactivatingStatus}</StatusNotification>;
}

function useStoredSubaccountData(chainId: number, account: string | undefined) {
  const [subaccountConfig, setSubaccountConfig] = useLocalStorageSerializeKey<SubaccountSerializedConfig | undefined>(
    getSubaccountConfigKey(chainId, account),
    undefined,
    {
      raw: false,
      serializer: (val) => {
        if (!val) {
          return "";
        }

        return JSON.stringify(val);
      },
      deserializer: (stored) => {
        if (!stored) {
          return undefined;
        }

        try {
          const parsed = JSON.parse(stored);

          if (!parsed.address || !parsed.privateKey) {
            return undefined;
          }

          return parsed;
        } catch (e) {
          return undefined;
        }
      },
    }
  );

  const [signedApproval, setSignedApproval] = useLocalStorageSerializeKey<SignedSubacсountApproval | undefined>(
    getSubaccountApprovalKey(chainId, account),
    undefined,
    {
      raw: false,
      serializer: (val) => {
        if (!val) {
          return "";
        }

        return JSON.stringify(val);
      },
      deserializer: (stored) => {
        if (!stored) {
          return undefined;
        }

        try {
          const parsed = JSON.parse(stored);
          return {
            ...parsed,
            maxAllowedCount: BigInt(parsed.maxAllowedCount),
            expiresAt: BigInt(parsed.expiresAt),
            deadline: BigInt(parsed.deadline),
            nonce: BigInt(parsed.nonce),
          };
        } catch (e) {
          return undefined;
        }
      },
    }
  );

  const resetStoredApproval = useCallback(() => {
    setSignedApproval(null as any);
  }, [setSignedApproval]);

  const resetStoredConfig = useCallback(() => {
    setSubaccountConfig(null as any);
  }, [setSubaccountConfig]);

  return useMemo(() => {
    return {
      subaccountConfig,
      signedApproval,
      setSubaccountConfig,
      setSignedApproval,
      resetStoredApproval,
      resetStoredConfig,
    };
  }, [
    subaccountConfig,
    signedApproval,
    setSubaccountConfig,
    setSignedApproval,
    resetStoredApproval,
    resetStoredConfig,
  ]);
}
