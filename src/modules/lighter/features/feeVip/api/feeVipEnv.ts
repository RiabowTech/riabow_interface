/**
 * 单一环境变量 `VITE_FEE_VIP_MOCK` 控制 Fee VIP mock：
 * - `off` / `false` / `0`：走真实 HTTP
 * - `on` / `true` / `1` / `stable`：mock，数据随场景/地址稳定（可复现）
 * - `random`：mock + 每次请求随机 VIP 档、14D 量等
 *
 * 未设置时：一律等价 `off`（走真实接口）；仅当显式设为 `on`/`true`/`1`/`stable`/`random` 时才启用 mock（便于本地 UI 调试）。
 *
 * 兼容旧变量（若仍配置则优先于「未设置」推断）：`VITE_FEE_VIP_USE_MOCK`、`VITE_FEE_VIP_MOCK_RANDOMIZE`
 */
export type FeeVipMockEnvMode = "off" | "stable" | "random";

function norm(s: string | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

export function getFeeVipMockEnvMode(): FeeVipMockEnvMode {
  const u = norm(import.meta.env.VITE_FEE_VIP_MOCK as string | undefined);

  if (u === "random") return "random";
  if (u === "off" || u === "false" || u === "0") return "off";
  if (u === "on" || u === "true" || u === "1" || u === "stable") return "stable";

  const legacyUse = norm(import.meta.env.VITE_FEE_VIP_USE_MOCK as string | undefined);
  const legacyRand = norm(import.meta.env.VITE_FEE_VIP_MOCK_RANDOMIZE as string | undefined);
  if (legacyRand === "true" && legacyUse !== "false" && legacyUse !== "0") return "random";
  if (legacyUse === "true" || legacyUse === "1") return "stable";
  if (legacyUse === "false" || legacyUse === "0") return "off";

  return "off";
}

export function feeVipUseMockFromEnv(): boolean {
  return getFeeVipMockEnvMode() !== "off";
}

export function feeVipMockRandomizeFromEnv(): boolean {
  return getFeeVipMockEnvMode() === "random";
}

/**
 * Fee & VIP 页真实数据来源（mock 关闭时）：
 * - `primit_fee_info`（默认）：`GET {getTradingBackendUrl}/api/v1/account/fee-info`（Primit U 本位 VIP / 手续费，与开发者文档一致）
 * - `points_tier`：`GET {getPointsApiUrl}/points/tier` + 静态 T1–T3（积分系统 §6，仅当显式配置）
 * - `legacy_fee_summary`：`GET {getTradingBackendUrl}/api/v1/account/fee-vip-summary` 旧约定
 */
export type FeeVipDataSource = "points_tier" | "primit_fee_info" | "legacy_fee_summary";

export function feeVipDataSourceFromEnv(): FeeVipDataSource {
  const u = norm(import.meta.env.VITE_FEE_VIP_DATA_SOURCE as string | undefined);
  if (u === "legacy" || u === "legacy_fee_summary" || u === "fee_summary") return "legacy_fee_summary";
  if (u === "points" || u === "points_tier" || u === "tp" || u === "trading_points") return "points_tier";
  if (u === "primit" || u === "primit_fee_info" || u === "fee_info" || u === "account_fee_info") return "primit_fee_info";
  return "primit_fee_info";
}
