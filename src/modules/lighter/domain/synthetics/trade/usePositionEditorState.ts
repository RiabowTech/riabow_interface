import noop from "lodash/noop";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Address } from "viem";

import type { ContractsChainId, SourceChainId } from "config/chains";
import {
  getSyntheticsCollateralEditAddressMapKey,
  getSyntheticsCollateralEditTokenIsFromTradingAccountMapKey,
} from "config/localStorage";
import { isSettlementChain } from "config/multichain";
import { useSettings } from "@/modules/lighter/context/SettingsContext";
import { useLocalStorageSerializeKey } from "lib/localStorage";

import { parsePositionKey } from "../positions";
export type PositionEditorState = ReturnType<typeof usePositionEditorState>;

export function usePositionEditorState(chainId: ContractsChainId, srcChainId: SourceChainId | undefined) {
  // const expressOrdersEnabled = useSelector(selectExpressOrdersEnabled);
  const { expressOrdersEnabled } = useSettings();
  const [editingPositionKey, setEditingPositionKey] = useState<string>();
  const [collateralInputValue, setCollateralInputValue] = useState("");
  const [selectedCollateralAddressMap, setSelectedCollateralAddressMap] = useLocalStorageSerializeKey<
    Partial<Record<Address, Address>>
  >(getSyntheticsCollateralEditAddressMapKey(chainId), {});
  const [_isCollateralTokenFromTradingAccount, _setIsCollateralTokenFromTradingAccount] = useLocalStorageSerializeKey<boolean>(
    getSyntheticsCollateralEditTokenIsFromTradingAccountMapKey(chainId),
    false
  );

  let isCollateralTokenFromTradingAccount = false;
  if (srcChainId !== undefined) {
    isCollateralTokenFromTradingAccount = true;
  } else if (!isSettlementChain(chainId)) {
    isCollateralTokenFromTradingAccount = false;
  } else {
    isCollateralTokenFromTradingAccount = Boolean(_isCollateralTokenFromTradingAccount);
  }

  let setIsCollateralTokenFromTradingAccount: (value: boolean) => void;
  if (srcChainId !== undefined) {
    setIsCollateralTokenFromTradingAccount = noop;
  } else if (!isSettlementChain(chainId)) {
    setIsCollateralTokenFromTradingAccount = noop;
  } else {
    setIsCollateralTokenFromTradingAccount = _setIsCollateralTokenFromTradingAccount;
  }

  const setSelectedCollateralAddress = useCallback(
    (selectedCollateralAddress: Address) => {
      if (!editingPositionKey) {
        return;
      }

      const { collateralAddress } = parsePositionKey(editingPositionKey);

      setSelectedCollateralAddressMap((prev) => ({ ...prev, [collateralAddress]: selectedCollateralAddress }));
    },
    [editingPositionKey, setSelectedCollateralAddressMap]
  );

  useEffect(() => {
    setEditingPositionKey(undefined);
    setCollateralInputValue("");
    _setIsCollateralTokenFromTradingAccount(srcChainId !== undefined);
  }, [_setIsCollateralTokenFromTradingAccount, chainId, srcChainId]);

  useEffect(
    function fallbackIsCollateralTokenFromTradingAccount() {
      if (expressOrdersEnabled) {
        return;
      }

      if (isCollateralTokenFromTradingAccount && !expressOrdersEnabled) {
        setIsCollateralTokenFromTradingAccount(false);
      }
    },
    [expressOrdersEnabled, isCollateralTokenFromTradingAccount, setIsCollateralTokenFromTradingAccount]
  );

  return useMemo(
    () => ({
      editingPositionKey,
      setEditingPositionKey,
      collateralInputValue,
      setCollateralInputValue,
      selectedCollateralAddressMap,
      setSelectedCollateralAddress,
      isCollateralTokenFromTradingAccount,
      setIsCollateralTokenFromTradingAccount,
    }),
    [
      collateralInputValue,
      editingPositionKey,
      selectedCollateralAddressMap,
      setSelectedCollateralAddress,
      isCollateralTokenFromTradingAccount,
      setIsCollateralTokenFromTradingAccount,
    ]
  );
}
