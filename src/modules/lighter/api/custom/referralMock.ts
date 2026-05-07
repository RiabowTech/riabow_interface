import type {
  OnChainDashboardResponse,
  ReferralDashboardResponse,
  ReferralLeaderboardEntry,
  ReferralStatusResponse,
} from "../types";

export type ReferralMockMode = "off" | "stable";
export type ReferralMockScene = "empty" | "starter" | "gold";

function norm(s: string | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

export function getReferralMockMode(): ReferralMockMode {
  const raw = norm(import.meta.env.VITE_REFERRAL_MOCK as string | undefined);
  if (raw === "off" || raw === "false" || raw === "0") return "off";
  if (raw === "on" || raw === "true" || raw === "1" || raw === "stable") return "stable";
  return "off";
}

export function referralUseMockFromEnv(): boolean {
  return getReferralMockMode() !== "off";
}

function getReferralMockScene(): ReferralMockScene {
  const raw = norm(import.meta.env.VITE_REFERRAL_MOCK_SCENE as string | undefined);
  if (raw === "empty" || raw === "starter" || raw === "gold") return raw;
  return "starter";
}

function mockTierForScene(scene: ReferralMockScene): NonNullable<ReferralDashboardResponse["tier"]> {
  if (scene === "gold") {
    return {
      level: 3,
      name: "Gold",
      commission_rate: "0.22",
      rate_bps: 2200,
      next_tier_referrals: 100,
      next_tier_volume: "2000000.00",
      next_tier_requirement: 100,
    };
  }
  return {
    level: 0,
    name: "Starter",
    commission_rate: "0.10",
    rate_bps: 1000,
    next_tier_referrals: 5,
    next_tier_volume: "10000.00",
    next_tier_requirement: 5,
  };
}

export function getReferralDashboardMock(): ReferralDashboardResponse {
  const scene = getReferralMockScene();
  if (scene === "empty") {
    return {
      code: null,
      total_referrals: 0,
      active_referrals: 0,
      total_referred_volume: "0.00",
      total_earnings: "0",
      pending_earnings: "0",
      claimed_earnings: "0",
      tier: null,
      tier_note: "未达到最低返佣门槛，需满足：≥1 位被推荐人 且 被推荐人累计交易量 ≥ $1,000",
      recent_activity: [],
      bound_referral: null,
    };
  }

  const now = Date.now();
  return {
    code: scene === "gold" ? "PRIMITGOLD" : "PRIMIT001",
    total_referrals: scene === "gold" ? 58 : 3,
    active_referrals: scene === "gold" ? 29 : 1,
    total_referred_volume: scene === "gold" ? "865000.00" : "2200.00",
    total_earnings: scene === "gold" ? "4521.67" : "68.20",
    pending_earnings: scene === "gold" ? "23.48" : "0",
    claimed_earnings: scene === "gold" ? "4498.19" : "68.20",
    tier: mockTierForScene(scene),
    recent_activity: [
      {
        referral_address: "0x7d9F4fE6E2d6A8f6eCaD11112222333344445555",
        event_type: "trade",
        volume: scene === "gold" ? "150000.00" : "1300.00",
        commission: scene === "gold" ? "18.50" : "1.25",
        timestamp: now - 2 * 60 * 60 * 1000,
      },
      {
        referral_address: "0x2A3b4c5d6E7f8A9B0cD111122223333444455566",
        event_type: "trade",
        volume: scene === "gold" ? "82000.00" : "900.00",
        commission: scene === "gold" ? "4.98" : "0.62",
        timestamp: now - 8 * 60 * 60 * 1000,
      },
    ],
    bound_referral: null,
  };
}

/** 与 `GET /referral/leaderboard` 字段一致，供本地 mock */
export function getReferralLeaderboardMock(n: number): ReferralLeaderboardEntry[] {
  const now = Date.now();
  const rows: ReferralLeaderboardEntry[] = [
    {
      rank: 1,
      referrer_address: "0x7d9F4fE6E2d6A8f6eCaD11112222333344445555",
      total_commission: "1234.567890",
      computed_at: now,
    },
    {
      rank: 2,
      referrer_address: "0x2A3b4c5d6E7f8A9B0cD111122223333444455566",
      total_commission: "987.654321",
      computed_at: now,
    },
    {
      rank: 3,
      referrer_address: "0x9fF1a2B3c4D5e6F7a8B9c0D1e2F3a4B5c6D7e8F9",
      total_commission: "512.000000",
      computed_at: now,
    },
    {
      rank: 4,
      referrer_address: "0x1111222233334444555566667777888899990000",
      total_commission: "301.25",
      computed_at: now,
    },
    {
      rank: 5,
      referrer_address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      total_commission: "120.5",
      computed_at: now,
    },
    {
      rank: 6,
      referrer_address: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      total_commission: "98.12",
      computed_at: now,
    },
    {
      rank: 7,
      referrer_address: "0xcccccccccccccccccccccccccccccccccccccccc",
      total_commission: "76.00",
      computed_at: now,
    },
    {
      rank: 8,
      referrer_address: "0xdddddddddddddddddddddddddddddddddddddddd",
      total_commission: "55.4321",
      computed_at: now,
    },
    {
      rank: 9,
      referrer_address: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
      total_commission: "40.00",
      computed_at: now,
    },
    {
      rank: 10,
      referrer_address: "0xffffffffffffffffffffffffffffffffffffffff",
      total_commission: "12.345678",
      computed_at: now,
    },
  ];
  return rows.slice(0, Math.max(0, Math.min(n, rows.length)));
}

export function getReferralStatusMock(_address?: string): ReferralStatusResponse {
  const scene = getReferralMockScene();
  const now = Date.now();
  const hasCode = scene !== "empty";
  return {
    as_referrer: {
      has_code: hasCode,
      code: hasCode ? (scene === "gold" ? "PRIMITGOLD" : "PRIMIT001") : null,
      code_created_at: hasCode ? now - 60 * 24 * 60 * 60 * 1000 : null,
      total_referrals: scene === "gold" ? 58 : scene === "starter" ? 3 : 0,
      referees:
        scene === "empty"
          ? []
          : [
              { address: "0x7d9F4fE6E2d6A8f6eCaD11112222333344445555", bound_at: now - 32 * 24 * 60 * 60 * 1000 },
              { address: "0x2A3b4c5d6E7f8A9B0cD111122223333444455566", bound_at: now - 12 * 24 * 60 * 60 * 1000 },
            ],
    },
    as_referee: {
      is_bound: false,
      referrer_address: null,
      referrer_code: null,
      bound_at: null,
    },
  };
}

export function getOnChainReferralDashboardMock(_address: string): OnChainDashboardResponse {
  const scene = getReferralMockScene();
  if (scene === "gold") {
    return {
      code: "PRIMITGOLD",
      total_referees: 58,
      total_volume_usd: "865000",
      total_earnings_usd: "4521.67",
      claimed_earnings_usd: "4498.19",
      claimable_earnings_usd: "23.48",
      current_tier: 3,
      current_rate_bps: 2200,
      tier_name: "Gold",
    };
  }
  if (scene === "empty") {
    return {
      code: "",
      total_referees: 0,
      total_volume_usd: "0",
      total_earnings_usd: "0",
      claimed_earnings_usd: "0",
      claimable_earnings_usd: "0",
      current_tier: 0,
      current_rate_bps: 1000,
      tier_name: "Starter",
    };
  }
  return {
    code: "PRIMIT001",
    total_referees: 3,
    total_volume_usd: "8300",
    total_earnings_usd: "68.20",
    claimed_earnings_usd: "68.20",
    claimable_earnings_usd: "0",
    current_tier: 0,
    current_rate_bps: 1000,
    tier_name: "Starter",
  };
}

