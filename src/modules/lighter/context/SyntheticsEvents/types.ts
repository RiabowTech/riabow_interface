import type { MultichainFundingHistoryItem } from "@/modules/lighter/domain/multichain/types";
import type { OrderType } from "domain/synthetics/orders";

import type { MultichainEventsState } from "./useMultichainEvents";

/**
 * Why this file is small now:
 *
 * The GMX synthetics order/position/deposit/withdrawal/shift state machines
 * were dismantled along with the SyntheticsEventsProvider slim-down. The
 * types those state machines plumbed (`OrderCreatedEventData`,
 * `PendingDepositData`, `OrderStatuses`, `MultiTransactionStatus`, …) went
 * with them.
 *
 * What stays:
 *   - `PositionIncreaseEvent` / `PositionDecreaseEvent` / `PendingPositionUpdate`
 *     — referenced by `usePositions` / `getPendingMockPosition` as the on-chain
 *     event shapes, even though the live optimistic-overlay code path is no
 *     longer wired.
 *   - `ApprovalStatuses` — read by `useTokenAllowanceData`.
 *   - `Submitted*` / `PendingMultichainFunding` — multichain bridge state
 *     produced by `useMultichainEvents`, consumed by the trading-account
 *     modal and funding history hooks.
 */

export type PositionIncreaseEvent = {
  positionKey: string;
  contractPositionKey: string;
  account: string;
  marketAddress: string;
  collateralTokenAddress: string;
  sizeInUsd: bigint;
  sizeInTokens: bigint;
  collateralAmount: bigint;
  borrowingFactor: bigint;
  executionPrice: bigint;
  sizeDeltaUsd: bigint;
  sizeDeltaInTokens: bigint;
  longTokenFundingAmountPerSize: bigint;
  shortTokenFundingAmountPerSize: bigint;
  collateralDeltaAmount: bigint;
  isLong: boolean;
  orderType: OrderType;
  orderKey: string;
  increasedAtTime: bigint;
};

export type PositionDecreaseEvent = {
  positionKey: string;
  contractPositionKey: string;
  account: string;
  marketAddress: string;
  collateralTokenAddress: string;
  sizeInUsd: bigint;
  sizeInTokens: bigint;
  sizeDeltaUsd: bigint;
  sizeDeltaInTokens: bigint;
  collateralAmount: bigint;
  collateralDeltaAmount: bigint;
  borrowingFactor: bigint;
  longTokenFundingAmountPerSize: bigint;
  shortTokenFundingAmountPerSize: bigint;
  pnlUsd: bigint;
  isLong: boolean;
  orderType: OrderType;
  orderKey: string;
  decreasedAtTime: bigint;
};

export type PendingPositionUpdate = {
  isIncrease: boolean;
  positionKey: string;
  sizeDeltaUsd: bigint;
  sizeDeltaInTokens: bigint;
  collateralDeltaAmount: bigint;
  updatedAt: number;
  updatedAtBlock: bigint;
};

export type SubmittedMultichainDeposit = {
  amount: bigint;
  settlementChainId: number;
  sourceChainId: number;
  tokenAddress: string;
  sentTxn: string;
};

export type SubmittedMultichainWithdrawal = {
  amount: bigint;
  settlementChainId: number;
  sourceChainId: number;
  tokenAddress: string;
};

export type PendingMultichainFunding = MultichainFundingHistoryItem[];

export type ApprovalStatuses = {
  [tokenAddress: string]: {
    [spender: string]: { value: bigint; createdAt: number };
  };
};

export type SyntheticsEventsContextType = MultichainEventsState & {
  approvalStatuses: ApprovalStatuses;
};
