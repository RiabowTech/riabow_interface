import { getTradingBackendUrl } from "config/backend";

import { getEmptyFeeVipSummary } from "./feeVip.empty";
import { mapFeeVipSummaryPayload } from "./feeVip.mappers";
import { getFeeVipMockResponseDto } from "./feeVip.mock";
import { fetchPointsTierSummary } from "./feeVip.pointsTier";
import { fetchPrimitFeeInfoSummary } from "./feeVip.primitFeeInfo";
import type { FeeVipSummary, FeeVipSummaryResponseDto } from "./feeVip.types";
import { feeVipDataSourceFromEnv, feeVipUseMockFromEnv } from "./feeVipEnv";

/** 是否使用 Fee VIP mock，见 `feeVipEnv.ts` 中 `VITE_FEE_VIP_MOCK` */
export function feeVipUseMock(): boolean {
  return feeVipUseMockFromEnv();
}

function feeVipSummaryPath(): string {
  return import.meta.env.VITE_FEE_VIP_SUMMARY_PATH || "/api/v1/account/fee-vip-summary";
}

function parseSummaryResponse(json: unknown): FeeVipSummary {
  const body = json as FeeVipSummaryResponseDto;
  if (!body?.success || !body.data) {
    const err = body?.error || "Invalid fee VIP response";
    throw new Error(err);
  }
  return mapFeeVipSummaryPayload(body.data);
}

/**
 * 拉取 Fee & VIP 摘要（档位表 + 当前用户快照）。
 * Mock：`feeVip.mock`。真实请求默认 `GET …/account/fee-info`（`feeVipEnv`），可选 `points_tier` / `legacy_fee_summary`。
 */
export async function fetchFeeVipSummary(
  chainId: number,
  account: string | undefined,
  jwt?: string | undefined,
): Promise<FeeVipSummary> {
  if (feeVipUseMock()) {
    await new Promise((r) => setTimeout(r, 180));
    const dto = getFeeVipMockResponseDto({ account });
    if (!dto.data) throw new Error(dto.error || "Empty mock");
    return mapFeeVipSummaryPayload(dto.data);
  }

  const jwtTrim = jwt?.trim();
  const source = feeVipDataSourceFromEnv();

  /** 未 Sign / 无 JWT：只走远程接口；个人区不展示（`user: null`）。失败或空档为「空表」，不使用本地参考表。 */
  if (!jwtTrim) {
    if (source === "primit_fee_info") {
      const s = await fetchPrimitFeeInfoSummary(chainId, undefined);
      return { ...s, user: null };
    }
    if (source === "points_tier") {
      const s = await fetchPointsTierSummary(chainId, undefined);
      return { ...s, user: null };
    }
    return getEmptyFeeVipSummary();
  }

  if (source === "points_tier") {
    return fetchPointsTierSummary(chainId, jwtTrim);
  }

  if (source === "primit_fee_info") {
    return fetchPrimitFeeInfoSummary(chainId, jwtTrim);
  }

  const base = getTradingBackendUrl(chainId);
  const url = `${base}${feeVipSummaryPath()}`;
  const res = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    mode: "cors",
  });
  if (!res.ok) {
    throw new Error(`Fee VIP API ${res.status}`);
  }
  const json = await res.json();
  return parseSummaryResponse(json);
}
