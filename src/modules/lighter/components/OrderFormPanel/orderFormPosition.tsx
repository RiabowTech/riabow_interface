import { ReactNode } from "react";

import type { LighterPosition } from "../../adapters/usePositionsAdapter";

function formatTrimmed(value: number, maxDecimals = 6) {
  if (!Number.isFinite(value) || value <= 0) return "-";
  return parseFloat(value.toFixed(maxDecimals)).toString();
}

export function getCurrentOrderFormPosition(positions: LighterPosition[], baseSymbol: string) {
  return positions.find((position) => position.market === baseSymbol) ?? null;
}

export function getCurrentOrderFormPositionValue(
  currentPosition: LighterPosition | null,
  baseSymbol: string
): ReactNode {
  const currentPositionAmount = currentPosition?.sizeTokenAmount ?? 0;

  if (currentPositionAmount <= 0) {
    return "-";
  }

  return (
    <span className={currentPosition?.side === "short" ? "ltr-down" : "ltr-up"}>
      {formatTrimmed(currentPositionAmount, 4)} {baseSymbol}
    </span>
  );
}

function getSignedPositionAmount(currentPosition: LighterPosition | null) {
  const amount = currentPosition?.sizeTokenAmount ?? 0;

  if (amount <= 0) {
    return 0;
  }

  return currentPosition?.side === "short" ? -amount : amount;
}

function getProjectedSignedPositionAmount(
  currentPosition: LighterPosition | null,
  amount: number,
  side: "buy" | "sell",
  reduceOnly: boolean
) {
  const currentSignedAmount = getSignedPositionAmount(currentPosition);

  if (!Number.isFinite(amount) || amount <= 0) {
    return currentSignedAmount;
  }

  const delta = side === "buy" ? amount : -amount;

  if (!reduceOnly) {
    return currentSignedAmount + delta;
  }

  if (currentSignedAmount === 0) {
    return 0;
  }

  if (Math.sign(currentSignedAmount) === Math.sign(delta)) {
    return currentSignedAmount;
  }

  const nextSignedAmount = currentSignedAmount + delta;

  if (Math.sign(nextSignedAmount) !== Math.sign(currentSignedAmount)) {
    return 0;
  }

  return nextSignedAmount;
}

export function getProjectedOrderFormPositionValue(
  currentPosition: LighterPosition | null,
  baseSymbol: string,
  amount: number,
  side: "buy" | "sell",
  reduceOnly: boolean
): ReactNode {
  const projectedSignedAmount = getProjectedSignedPositionAmount(currentPosition, amount, side, reduceOnly);

  if (!Number.isFinite(projectedSignedAmount) || projectedSignedAmount === 0) {
    return "-";
  }

  const isShort = projectedSignedAmount < 0;
  const displayAmount = Math.abs(projectedSignedAmount);

  return (
    <span className={isShort ? "ltr-down" : "ltr-up"}>
      {formatTrimmed(displayAmount, 4)} {baseSymbol}
    </span>
  );
}
