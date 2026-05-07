import { describe, expect, it } from "vitest";

import { SETTLEMENT_CHAINS, SOURCE_CHAINS } from "config/multichain";
import {
  ARBITRUM_SEPOLIA,
  getChainName,
  SOURCE_BASE_MAINNET,
  SOURCE_BSC_MAINNET,
  SOURCE_OPTIMISM_SEPOLIA,
  SOURCE_SEPOLIA,
  SourceChainId,
} from "sdk/configs/chains";
import { getNativeToken } from "sdk/configs/tokens";

import { areChainsRelated } from "../areChainsRelated";
import { NATIVE_TOKEN_PRICE_MAP } from "../nativeTokenPriceMap";

// In development mode `multichain.ts` pushes ARBITRUM_SEPOLIA into SOURCE_CHAINS
// for same-chain deposits, so the symbol map must cover it as well.
const SOURCE_CHAIN_NATIVE_SYMBOL_MAP: Record<SourceChainId | typeof ARBITRUM_SEPOLIA, string> = {
  [SOURCE_OPTIMISM_SEPOLIA]: "ETH",
  [SOURCE_SEPOLIA]: "ETH",
  [SOURCE_BASE_MAINNET]: "ETH",
  [SOURCE_BSC_MAINNET]: "BNB",
  [ARBITRUM_SEPOLIA]: "ETH",
};

describe("NATIVE_TOKEN_PRICE_MAP", () => {
  it("should be defined", () => {
    for (const srcChainId of SOURCE_CHAINS) {
      for (const settlementChainId of SETTLEMENT_CHAINS) {
        if (!areChainsRelated(settlementChainId, srcChainId)) {
          continue;
        }

        const srcChainNativeSymbol = SOURCE_CHAIN_NATIVE_SYMBOL_MAP[srcChainId];
        const settlementChainNativeSymbol = getNativeToken(settlementChainId).symbol;

        if (srcChainNativeSymbol === settlementChainNativeSymbol) {
          continue;
        }

        expect(
          Object.keys(NATIVE_TOKEN_PRICE_MAP[srcChainId]?.[settlementChainId] ?? {}).length > 0,
          `Native token price map is not defined for ${getChainName(srcChainId)} -> ${getChainName(settlementChainId)}`
        ).toBeTruthy();
      }
    }
  });
});
