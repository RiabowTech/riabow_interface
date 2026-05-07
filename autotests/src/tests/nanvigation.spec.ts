import { expect } from "@playwright/test";
import { test } from "../base";

test.describe("Should navigate across all pages with no crashes", () => {
  test.afterEach(async ({ primit }) => {
    await primit.page.close();
  });

  test("/trade", async ({ primit }) => {
    await primit.navigateTo("/trade");
    await primit.tradebox.root.waitForSelector();
    expect(primit.tradebox.root).toBeAttached();
  });

  test("/dashboard", async ({ primit }) => {
    await primit.navigateTo("/dashboard");
    await primit.dashboardPage.waitForSelector();
    expect(primit.dashboardPage).toBeAttached();
  });

  test("/earn", async ({ primit }) => {
    await primit.navigateTo("/earn");
    await primit.earnPage.waitForSelector();
    expect(primit.earnPage).toBeAttached();
  });

  test("/leaderboard", async ({ primit }) => {
    await primit.navigateTo("/leaderboard");
    await primit.leaderboardPage.waitForSelector();
    expect(primit.leaderboardPage).toBeAttached();
  });

  test("/ecosystem", async ({ primit }) => {
    await primit.navigateTo("/ecosystem");
    await primit.ecosystemPage.waitForSelector();
    expect(primit.ecosystemPage).toBeAttached();
  });

  test("/buy_glp", async ({ primit }) => {
    await primit.navigateTo("/buy_glp");
    await primit.buyGlpPage.waitForSelector();
    expect(primit.buyGlpPage).toBeAttached();
  });

  test("/pools", async ({ primit }) => {
    await primit.navigateTo("/pools");
    await primit.poolsPage.waitForSelector();
    expect(primit.poolsPage).toBeAttached();
  });

  test("/referrals", async ({ primit }) => {
    await primit.navigateTo("/referrals");
    await primit.referralsPage.waitForSelector();
    expect(primit.referralsPage).toBeAttached();
  });

  test("open settings modal", async ({ primit }) => {
    await primit.navigateTo("/trade");
    await primit.openSettings();
    await primit.settings.modal.root.waitForSelector();
    expect(await primit.settings.modal.root).toBeAttached();
  });
});
