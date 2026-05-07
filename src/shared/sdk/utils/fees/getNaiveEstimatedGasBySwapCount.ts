import type { GasLimitsConfig } from "sdk/types/fees";

export function getNaiveEstimatedGasBySwapCount(singleSwap: GasLimitsConfig["singleSwap"], swapsCount: number): bigint {
  const swapsCountBigint = BigInt(swapsCount);

  return singleSwap * swapsCountBigint;
}
