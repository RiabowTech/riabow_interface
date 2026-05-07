import type {
  FeeVipSummaryPayloadDto,
  FeeVipSummaryResponseDto,
  FeeVipTierId,
  FeeVipUserSnapshotDto,
} from "./feeVip.types";
import { feeVipMockRandomizeFromEnv } from "./feeVipEnv";

/** Mock 场景：`import.meta.env.VITE_FEE_VIP_MOCK_SCENE` 或 `getFeeVipMockPayloadDto({ scene })` */
export type FeeVipMockScene = "default" | "guest" | "near_vip1" | "vip1" | "vip2" | "max";

const MOCK_SCENES: ReadonlySet<string> = new Set([
  "default",
  "guest",
  "near_vip1",
  "vip1",
  "vip2",
  "max",
]);

const STATIC_TIERS: FeeVipSummaryPayloadDto["tiers"] = [
  { tier: 0, volume_caption_key: "lt_5m", maker_fee_bps: 10, taker_fee_bps: 40 },
  { tier: 1, volume_caption_key: "gte_5m", maker_fee_bps: 8, taker_fee_bps: 36 },
  { tier: 2, volume_caption_key: "gte_25m", maker_fee_bps: 4, taker_fee_bps: 32 },
  { tier: 3, volume_caption_key: "gte_100m", maker_fee_bps: 0, taker_fee_bps: 28 },
  { tier: 4, volume_caption_key: "gte_500m", maker_fee_bps: 0, taker_fee_bps: 26 },
  { tier: 5, volume_caption_key: "gte_2b", maker_fee_bps: 0, taker_fee_bps: 24 },
];

