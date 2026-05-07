import { Abi, encodeFunctionData } from "viem";

import { abis } from "sdk/abis";
import { getContract } from "sdk/configs/contracts";

import type { TradingSdk } from "../../../index";

export type CancelOrderParams = {
  orderKeys: string[];
};

export async function cancelOrdersTxn(sdk: TradingSdk, p: CancelOrderParams) {
  const multicall = createCancelEncodedPayload(p.orderKeys);
  const exchangeRouter = getContract(sdk.chainId, "ExchangeRouter");
  return sdk.callContract(exchangeRouter, abis.ExchangeRouter as Abi, "multicall", [multicall]);
}

export function createCancelEncodedPayload(orderKeys: (string | null)[] = []) {
  return orderKeys.filter(Boolean).map((orderKey) =>
    encodeFunctionData({
      abi: abis.ExchangeRouter as Abi,
      functionName: "cancelOrder",
      args: [orderKey],
    })
  );
}
