import { expect } from "@playwright/test";
import { test } from "../base";

test.describe.serial("Trades", () => {
  test.afterEach(async ({ page }) => {
    await page.close();
  });

  test.describe("Market", () => {
    test("increase market position", async ({ page, primit }) => {
      await page.goto(primit.baseUrl);

      await primit.tradebox.selectDirection("Long");
      await primit.tradebox.selectMode("Market");

      await primit.tradebox.selectMarket("WBTC/USD");
      await primit.tradebox.selectCollateral("AVAX");

      await primit.tradebox.selectPool("WBTC-USDC");
      await primit.tradebox.selectCollateralIn("USDC");

      await primit.tradebox.payInput.fill("0.1");
      await primit.tradebox.setLeverage("2x");

      expect(primit.tradebox.confirmTradeButton).toBeEnabled();

      await primit.tradebox.confirmTradeButton.click();
      await primit.wallet.confirmTransaction();
      await primit.page.waitForTimeout(1000);

      const position = await primit.getPosition("WBTC/USD", "WBTC-USDC", "Long");
      const isPositionPresent = await primit.has(position.root);

      expect(isPositionPresent).toBeTruthy();
    });

    test("edit position deposit", async ({ page, primit }) => {
      await page.goto(primit.baseUrl);

      const position = await primit.getPosition("WBTC/USD", "WBTC-USDC", "Long");
      position.root.waitForVisible();

      expect(position.root).toBeVisible();
      const collateral = await position.getCollateral();

      await position.deposit("2");

      const newCollateral = await position.getCollateral();
      expect(newCollateral !== collateral).toBeTruthy();
    });

    test("edit position withdraw 25%", async ({ page, primit }) => {
      await page.goto(primit.baseUrl);

      const position = await primit.getPosition("WBTC/USD", "WBTC-USDC", "Long");
      position.root.waitForVisible();

      expect(position.root).toBeVisible();
      const collateral = await position.getCollateral();

      await position.withdraw("25%");

      const newCollateral = await position.getCollateral();
      expect(newCollateral !== collateral).toBeTruthy();
    });

    test("close position partially", async ({ page, primit }) => {
      await page.goto(primit.baseUrl);

      const position = await primit.getPosition("WBTC/USD", "WBTC-USDC", "Long");
      position.root.waitForVisible();

      expect(position.root).toBeVisible();
      const collateral = await position.getCollateral();

      await position.closePartially("25%");

      const newCollateral = await position.getCollateral();
      expect(newCollateral !== collateral).toBeTruthy();
    });

    test("close position full", async ({ page, primit }) => {
      await page.goto(primit.baseUrl);

      const position = await primit.getPosition("WBTC/USD", "WBTC-USDC", "Long");
      position.root.waitForVisible();

      expect(position.root).toBeVisible();
      await position.closeFull();

      await position.root.waitForDetached();
      expect(position.root).not.toBeAttached();
    });
  });

  test.describe.skip("Limit", () => {
    test("create limit position", async ({ page, primit }) => {
      await page.goto(primit.baseUrl);

      await primit.tradebox.selectDirection("Long");
      await primit.tradebox.selectMode("Limit");

      await primit.tradebox.selectMarket("BTC/USD");
      await primit.tradebox.selectCollateral("AVAX");

      await primit.tradebox.selectPool("WBTC-USDC");
      await primit.tradebox.selectCollateralIn("USDC");

      await primit.tradebox.payInput.fill("0.1");
      await primit.tradebox.setLeverage("2x");

      const price = await primit.header.getPrice();

      const limitPrice = Number(price.replace(/[\$,]/g, "")) * 0.9;

      await primit.tradebox.triggerPriceInput.fill(limitPrice.toString());

      expect(primit.tradebox.confirmTradeButton).toBeEnabled();

      await primit.tradebox.confirmTradeButton.click();
      await primit.wallet.confirmTransaction();

      const position = await primit.getPosition("WBTC/USD", "WBTC-USDC", "Long");

      await position.root.waitForSelector();
      expect(position.root).toBeAttached();
    });
  });
});
