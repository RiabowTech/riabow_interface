import { Abi, Address } from "viem";

import { abis } from "sdk/abis";
import { getWrappedToken } from "sdk/configs/tokens";

import type { TradingSdk } from "../../../index";

export type WrapOrUnwrapParams = {
  amount: bigint;
  isWrap: boolean;
};

export function createWrapOrUnwrapTxn(sdk: TradingSdk, p: WrapOrUnwrapParams) {
  const wrappedToken = getWrappedToken(sdk.chainId);

  if (p.isWrap) {
    return sdk.callContract(wrappedToken.address as Address, abis.WETH as Abi, "deposit", [], {
      value: p.amount,
    });
  } else {
    return sdk.callContract(wrappedToken.address as Address, abis.WETH as Abi, "withdraw", [p.amount]);
  }
}
