/**
 * 将 `POST /orders/preview` 返回的费率小数格式化为「百分比」展示字符串。
 *
 * 后端字段为小数费率（如 `"0.000360"` 表示每笔名义金额的 0.036%），
 * 若用 `(n * 100).toFixed(2)` 会把 0.036% 四舍五入成 0.04%，与接口数值观感不一致。
 */
export function formatPreviewFeeRatePercent(raw?: string | null): string {
  if (raw === undefined || raw === null) return "-";
  const trimmed = String(raw).trim();
  if (trimmed === "") return "-";
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return "-";
  /** 在「已乘 100」的百分比空间里做定点舍入，减轻 0.000360→0.035999… 的浮点误差 */
  const pct = Math.round(n * 100 * 1e8) / 1e8;
  if (!Number.isFinite(pct)) return "-";
  if (pct === 0) return "0%";
  const s = pct.toFixed(8).replace(/\.?0+$/, "");
  return `${s === "-0" ? "0" : s}%`;
}
