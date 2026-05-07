/**
 * Fee / VIP 摘要 — 与后端约定字段（camelCase 为前端归一化后形态）。
 *
 * - 默认（未设置或 `primit_fee_info`）：Primit `GET /api/v1/account/fee-info`（U 本位 VIP / 手续费），见 Primit 开发者文档。
 * - 积分档（`VITE_FEE_VIP_DATA_SOURCE=points_tier`）：`GET /api/v1/points/tier` + 静态 T1–T3。
 * - 旧版：`GET /api/v1/account/fee-vip-summary`（`legacy_fee_summary`）。
 */

/** 档位 0–5，与费率表一致 */
export type FeeVipTierId = 0 | 1 | 2 | 3 | 4 | 5;

/**
 * 表格「14D Volume」列展示键 — 由后端下发，前端映射文案（避免把格式化串散落在多处）。
 */
export type FeeVipVolumeCaptionKey =
  | "lt_5m"
  | "gte_5m"
  | "gte_25m"
  | "gte_100m"
  | "gte_500m"
  | "gte_2b"
  /** 积分文档「交易 Tier」14D 区间（T1–T3） */
  | "points_t1"
  | "points_t2"
  | "points_t3";

/** 页内两套说明：旧「VIP 费率档」或积分系统「交易 Tier（TP）」 */
export type FeeVipScheduleKind = "trading_fee_vip" | "points_trading_tier";

export interface FeeVipTierRow {
  tier: FeeVipTierId;
  /**
   * 后端档位展示名（如 Primit `fee-info.fee_tiers[].label` 的 `VIP 3`）。
   * 有值时表格优先显示，不再使用前端硬编码的 Bronze/Silver 文案。
   */
  tierDisplayLabel?: string | null;
  volumeCaptionKey: FeeVipVolumeCaptionKey;
  /** 费率：万分比，如 10 => 0.010% */
  makerFeeBps: number;
  takerFeeBps: number;
  /**
   * 积分系统 Tier：Maker/Taker 每 $1,000 名义成交额对应的 TP（文档 §6 / 数据字典）。
   * 有值时表格「费率」列展示 TP，而非 `makerFeeBps`。
   */
  makerTpPer1kUsd?: number;
  takerTpPer1kUsd?: number;
}

/** 当前用户 VIP / 费率快照（未登录时 user 可为 null，仅 tiers 有数据） */
export interface FeeVipUserSnapshot {
  currentTier: FeeVipTierId;
  /** Primit `fee-info.current_label` 等，优于纯 `VIP n` */
  currentTierLabel?: string | null;
  nextTier: FeeVipTierId | null;
  /** Primit `progress_to_next.next_label` */
  nextTierLabel?: string | null;
  /** 近 14 日折合成交量（USD） */
  rolling14dVolumeUsd: number;
  /** 升至 nextTier 所需的 14D 成交量下限；已满级则为 null */
  nextTierVolumeFloorUsd: number | null;
  /** VIP 档位基础费率（Primit `current_maker` / `current_taker`），与表格当前档一致 */
  makerFeeBps: number;
  takerFeeBps: number;
  /** 折后实际费率（Primit `effective_maker` / `effective_taker`）；与档位基础不同时即存在折扣 */
  effectiveMakerFeeBps?: number;
  effectiveTakerFeeBps?: number;
  /** 积分 Tier：如 `T2`，用于标题展示 */
  pointsTierLabel?: string | null;
  makerTpPer1kUsd?: number;
  takerTpPer1kUsd?: number;
  /** 升至下一档后 Taker 费率相对当前的降幅（百分比），如 10；已满级为 null */
  nextTakerDiscountPercent: number | null;
  /** 当前档副文案 i18n 键，无则页面不展示副标题行 */
  currentTierDescriptionKey: FeeVipTierDescriptionKey | null;
}

export type FeeVipTierDescriptionKey = "default_new_user";

export interface FeeVipSummary {
  scheduleKind: FeeVipScheduleKind;
  tiers: FeeVipTierRow[];
  user: FeeVipUserSnapshot | null;
}

/** 原始 JSON（snake_case）— 便于与 Rust / Node 字段对齐 */
export interface FeeVipTierRowDto {
  tier: number;
  tier_display_label?: string | null;
  volume_caption_key: string;
  maker_fee_bps: number;
  taker_fee_bps: number;
  maker_tp_per_1k_usd?: number;
  taker_tp_per_1k_usd?: number;
}

export interface FeeVipUserSnapshotDto {
  current_tier: number;
  current_tier_label?: string | null;
  next_tier: number | null;
  next_tier_label?: string | null;
  rolling_14d_volume_usd: string;
  next_tier_volume_floor_usd: string | null;
  maker_fee_bps: number;
  taker_fee_bps: number;
  effective_maker_fee_bps?: number;
  effective_taker_fee_bps?: number;
  points_tier_label?: string | null;
  maker_tp_per_1k_usd?: number;
  taker_tp_per_1k_usd?: number;
  next_taker_discount_percent: number | null;
  current_tier_description_key: string | null;
}

export interface FeeVipSummaryPayloadDto {
  schedule_kind?: string;
  tiers: FeeVipTierRowDto[];
  user: FeeVipUserSnapshotDto | null;
}

export interface FeeVipSummaryResponseDto {
  success: boolean;
  data: FeeVipSummaryPayloadDto | null;
  error: string | null;
}
