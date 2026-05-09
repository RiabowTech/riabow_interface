import { getTradingBackendUrl } from "config/backend";

import { getEmptyFeeVipSummary } from "./feeVip.empty";
import type { FeeVipSummary, FeeVipTierId, FeeVipTierRow, FeeVipUserSnapshot, FeeVipVolumeCaptionKey } from "./feeVip.types";

/**
 * Zanbara U 本位合约 `GET /api/v1/account/fee-info` 响应（与公开文档字段一致）。
 * @see https://developers.primit.io/zh-Hans/futures/usdt-margined/account/vip-tiers
 */
export interface ZanbaraFeeInfoFeeTierDto {
  level: number;
  label: string;
  maker: string;
  taker: string;
  volume_min: string;
  volume_max?: string;
}

export interface ZanbaraFeeInfoProgressDto {
  next_level: number;
  next_label: string;
  required_volume: string;
  remaining_volume: string;
  percent: string;
}

export interface ZanbaraFeeInfoDiscountsDto {
  referral: string;
  token_staking: string;
  multiplier: string;
}

export interface ZanbaraFeeInfoResponseDto {
  current_tier: number;
  current_label?: string;
  current_maker: string;
  current_taker: string;
  effective_maker: string;
  effective_taker: string;
  volume_14d: string;
  volume_30d?: string;
  fee_tiers: ZanbaraFeeInfoFeeTierDto[];
  progress_to_next?: ZanbaraFeeInfoProgressDto | null;
  pending_tier?: number | null;
  pending_effective_at?: string | null;
  discounts?: ZanbaraFeeInfoDiscountsDto;
}

const VOLUME_KEY_BY_LEVEL: readonly FeeVipVolumeCaptionKey[] = [
  "lt_5m",
  "gte_5m",
  "gte_25m",
  "gte_100m",
  "gte_500m",
  "gte_2b",
];

function assertTierId(n: number): FeeVipTierId {
  return Math.min(5, Math.max(0, Math.floor(n))) as FeeVipTierId;
}

/** 文档中费率为小数形式（如 0.00010 = 0.010%），与 `formatFeeBpsLabel`（bps/100 = 展示 %）对齐：bps = fraction × 10000 */
export function zanbaraFeeFractionToDisplayBps(fraction: number): number {
  if (!Number.isFinite(fraction)) return 0;
  return fraction * 10000;
}

