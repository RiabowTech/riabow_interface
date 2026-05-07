import { describe, expect, it } from "vitest";

import { arbitrumSdk } from "sdk/utils/testUtil";

// Integration test against live Arbitrum mainnet (RPC + Subsquid). Skipped in CI;
// run manually when verifying upstream GMX SDK compatibility.
describe.skip("Trades", () => {
  it("should be able to get positions", async () => {
    const { marketsInfoData, tokensData } = await arbitrumSdk.markets.getMarketsInfo();

    const trades = await arbitrumSdk.trades.getTradeHistory({
      forAllAccounts: false,
      pageSize: 50,
      marketsInfoData,
      tokensData,
      pageIndex: 0,
    });

    expect(trades).toBeDefined();
  });
});
