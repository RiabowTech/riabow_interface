import { describe, expect, it } from "vitest";

import type { OrdersInfoData } from "@/modules/lighter/domain/synthetics/orders/types";

import {
  findOrderKeyByOriginalOrderId,
  mapApiOrderToLighterOpenOrder,
  normalizeTimestamp,
  symbolToMarket,
} from "./lighterOpenOrders";

describe("lighterOpenOrders helpers", () => {
  it("finds the sdk order key from original api order id", () => {
    const ordersInfoData = {
      orderA: { key: "orderA", originalOrderId: "api-a" },
      orderB: { key: "orderB", originalOrderId: "api-b" },
    } as OrdersInfoData;

    expect(findOrderKeyByOriginalOrderId(ordersInfoData, "api-b")).toBe("orderB");
    expect(findOrderKeyByOriginalOrderId(ordersInfoData, "missing")).toBeUndefined();
  });

  it("maps an api order into the lighter open order shape", () => {
    const result = mapApiOrderToLighterOpenOrder(
      {
        id: "123",
        symbol: "POLUSDT",
        side: "buy",
        order_type: "limit",
        size: "125",
        price: "0.08",
        trigger_price: "0.081",
        filled_size: "20",
        mark_price: "0.086514",
        status: "open",
        reduce_only: false,
        time_in_force: "GTC",
        created_at: "2026-04-16T06:10:48.000Z",
        updated_at: 1713240000,
      },
      "sdk-key-1"
    );

    expect(result).toMatchObject({
      id: "123",
      orderKey: "sdk-key-1",
      market: "POL",
      side: "long",
      type: "limit",
      triggerType: null,
      amount: 125,
      filled: 20,
      price: 0.08,
      markPrice: 0.086514,
      reduceOnly: false,
      triggerConditions: "0.081",
      status: "open",
    });
    expect(result.createdAt).toBe(normalizeTimestamp("2026-04-16T06:10:48.000Z"));
  });

  it("normalizes symbol and timestamps consistently", () => {
    expect(symbolToMarket("BTCUSDT")).toBe("BTC");
    expect(symbolToMarket("ETHUSD")).toBe("ETH");
    expect(normalizeTimestamp(1713240000)).toBe(1713240000 * 1000);
  });

  it("preserves trigger type from trigger orders", () => {
    const result = mapApiOrderToLighterOpenOrder(
      {
        id: "trigger-1",
        symbol: "BTCUSDT",
        side: "buy",
        order_type: "stop_limit",
        trigger_type: "StopLimit",
        size: "707.0519999999999",
        price: "81000",
        trigger_price: "80000",
        filled_size: "0",
        status: "open",
        reduce_only: false,
        time_in_force: "GTC",
        created_at: "2026-04-21T07:23:39.543148Z",
        updated_at: "2026-04-21T07:23:39.543148Z",
      },
      undefined
    );

    expect(result.triggerType).toBe("StopLimit");
    expect(result.type).toBe("limit");
  });
});
