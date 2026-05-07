import { createSelectionContext } from "@taskworld.com/rereselect";

import { getToken } from "sdk/configs/tokens";
import { parseValue } from "sdk/utils/numbers";

import type { TradingAccountContext } from "./TradingAccountContext";

//#region Pure selectors

export const selectTradingAccountModalOpen = (s: TradingAccountContext) => s.modalOpen;
export const selectTradingAccountSetModalOpen = (s: TradingAccountContext) => s.setModalOpen;

export const selectTradingAccountSettlementChainId = (s: TradingAccountContext) => s.settlementChainId;
export const selectTradingAccountSetSettlementChainId = (s: TradingAccountContext) => s.setSettlementChainId;

export const selectTradingAccountDepositViewChain = (s: TradingAccountContext) => s.depositViewChain;
export const selectTradingAccountSetDepositViewChain = (s: TradingAccountContext) => s.setDepositViewChain;
export const selectTradingAccountDepositViewTokenAddress = (s: TradingAccountContext) => s.depositViewTokenAddress;
export const selectTradingAccountSetDepositViewTokenAddress = (s: TradingAccountContext) => s.setDepositViewTokenAddress;
export const selectTradingAccountDepositViewTokenInputValue = (s: TradingAccountContext) => s.depositViewTokenInputValue;
export const selectTradingAccountSetDepositViewTokenInputValue = (s: TradingAccountContext) => s.setDepositViewTokenInputValue;

export const selectTradingAccountWithdrawalViewChain = (s: TradingAccountContext) => s.withdrawalViewChain;
export const selectTradingAccountsetWithdrawalViewChain = (s: TradingAccountContext) => s.setWithdrawalViewChain;
export const selectTradingAccountWithdrawalViewTokenAddress = (s: TradingAccountContext) => s.withdrawalViewTokenAddress;
export const selectTradingAccountSetWithdrawalViewTokenAddress = (s: TradingAccountContext) => s.setWithdrawalViewTokenAddress;
export const selectTradingAccountWithdrawalViewTokenInputValue = (s: TradingAccountContext) => s.withdrawalViewTokenInputValue;
export const selectTradingAccountSetWithdrawalViewTokenInputValue = (s: TradingAccountContext) =>
  s.setWithdrawalViewTokenInputValue;

export const selectTradingAccountSelectedTransferGuid = (s: TradingAccountContext) => s.selectedTransferGuid;
export const selectTradingAccountSetSelectedTransferGuid = (s: TradingAccountContext) => s.setSelectedTransferGuid;

//#endregion Pure selectors

//#region Derived selectors

const selectionContext = createSelectionContext<TradingAccountContext>();
const createSelector = selectionContext.makeSelector;

export const selectTradingAccountDepositViewTokenInputAmount = createSelector((q) => {
  const settlementChainId = q(selectTradingAccountSettlementChainId);

  const tokenAddress = q(selectTradingAccountDepositViewTokenAddress);

  if (tokenAddress === undefined) {
    return undefined;
  }

  const inputValue = q(selectTradingAccountDepositViewTokenInputValue);

  if (inputValue === undefined) {
    return undefined;
  }

  const token = getToken(settlementChainId, tokenAddress);

  return parseValue(inputValue, token.decimals);
});

//#endregion Derived selectors
