import type {
  BoundReferral,
  OnChainDashboard,
  OnChainDashboardResponse,
  ReferralActivity,
  ReferralDashboardResponse,
  ReferralTier,
} from "../types";

function isRecord(x: unknown): x is Record<string, unknown> {
  return x !== null && typeof x === "object";
}

/** 解包 `{ success, data }` 或直接使用扁平 JSON */
function unwrapDashboardBody(raw: unknown): Record<string, unknown> | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.success === "boolean" && raw.data !== undefined && raw.data !== null && isRecord(raw.data)) {
    return raw.data as Record<string, unknown>;
  }
  if (raw.data !== undefined && raw.data !== null && isRecord(raw.data) && !("total_referrals" in raw)) {
    return raw.data as Record<string, unknown>;
  }
  return raw;
}

function normalizeTier(raw: unknown): ReferralTier | null {
  if (raw === null || raw === undefined) return null;
  if (!isRecord(raw)) return null;

  const nextRefRaw = raw.next_tier_referrals ?? raw.next_tier_requirement;
  let next_tier_referrals: number | null = null;
  if (nextRefRaw !== null && nextRefRaw !== undefined && nextRefRaw !== "") {
    const n = typeof nextRefRaw === "number" ? nextRefRaw : Number(nextRefRaw);
    next_tier_referrals = Number.isFinite(n) ? n : null;
  }

  const ntv = raw.next_tier_volume;
  const next_tier_volume =
    ntv === null || ntv === undefined ? null : typeof ntv === "string" ? ntv : String(ntv);

  const rateBpsRaw = raw.rate_bps;
  let rate_bps =
    typeof rateBpsRaw === "number" && Number.isFinite(rateBpsRaw)
      ? rateBpsRaw
      : Number(rateBpsRaw) || 0;
  if (!rate_bps) {
    const cr = parseFloat(String(raw.commission_rate ?? ""));
    if (Number.isFinite(cr) && cr > 0 && cr <= 1) {
      rate_bps = Math.round(cr * 10000);
    }
  }

  const legacyReq =
    typeof raw.next_tier_requirement === "number" && Number.isFinite(raw.next_tier_requirement)
      ? raw.next_tier_requirement
      : next_tier_referrals != null && Number.isFinite(next_tier_referrals)
        ? next_tier_referrals
        : 0;

  return {
    level: Number(raw.level) || 0,
    name: String(raw.name ?? ""),
    commission_rate: String(raw.commission_rate ?? ""),
    rate_bps,
    next_tier_referrals,
    next_tier_volume,
    next_tier_requirement: legacyReq,
  };
}

function normalizeActivityList(raw: unknown): ReferralActivity[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    if (!isRecord(item)) {
      return {
        referral_address: "",
        event_type: "",
        volume: "0",
        commission: "0",
        timestamp: 0,
      };
    }
    return {
      referral_address: String(item.referral_address ?? ""),
      event_type: String(item.event_type ?? ""),
      volume: String(item.volume ?? "0"),
      commission: String(item.commission ?? "0"),
      timestamp: typeof item.timestamp === "number" ? item.timestamp : Number(item.timestamp) || 0,
    };
  });
}

function normalizeBound(raw: unknown): BoundReferral | null {
  if (raw === null || raw === undefined) return null;
  if (!isRecord(raw)) return null;
  const code = String(raw.code ?? "");
  const referrer_address = String(raw.referrer_address ?? "");
  if (!code && !referrer_address) return null;
  const ba = raw.bound_at;
  const bound_at =
    typeof ba === "number" && Number.isFinite(ba) ? ba : typeof ba === "string" ? ba : String(ba ?? "");
  return { code, referrer_address, bound_at };
}

/**
 * 将 `GET /referral/dashboard` 的扁平或信封 JSON 规范为前端使用的 {@link ReferralDashboardResponse}。
 */
export function normalizeReferralDashboardResponse(raw: unknown): ReferralDashboardResponse {
  const body = unwrapDashboardBody(raw);
  if (!body) {
    throw new Error("Invalid referral dashboard response");
  }

  const tierRaw = body.tier;
  const tier = tierRaw === null || tierRaw === undefined ? null : normalizeTier(tierRaw);

  const totalRef = body.total_referrals;
  const activeRef = body.active_referrals;

  const totalReferred =
    body.total_referred_volume != null
      ? String(body.total_referred_volume)
      : body.total_volume != null
        ? String(body.total_volume)
        : "0.00";

  return {
    code: body.code === null || body.code === undefined ? null : String(body.code),
    total_referrals: typeof totalRef === "number" ? totalRef : Number(totalRef) || 0,
    active_referrals: typeof activeRef === "number" ? activeRef : Number(activeRef) || 0,
    total_referred_volume: totalReferred,
    total_earnings: String(body.total_earnings ?? "0"),
    pending_earnings: String(body.pending_earnings ?? "0"),
    claimed_earnings: String(body.claimed_earnings ?? "0"),
    tier,
    tier_note: body.tier_note == null ? null : String(body.tier_note),
    recent_activity: normalizeActivityList(body.recent_activity),
    bound_referral: normalizeBound(body.bound_referral),
  };
}

/** 兼容旧「链上面板」字段名：数据来自 `GET /referral/dashboard`（JWT）。 */
export function mapReferralDashboardToOnChainResponse(d: ReferralDashboardResponse): OnChainDashboardResponse {
  const tier = d.tier;
  return {
    code: d.code ?? "",
    total_referees: d.total_referrals,
    total_volume_usd: d.total_referred_volume ?? "0",
    total_earnings_usd: d.total_earnings,
    claimed_earnings_usd: d.claimed_earnings,
    claimable_earnings_usd: d.pending_earnings,
    current_tier: tier?.level ?? 0,
    current_rate_bps: tier?.rate_bps ?? 0,
    tier_name: tier?.name ?? "",
  };
}

/** 兼容旧交易所 `OnChainDashboard` 形态（同上，来自 `/referral/dashboard`）。 */
export function mapReferralDashboardToOnChainDashboard(d: ReferralDashboardResponse, address: string): OnChainDashboard {
  return {
    address,
    referral_code: d.code ?? undefined,
    total_rebates: d.total_earnings,
    claimable_amount: d.pending_earnings,
    total_trades: d.active_referrals,
    is_operator: false,
  };
}
