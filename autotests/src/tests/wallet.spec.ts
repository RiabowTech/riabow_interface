import { expect } from "@playwright/test";
import { test } from "../base";

test.describe("Wallet", () => {
  test.afterEach(async ({ primit }) => {
    await primit.page.close();
  });

  test("Should able to connect wallet", async ({ page, primit }) => {
    await page.goto(primit.baseUrl);
    await page.waitForSelector(primit.header.userAddress.selector);
    const element = await page.$(primit.header.userAddress.selector);
    expect(element).not.toBeNull();
  });
});
