import { Context, useContextSelector } from "use-context-selector";

import { TradingAccountContext, context } from "./TradingAccountContext";
import {
  selectTradingAccountDepositViewChain,
  selectTradingAccountDepositViewTokenAddress,
  selectTradingAccountDepositViewTokenInputValue,
  selectTradingAccountModalOpen,
  selectTradingAccountSelectedTransferGuid,
  selectTradingAccountSetDepositViewChain,
  selectTradingAccountSetDepositViewTokenAddress,
  selectTradingAccountSetDepositViewTokenInputValue,
  selectTradingAccountSetModalOpen,
  selectTradingAccountSetSelectedTransferGuid,
  selectTradingAccountSetSettlementChainId,
  selectTradingAccountsetWithdrawalViewChain,
  selectTradingAccountSetWithdrawalViewTokenAddress,
  selectTradingAccountSetWithdrawalViewTokenInputValue,
  selectTradingAccountSettlementChainId,
  selectTradingAccountWithdrawalViewChain,
  selectTradingAccountWithdrawalViewTokenAddress,
  selectTradingAccountWithdrawalViewTokenInputValue,
} from "./selectors";

export function useTradingAccountSelector<Selected>(selector: (s: TradingAccountContext) => Selected) {
  return useContextSelector(context as Context<TradingAccountContext>, selector) as Selected;
}

export function useTradingAccountModalOpen() {
  return [
    useTradingAccountSelector(selectTradingAccountModalOpen),
    useTradingAccountSelector(selectTradingAccountSetModalOpen),
  ] as const;
}

/**
 * If you just need the settlement chain id and not updating it, use `useChainId` instead
 */
export function useTradingAccountSettlementChainId() {
  return [
    useTradingAccountSelector(selectTradingAccountSettlementChainId),
    useTradingAccountSelector(selectTradingAccountSetSettlementChainId),
  ] as const;
}

export function useTradingAccountDepositViewChain() {
  return [
    useTradingAccountSelector(selectTradingAccountDepositViewChain),
    useTradingAccountSelector(selectTradingAccountSetDepositViewChain),
  ] as const;
}

export function useTradingAccountDepositViewTokenAddress() {
  return [
    useTradingAccountSelector(selectTradingAccountDepositViewTokenAddress),
    useTradingAccountSelector(selectTradingAccountSetDepositViewTokenAddress),
  ] as const;
}

export function useTradingAccountDepositViewTokenInputValue() {
  return [
    useTradingAccountSelector(selectTradingAccountDepositViewTokenInputValue),
    useTradingAccountSelector(selectTradingAccountSetDepositViewTokenInputValue),
  ] as const;
}

export function useTradingAccountWithdrawalViewChain() {
  return [
    useTradingAccountSelector(selectTradingAccountWithdrawalViewChain),
    useTradingAccountSelector(selectTradingAccountsetWithdrawalViewChain),
  ] as const;
}

export function useTradingAccountWithdrawalViewTokenAddress() {
  return [
    useTradingAccountSelector(selectTradingAccountWithdrawalViewTokenAddress),
    useTradingAccountSelector(selectTradingAccountSetWithdrawalViewTokenAddress),
  ] as const;
}

export function useTradingAccountWithdrawalViewTokenInputValue() {
  return [
    useTradingAccountSelector(selectTradingAccountWithdrawalViewTokenInputValue),
    useTradingAccountSelector(selectTradingAccountSetWithdrawalViewTokenInputValue),
  ] as const;
}

export function useTradingAccountSelectedTransferGuid() {
  return [
    useTradingAccountSelector(selectTradingAccountSelectedTransferGuid),
    useTradingAccountSelector(selectTradingAccountSetSelectedTransferGuid),
  ] as const;
}