function parseFraction(s: string | undefined): number {
  if (s === undefined || s === "") return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function volumeCaptionForLevel(level: number): FeeVipVolumeCaptionKey {
  const L = Math.min(5, Math.max(0, Math.floor(level)));
  return VOLUME_KEY_BY_LEVEL[L] ?? "lt_5m";
}

function nextTakerDiscountPercentFromTiers(
  feeTiers: ZanbaraFeeInfoFeeTierDto[],
  currentLevel: FeeVipTierId,
  nextLevel: FeeVipTierId | null,
): number | null {
  if (nextLevel === null) return null;
  const cur = feeTiers.find((t) => t.level === currentLevel);
  const nxt = feeTiers.find((t) => t.level === nextLevel);
  if (!cur || !nxt) return null;
  const curT = parseFraction(cur.taker);
  const nextT = parseFraction(nxt.taker);
  if (!(curT > 0) || !(nextT >= 0)) return null;
  const pct = (1 - nextT / curT) * 100;
  if (!Number.isFinite(pct) || pct <= 0) return null;
  return Math.round(pct * 10) / 10;
}

export function mapZanbaraFeeInfoResponseToSummary(dto: ZanbaraFeeInfoResponseDto): FeeVipSummary {
  const currentTier = assertTierId(dto.current_tier);
  const sortedTiers = [...dto.fee_tiers].sort((a, b) => a.level - b.level);

  const tiers: FeeVipTierRow[] = sortedTiers.map((row) => ({
    tier: assertTierId(row.level),
    tierDisplayLabel: row.label != null && String(row.label).trim() !== "" ? String(row.label).trim() : null,
    volumeCaptionKey: volumeCaptionForLevel(row.level),
    makerFeeBps: zanbaraFeeFractionToDisplayBps(parseFraction(row.maker)),
    takerFeeBps: zanbaraFeeFractionToDisplayBps(parseFraction(row.taker)),
  }));

  const prog = dto.progress_to_next ?? null;

  let nextTier: FeeVipTierId | null = null;
  let nextTierVolumeFloorUsd: number | null = null;
  if (currentTier < 5) {
    const fallbackNext = assertTierId(currentTier + 1);
    const fallbackRow = sortedTiers.find((t) => t.level === fallbackNext);
    const fallbackFloorUsd =
      fallbackRow?.volume_min !== undefined && fallbackRow?.volume_min !== ""
        ? Number(fallbackRow.volume_min) || null
        : null;

    if (prog != null && typeof prog.next_level === "number") {
      const apiNext = assertTierId(prog.next_level);
      /**
       * 部分环境 `progress_to_next.next_level` 会与 `current_tier` 不同步（例如仍返回 1），
       * 导致 UI 出现「VIP 3 → VIP 1」。仅当 API 给出的下一档严格高于当前档时才采信。
       */
      if (apiNext > currentTier) {
        nextTier = apiNext;
        const rv = prog.required_volume;
        nextTierVolumeFloorUsd = rv !== undefined && rv !== "" ? Number(rv) || null : null;
        if (nextTierVolumeFloorUsd == null) {
          const apiRow = sortedTiers.find((t) => t.level === nextTier);
          const vm = apiRow?.volume_min;
          nextTierVolumeFloorUsd = vm !== undefined && vm !== "" ? Number(vm) || null : null;
        }
      } else {
        nextTier = fallbackNext;
        nextTierVolumeFloorUsd = fallbackFloorUsd;
      }
    } else {
      nextTier = fallbackNext;
      nextTierVolumeFloorUsd = fallbackFloorUsd;
    }
  }

  const rolling14dVolumeUsd = Number(dto.volume_14d) || 0;

  const nextLabelFromProg = prog?.next_label != null && String(prog.next_label).trim() !== "" ? String(prog.next_label).trim() : null;
  const nextRowForResolved = nextTier != null ? sortedTiers.find((t) => t.level === nextTier) : null;
  const nextLabelFromTable =
    nextRowForResolved?.label != null && String(nextRowForResolved.label).trim() !== ""
      ? String(nextRowForResolved.label).trim()
      : null;
  /** 优先用档位表 label（与 `nextTier` 一致）；避免沿用与错误 `next_level` 绑定的 `next_label` */
  const resolvedNextTierLabel = nextLabelFromTable ?? nextLabelFromProg;
  const currentLbl = dto.current_label != null && String(dto.current_label).trim() !== "" ? String(dto.current_label).trim() : null;

  const baseMakerBps = zanbaraFeeFractionToDisplayBps(parseFraction(dto.current_maker));
  const baseTakerBps = zanbaraFeeFractionToDisplayBps(parseFraction(dto.current_taker));
  const effMakerBps = zanbaraFeeFractionToDisplayBps(parseFraction(dto.effective_maker));
  const effTakerBps = zanbaraFeeFractionToDisplayBps(parseFraction(dto.effective_taker));

  const user: FeeVipUserSnapshot = {
    currentTier,
    currentTierLabel: currentLbl,
    nextTier,
    nextTierLabel: resolvedNextTierLabel,
    rolling14dVolumeUsd,
    nextTierVolumeFloorUsd,
    makerFeeBps: baseMakerBps,
    takerFeeBps: baseTakerBps,
    effectiveMakerFeeBps: effMakerBps,
    effectiveTakerFeeBps: effTakerBps,
    pointsTierLabel: undefined,
    nextTakerDiscountPercent: nextTakerDiscountPercentFromTiers(sortedTiers, currentTier, nextTier),
    currentTierDescriptionKey: null,
  };

  return {
    scheduleKind: "trading_fee_vip",
    tiers,
    user,
  };
}

function unwrapFeeInfoPayload(json: unknown): ZanbaraFeeInfoResponseDto | null {
  if (!json || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;
  if ("current_tier" in o && Array.isArray(o.fee_tiers)) {
    return o as unknown as ZanbaraFeeInfoResponseDto;
  }
  const data = o.data;
  if (data && typeof data === "object" && "current_tier" in data && Array.isArray((data as Record<string, unknown>).fee_tiers)) {
    return data as unknown as ZanbaraFeeInfoResponseDto;
  }
  return null;
}

/**
 * 拉取 Zanbara 官方 `GET /api/v1/account/fee-info`，映射为 Fee VIP 页模型。
 * 可不携带 Bearer（用于未 Sign 仅展示 `fee_tiers`；由 `fetchFeeVipSummary` 再置 `user: null`）。
 * 401/403、或 HTTP 200 且 `success: false`（无 JWT 时）返回空摘要。
 */
export async function fetchZanbaraFeeInfoSummary(chainId: number, jwt: string | undefined): Promise<FeeVipSummary> {
  const base = getTradingBackendUrl(chainId).replace(/\/$/, "");
  const url = `${base}/api/v1/account/fee-info`;

  const headers: Record<string, string> = { Accept: "application/json" };
  if (jwt) {
    headers.Authorization = `Bearer ${jwt}`;
  }

  /** 勿用 `credentials: "include"`：跨域时若服务端 `Access-Control-Allow-Origin: *`，浏览器会拒绝（与 include 不兼容）。本接口仅 Bearer，无需带 cookie。 */
  const res = await fetch(url, {
    method: "GET",
    headers,
    mode: "cors",
  });

  if (res.status === 401 || res.status === 403) {
    return getEmptyFeeVipSummary();
  }

  if (!res.ok) {
    throw new Error(`fee-info ${res.status}`);
  }

  const json: unknown = await res.json();
  /** 部分环境用 HTTP 200 + `success: false` + `data: null` 表示未鉴权（与 401 等价） */
  if (json && typeof json === "object") {
    const env = json as Record<string, unknown>;
    if (env.success === false) {
      if (!jwt?.trim()) {
        return getEmptyFeeVipSummary();
      }
      const err = env.error as Record<string, unknown> | undefined;
      const msg = typeof err?.message === "string" ? err.message : "fee-info request failed";
      throw new Error(msg);
    }
  }

  const payload = unwrapFeeInfoPayload(json);
  if (!payload) {
    return getEmptyFeeVipSummary();
  }

  return mapZanbaraFeeInfoResponseToSummary(payload);
}
