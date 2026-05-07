import type { ReferralLeaderboardEntry } from "../types";

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

function normalizeEntry(raw: unknown): ReferralLeaderboardEntry | null {
  if (!isRecord(raw)) return null;
  const rank = typeof raw.rank === "number" ? raw.rank : Number(raw.rank);
  const addr = raw.referrer_address;
  const commission = raw.total_commission;
  const computed =
    typeof raw.computed_at === "number"
      ? raw.computed_at
      : typeof raw.computed_at === "string"
        ? Number(raw.computed_at)
        : NaN;
  if (!Number.isFinite(rank) || rank < 1) return null;
  if (typeof addr !== "string" || !addr.trim()) return null;
  if (typeof commission !== "string" || !commission.trim()) return null;
  if (!Number.isFinite(computed)) return null;
  return {
    rank,
    referrer_address: addr.trim(),
    total_commission: commission.trim(),
    computed_at: Math.trunc(computed),
  };
}

/**
 * 解析 `GET /referral/leaderboard` 响应：直出数组或 `{ data: [] }`。
 */
export function normalizeReferralLeaderboardResponse(raw: unknown): ReferralLeaderboardEntry[] {
  const list: unknown[] = Array.isArray(raw)
    ? raw
    : isRecord(raw) && Array.isArray(raw.data)
      ? raw.data
      : [];
  const out: ReferralLeaderboardEntry[] = [];
  for (const item of list) {
    const row = normalizeEntry(item);
    if (row) out.push(row);
  }
  return out;
}
