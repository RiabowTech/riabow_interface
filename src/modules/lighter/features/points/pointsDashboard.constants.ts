/**
 * 文档/产品侧「每日上限」展示（进度条用）。若后端日后返回 per-type cap，可在 hook 中覆盖。
 */
export const POINTS_DAILY_CAPS = {
  trading: 5000,
  pnl: 20000,
  holding: 40000,
  referral: 100,
} as const;
