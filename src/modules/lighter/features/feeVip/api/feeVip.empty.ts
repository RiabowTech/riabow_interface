import type { FeeVipSummary } from "./feeVip.types";
import { feeVipDataSourceFromEnv } from "./feeVipEnv";

/** 未登录（无 JWT）或接口未返回档位时的空模型。 */
export function getEmptyFeeVipSummary(): FeeVipSummary {
  if (feeVipDataSourceFromEnv() === "points_tier") {
    return { scheduleKind: "points_trading_tier", tiers: [], user: null };
  }
  return { scheduleKind: "trading_fee_vip", tiers: [], user: null };
}
