/**
 * 统一 funding 费率格式化:截断(非四舍五入)到固定小数位。
 *
 * 三处共用(必须一致):
 * - SymbolBar "1hr Funding"
 * - FundingPanel "Real-Time Funding Rate"
 * - Funding 图表 tooltip / 数据点
 *
 * @param pct 已经乘以 100 的百分数(例如 -0.0016 表示 -0.0016%)
 * @param fractionDigits 保留的小数位数(默认 4)
 */
export function formatFundingPct(pct: number | null, fractionDigits = 4): string {
  if (pct == null || !Number.isFinite(pct)) return "-";
  const sign = pct < 0 ? "-" : "";
  const abs = Math.abs(pct);
  const scale = Math.pow(10, fractionDigits);
  // 截断:先放大再 floor 再缩小,避免 toFixed 的银行家四舍五入
  const truncated = Math.floor(abs * scale) / scale;
  return `${sign}${truncated.toFixed(fractionDigits)}%`;
}
