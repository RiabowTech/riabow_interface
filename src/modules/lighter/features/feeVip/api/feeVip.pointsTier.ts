import { getPointsApiUrl } from "config/backend";

import { getEmptyFeeVipSummary } from "./feeVip.empty";
import type { FeeVipSummary, FeeVipTierRow, FeeVipUserSnapshot } from "./feeVip.types";

/** 文档「数据字典」T1–T3：14D 滚动成交量 + TP / 千 USD（与 `GET /points/tier` 一致） */
const POINTS_TIER_ROWS: FeeVipTierRow[] = [
  {
    tier: 1,
    volumeCaptionKey: "points_t1",
    makerFeeBps: 0,
    takerFeeBps: 0,
    makerTpPer1kUsd: 1.2,
    takerTpPer1kUsd: 0.8,
  },
  {
    tier: 2,
    volumeCaptionKey: "points_t2",
    makerFeeBps: 0,
    takerFeeBps: 0,
    makerTpPer1kUsd: 1.5,
    takerTpPer1kUsd: 1.0,
  },
  {
    tier: 3,
    volumeCaptionKey: "points_t3",
    makerFeeBps: 0,
    takerFeeBps: 0,
    makerTpPer1kUsd: 2.0,
    takerTpPer1kUsd: 1.3,
  },
];

function pickStr(obj: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string") return v;
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
  }
  return undefined;
}

function num(s: string | undefined): number | null {
  if (s === undefined || s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function parsePointsTierLabel(value: unknown): 1 | 2 | 3 | null {
  if (typeof value !== "string") return null;
  const u = value.trim().toUpperCase();
  if (u === "T1") return 1;
  if (u === "T2") return 2;
  if (u === "T3") return 3;
  return null;
}

function rowByTierId(t: 1 | 2 | 3): FeeVipTierRow {
  return POINTS_TIER_ROWS.find((r) => r.tier === t)!;
}

function takerTpDiscountPercent(currentTaker: number, nextTaker: number): number | null {
  if (!(currentTaker > 0) || !(nextTaker >= 0)) return null;
  const pct = (1 - nextTaker / currentTaker) * 100;
  if (!Number.isFinite(pct) || pct <= 0) return null;
  return Math.round(pct * 10) / 10;
}

/**
 * 解析 `GET /points/tier` 或包一层 `{ data, code: 200 }` / `{ success, data }`。
 */
export function unwrapPointsTierPayload(json: unknown): Record<string, unknown> | null {
  if (!json || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;
  const data = o.data;
  if (data && typeof data === "object") {
    if (o.success === false) return null;
    if (o.code === 200 || o.code === "200" || o.success === true) {
      return data as Record<string, unknown>;
    }
    if (o.code === undefined && o.success === undefined) {
      return data as Record<string, unknown>;
    }
  }
  if ("tier" in o || "current_volume" in o || "currentVolume" in o) {
    return o as Record<string, unknown>;
  }
  return null;
}

export function mapPointsTierDataToUser(data: Record<string, unknown>): FeeVipUserSnapshot | null {
  const tierStr = pickStr(data, "tier", "Tier");
  const t = parsePointsTierLabel(tierStr);
  if (!t) return null;

  const row = rowByTierId(t);
  const rolling = num(pickStr(data, "current_volume", "currentVolume")) ?? 0;

  const nextRaw = (data.next_tier ?? data.nextTier) as unknown;
  const nextObj = nextRaw && typeof nextRaw === "object" ? (nextRaw as Record<string, unknown>) : null;
  const nextLabel = nextObj ? parsePointsTierLabel(pickStr(nextObj, "tier", "Tier")) : null;
  const nextTier = nextLabel;
  const floorStr = nextObj ? pickStr(nextObj, "required_volume", "requiredVolume") : undefined;
  const nextFloor = floorStr != null ? num(floorStr) : null;

  let nextTakerDiscountPercent: number | null = null;
  if (nextTier != null) {
    const nextRow = rowByTierId(nextTier);
    const curT = row.takerTpPer1kUsd ?? 0;
    const nextT = nextRow.takerTpPer1kUsd ?? 0;
    nextTakerDiscountPercent = takerTpDiscountPercent(curT, nextT);
  }

  return {
    currentTier: t,
    nextTier,
    rolling14dVolumeUsd: rolling,
    nextTierVolumeFloorUsd: nextFloor,
    makerFeeBps: 0,
    takerFeeBps: 0,
    pointsTierLabel: typeof tierStr === "string" ? tierStr.trim().toUpperCase() : `T${t}`,
    makerTpPer1kUsd: row.makerTpPer1kUsd,
    takerTpPer1kUsd: row.takerTpPer1kUsd,
    nextTakerDiscountPercent,
    currentTierDescriptionKey: null,
  };
}

export function buildPointsTierSummaryFromApiData(data: Record<string, unknown> | null): FeeVipSummary {
  const user = data ? mapPointsTierDataToUser(data) : null;
  return {
    scheduleKind: "points_trading_tier",
    tiers: POINTS_TIER_ROWS,
    user,
  };
}

export function getPointsTierReferenceSummary(): FeeVipSummary {
  return buildPointsTierSummaryFromApiData(null);
}

function feeVipPointsEpochFromEnv(): number | undefined {
  const raw = import.meta.env.VITE_FEE_VIP_POINTS_EPOCH as string | undefined;
  if (raw === undefined || raw === "") return undefined;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * 调用积分系统 `GET /api/v1/points/tier`（文档 §6），Bearer 必填（由上层 `fetchFeeVipSummary` 保证）；401/403 时返回空摘要。
 */
export async function fetchPointsTierSummary(
  chainId: number,
  jwt: string | undefined,
): Promise<FeeVipSummary> {
  const base = getPointsApiUrl(chainId).replace(/\/$/, "");
  const url = new URL(`${base}/points/tier`);
  const epoch = feeVipPointsEpochFromEnv();
  if (epoch !== undefined) {
    url.searchParams.set("epoch", String(epoch));
  }

  const headers: Record<string, string> = { Accept: "application/json" };
  if (jwt) {
    headers.Authorization = `Bearer ${jwt}`;
  }

  const res = await fetch(url.toString(), {
    method: "GET",
    headers,
    mode: "cors",
  });

  if (res.status === 401 || res.status === 403) {
    return getEmptyFeeVipSummary();
  }

  if (!res.ok) {
    throw new Error(`points/tier ${res.status}`);
  }

  const json: unknown = await res.json();
  const data = unwrapPointsTierPayload(json);
  return buildPointsTierSummaryFromApiData(data);
}
