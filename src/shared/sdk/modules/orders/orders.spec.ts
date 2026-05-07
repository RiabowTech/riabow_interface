import { describe, expect, it } from "vitest";

import { arbitrumSdk } from "sdk/utils/testUtil";

// Integration test against live Arbitrum mainnet (RPC + Subsquid). Skipped in CI;
// run manually when verifying upstream GMX SDK compatibility.
describe.skip("Positions", () => {
  describe("read", () => {
    it("should be able to get orders", async () => {
      const { marketsInfoData, tokensData } = (await arbitrumSdk.markets.getMarketsInfo()) ?? {};

      if (!tokensData || !marketsInfoData) {
        throw new Error("Tokens data or markets info is not available");
      }

      const orders = await arbitrumSdk.orders.getOrders({
        marketsInfoData,
        tokensData,
      });
      expect(orders).toBeDefined();
    });
  });
});