/** FNV-1a 32-bit：同一地址始终得到相同「变量」 */
export function feeVipMockHashAddress(address: string): number {
  const norm = address.trim().toLowerCase();
  let h = 2166136261 >>> 0;
  for (let i = 0; i < norm.length; i++) {
    h ^= norm.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function mockSceneFromEnv(): FeeVipMockScene {
  const raw = import.meta.env.VITE_FEE_VIP_MOCK_SCENE as string | undefined;
  if (raw && MOCK_SCENES.has(raw)) return raw as FeeVipMockScene;
  return "default";
}

/**
 * `VITE_FEE_VIP_MOCK=random`（或旧 `VITE_FEE_VIP_MOCK_RANDOMIZE=true`）时每次请求随机：
 * - 当前 VIP 档位 0–5、对应 Maker/Taker、下一档与门槛、14D 成交额（落在该档合理区间）、升级折扣文案。
 * - 非 guest 场景下忽略 `VITE_FEE_VIP_MOCK_SCENE` 的固定档（避免与随机档冲突）。
 */
function mockRandomizeRefresh(): boolean {
  return feeVipMockRandomizeFromEnv();
}

/** 各 VIP 档 14D 成交额区间下限（与费率表「升到下一档」门槛一致） */
const TIER_VOLUME_FLOOR_USD: readonly number[] = [0, 5_000_000, 25_000_000, 100_000_000, 500_000_000, 2_000_000_000];

function randomVipTier(): FeeVipTierId {
  return Math.floor(Math.random() * 6) as FeeVipTierId;
}

/** 在当前档位对应成交量带内随机，便于进度条与档位一致 */
function randomRollingInTierBand(t: FeeVipTierId): number {
  const lo = t === 0 ? 2_000 : TIER_VOLUME_FLOOR_USD[t];
  if (t >= 5) {
    return TIER_VOLUME_FLOOR_USD[5] + Math.floor(Math.random() * 800_000_000);
  }
  const hi = TIER_VOLUME_FLOOR_USD[t + 1] - 1;
  return lo + Math.floor(Math.random() * Math.max(1, hi - lo + 1));
}

function buildRandomizedVipUser(account: string | undefined): FeeVipUserSnapshotDto {
  const t = randomVipTier();
  const row = STATIC_TIERS.find((x) => x.tier === t)!;
  const h = account ? feeVipMockHashAddress(account) : 0;
  const rolling = randomRollingInTierBand(t);
  const nextTier: FeeVipTierId | null = t < 5 ? ((t + 1) as FeeVipTierId) : null;
  const nextFloorStr = nextTier === null ? null : String(TIER_VOLUME_FLOOR_USD[nextTier]);

  return {
    current_tier: t,
    next_tier: nextTier,
    rolling_14d_volume_usd: String(rolling),
    next_tier_volume_floor_usd: nextFloorStr,
    maker_fee_bps: row.maker_fee_bps,
    taker_fee_bps: row.taker_fee_bps,
    next_taker_discount_percent: nextTier === null ? null : pickDiscountPercent(h),
    current_tier_description_key: t === 0 && Math.random() < 0.45 ? "default_new_user" : null,
  };
}

/** 与 `feeVipMockRolling14dUsd` 各档区间一致，纯 Math.random（仅 randomize 模式） */
function randomRollingForScene(scene: FeeVipMockScene): number {
  const u = () => Math.random();
  switch (scene) {
    case "near_vip1":
      return 4_500_000 + Math.floor(u() * 480_000);
    case "vip1":
      return 8_000_000 + Math.floor(u() * 2_000_000);
    case "vip2":
      return 40_000_000 + Math.floor(u() * 10_000_000);
    case "max":
      return 3_000_000_000 + Math.floor(u() * 500_000_000);
    case "default":
    default:
      return 2_000 + Math.floor(u() * 4_998_000);
  }
}

/**
 * 默认场景下由地址推导 14D 成交量（约 $2k–$5M），同一钱包每次刷新不变。
 * 设置 `VITE_FEE_VIP_MOCK=random` 后同场景每次请求数值随机。
 * 未连接钱包时用固定稿面值。
 */
export function feeVipMockRolling14dUsd(account: string | undefined, scene: FeeVipMockScene): number {
  if (scene === "guest") return 0;
  /** 未连接钱包：开 randomize 时也要每次变化，否则固定 3240 看起来像「没生效」 */
  if (!account) {
    return mockRandomizeRefresh() ? randomRollingForScene("default") : 3240;
  }

  if (mockRandomizeRefresh()) {
    return randomRollingForScene(scene);
  }

  const h = feeVipMockHashAddress(account);

  switch (scene) {
    case "near_vip1":
      return 4_500_000 + (h % 480_000);
    case "vip1":
      return 8_000_000 + (h % 2_000_000);
    case "vip2":
      return 40_000_000 + (h % 10_000_000);
    case "max":
      return 3_000_000_000 + (h % 500_000_000);
    case "default":
    default:
      return 2_000 + (h % 4_998_000);
  }
}

function pickDiscountPercent(h: number): number {
  if (mockRandomizeRefresh()) {
    return 8 + Math.floor(Math.random() * 5);
  }
  return 8 + (h % 5);
}

function userForScene(scene: FeeVipMockScene, account: string | undefined): FeeVipUserSnapshotDto | null {
  if (scene === "guest") return null;

  if (mockRandomizeRefresh()) {
    return buildRandomizedVipUser(account);
  }

  const rolling = feeVipMockRolling14dUsd(account, scene);
  const h = account ? feeVipMockHashAddress(account) : 0;

  if (scene === "max") {
    return {
      current_tier: 5,
      next_tier: null,
      rolling_14d_volume_usd: String(rolling),
      next_tier_volume_floor_usd: null,
      maker_fee_bps: 0,
      taker_fee_bps: 24,
      next_taker_discount_percent: null,
      current_tier_description_key: null,
    };
  }

  if (scene === "vip2") {
    return {
      current_tier: 2,
      next_tier: 3,
      rolling_14d_volume_usd: String(rolling),
      next_tier_volume_floor_usd: "100000000",
      maker_fee_bps: 4,
      taker_fee_bps: 32,
      next_taker_discount_percent: pickDiscountPercent(h),
      current_tier_description_key: null,
    };
  }

  if (scene === "vip1") {
    return {
      current_tier: 1,
      next_tier: 2,
      rolling_14d_volume_usd: String(rolling),
      next_tier_volume_floor_usd: "25000000",
      maker_fee_bps: 8,
      taker_fee_bps: 36,
      next_taker_discount_percent: pickDiscountPercent(h),
      current_tier_description_key: null,
    };
  }

  if (scene === "near_vip1") {
    return {
      current_tier: 0,
      next_tier: 1,
      rolling_14d_volume_usd: String(rolling),
      next_tier_volume_floor_usd: "5000000",
      maker_fee_bps: 10,
      taker_fee_bps: 40,
      next_taker_discount_percent: pickDiscountPercent(h),
      current_tier_description_key: "default_new_user",
    };
  }

  // default
  return {
    current_tier: 0,
    next_tier: 1,
    rolling_14d_volume_usd: String(rolling),
    next_tier_volume_floor_usd: "5000000",
    maker_fee_bps: 10,
    taker_fee_bps: 40,
    next_taker_discount_percent: mockRandomizeRefresh()
      ? pickDiscountPercent(h)
      : account
        ? pickDiscountPercent(h)
        : 10,
    current_tier_description_key: "default_new_user",
  };
}

export interface FeeVipMockOptions {
  /** 覆盖最终 payload（单测 / Story） */
  overrides?: Partial<FeeVipSummaryPayloadDto>;
  /** 当前钱包；用于默认场景下稳定「随机」14D 量等 */
  account?: string | null;
  /** 指定场景；不传则读 `VITE_FEE_VIP_MOCK_SCENE` */
  scene?: FeeVipMockScene;
}

/**
 * 构建 mock payload：`scene` + `account` 控制用户块；`overrides` 最后合并。
 */
export function getFeeVipMockPayloadDto(options?: FeeVipMockOptions): FeeVipSummaryPayloadDto {
  const scene = options?.scene ?? mockSceneFromEnv();
  const account = options?.account ?? undefined;

  const base: FeeVipSummaryPayloadDto = {
    schedule_kind: "trading_fee_vip",
    tiers: STATIC_TIERS,
    user: userForScene(scene, account),
  };

  const ov = options?.overrides;
  if (!ov) return base;

  return {
    ...base,
    ...ov,
    tiers: ov.tiers ?? base.tiers,
    user: ov.user !== undefined ? ov.user : base.user,
  };
}

export function getFeeVipMockResponseDto(options?: FeeVipMockOptions): FeeVipSummaryResponseDto {
  return {
    success: true,
    data: getFeeVipMockPayloadDto(options),
    error: null,
  };
}
