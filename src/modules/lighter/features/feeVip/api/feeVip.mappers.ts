import type {
  FeeVipScheduleKind,
  FeeVipSummary,
  FeeVipSummaryPayloadDto,
  FeeVipTierId,
  FeeVipTierRow,
  FeeVipTierRowDto,
  FeeVipUserSnapshot,
  FeeVipUserSnapshotDto,
  FeeVipVolumeCaptionKey,
} from "./feeVip.types";

const VOLUME_KEYS = new Set<string>([
  "lt_5m",
  "gte_5m",
  "gte_25m",
  "gte_100m",
  "gte_500m",
  "gte_2b",
  "points_t1",
  "points_t2",
  "points_t3",
]);

function assertVolumeKey(key: string): FeeVipVolumeCaptionKey {
  if (VOLUME_KEYS.has(key)) return key as FeeVipVolumeCaptionKey;
  return "lt_5m";
}

function assertTierId(n: number): FeeVipTierId {
  const t = Math.min(5, Math.max(0, Math.floor(n))) as FeeVipTierId;
  return t;
}

export function mapTierRowDto(dto: FeeVipTierRowDto): FeeVipTierRow {
  const rawLabel = dto.tier_display_label;
  return {
    tier: assertTierId(dto.tier),
    tierDisplayLabel: rawLabel != null && String(rawLabel).trim() !== "" ? String(rawLabel).trim() : null,
    volumeCaptionKey: assertVolumeKey(dto.volume_caption_key),
    makerFeeBps: dto.maker_fee_bps,
    takerFeeBps: dto.taker_fee_bps,
    makerTpPer1kUsd: dto.maker_tp_per_1k_usd,
    takerTpPer1kUsd: dto.taker_tp_per_1k_usd,
  };
}

export function mapUserSnapshotDto(dto: FeeVipUserSnapshotDto): FeeVipUserSnapshot {
  const floorRaw = dto.next_tier_volume_floor_usd;
  return {
    currentTier: assertTierId(dto.current_tier),
    currentTierLabel:
      dto.current_tier_label != null && String(dto.current_tier_label).trim() !== ""
        ? String(dto.current_tier_label).trim()
        : null,
    nextTier: dto.next_tier === null || dto.next_tier === undefined ? null : assertTierId(dto.next_tier),
    nextTierLabel:
      dto.next_tier_label != null && String(dto.next_tier_label).trim() !== ""
        ? String(dto.next_tier_label).trim()
        : null,
    rolling14dVolumeUsd: Number(dto.rolling_14d_volume_usd) || 0,
    nextTierVolumeFloorUsd: floorRaw === null || floorRaw === undefined ? null : Number(floorRaw) || null,
    makerFeeBps: dto.maker_fee_bps,
    takerFeeBps: dto.taker_fee_bps,
    effectiveMakerFeeBps: dto.effective_maker_fee_bps,
    effectiveTakerFeeBps: dto.effective_taker_fee_bps,
    pointsTierLabel: dto.points_tier_label ?? null,
    makerTpPer1kUsd: dto.maker_tp_per_1k_usd,
    takerTpPer1kUsd: dto.taker_tp_per_1k_usd,
    nextTakerDiscountPercent: dto.next_taker_discount_percent,
    currentTierDescriptionKey:
      dto.current_tier_description_key === "default_new_user" ? "default_new_user" : null,
  };
}

function scheduleKindFromDto(dto: FeeVipSummaryPayloadDto): FeeVipScheduleKind {
  return dto.schedule_kind === "points_trading_tier" ? "points_trading_tier" : "trading_fee_vip";
}

export function mapFeeVipSummaryPayload(dto: FeeVipSummaryPayloadDto): FeeVipSummary {
  return {
    scheduleKind: scheduleKindFromDto(dto),
    tiers: dto.tiers.map(mapTierRowDto),
    user: dto.user ? mapUserSnapshotDto(dto.user) : null,
  };
}

/** bps 如 10 → 展示字符串 "0.010%" */
export function formatFeeBpsLabel(bps: number): string {
  const pct = bps / 100;
  return `${pct.toFixed(3)}%`;
}
