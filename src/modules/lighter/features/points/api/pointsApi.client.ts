import type {
  PointsDailyLeaderboardPayload,
  PointsEpochsServerResponse,
  PointsLeaderboardPayload,
  PointsLeaderboardServerResponse,
  PointsUserServerResponse,
} from "./pointsApi.types";

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
}

export function buildPointsEpochsUrl(baseUrl: string): string {
  return `${normalizeBaseUrl(baseUrl)}/epochs`;
}

export function buildPointsUserUrl(baseUrl: string, epochId: number): string {
  const u = new URL(`${normalizeBaseUrl(baseUrl)}/points`);
  u.searchParams.set("epoch", String(epochId));
  return u.toString();
}

/** `GET /points/leaderboard`（文档：epoch、type_、limit；无需认证） */
export function buildPointsLeaderboardUrl(
  baseUrl: string,
  params: { epoch: number; type_?: string; limit?: number },
): string {
  const u = new URL(`${normalizeBaseUrl(baseUrl)}/points/leaderboard`);
  u.searchParams.set("epoch", String(params.epoch));
  u.searchParams.set("type_", params.type_ && params.type_.trim() !== "" ? params.type_ : "total");
  if (params.limit != null && params.limit > 0) {
    u.searchParams.set("limit", String(params.limit));
  }
  return u.toString();
}

/** 兼容扁平 JSON 与 `{ success, data }` 信封 */
export function unwrapPointsLeaderboardServerResponse(json: unknown): PointsLeaderboardServerResponse {
  if (json === null || typeof json !== "object") {
    return { success: false, data: null, error: "invalid_json" };
  }
  const root = json as Record<string, unknown>;

  if ("success" in root && typeof root.success === "boolean") {
    if (root.success === false) {
      return {
        success: false,
        data: null,
        error: typeof root.error === "string" ? root.error : "request_failed",
      };
    }
    const inner = root.data;
    if (inner && typeof inner === "object" && Array.isArray((inner as Record<string, unknown>).entries)) {
      return { success: true, data: inner as PointsLeaderboardPayload, error: null };
    }
    return { success: false, data: null, error: "missing_data" };
  }

  if (Array.isArray(root.entries) && root.epoch_number != null) {
    const entries = root.entries as PointsLeaderboardPayload["entries"];
    const payload: PointsLeaderboardPayload = {
      epoch_number: Number(root.epoch_number) || 0,
      rank_type: String(root.rank_type ?? "total"),
      total: typeof root.total === "number" ? root.total : Number(root.total) || 0,
      updated_at: String(root.updated_at ?? ""),
      entries,
    };
    return { success: true, data: payload, error: null };
  }

  return { success: false, data: null, error: "unrecognized_leaderboard_shape" };
}

/**
 * `GET /points/leaderboard/daily`（文档：epoch 可选；limit 默认 100、最大 500；offset 分页）。
 */
export function buildPointsDailyLeaderboardUrl(
  baseUrl: string,
  params: { epoch?: number; limit?: number; offset?: number },
): string {
  const u = new URL(`${normalizeBaseUrl(baseUrl)}/points/leaderboard/daily`);
  if (params.epoch != null) u.searchParams.set("epoch", String(params.epoch));
  if (params.limit != null) {
    const lim = Math.min(500, Math.max(1, Math.floor(params.limit)));
    u.searchParams.set("limit", String(lim));
  }
  if (params.offset != null && params.offset > 0) {
    u.searchParams.set("offset", String(Math.max(0, Math.floor(params.offset))));
  }
  return u.toString();
}

/** 扁平 JSON 或与 `{ success, data }` 信封兼容；`entries` 缺省视为 []（worker 预热空表） */
export function unwrapPointsDailyLeaderboardJson(json: unknown): PointsDailyLeaderboardPayload | null {
  if (json === null || typeof json !== "object") return null;
  const root = json as Record<string, unknown>;
  if ("success" in root && root.success === false) return null;

  let inner: Record<string, unknown> = root;
  if ("data" in root && root.data != null && typeof root.data === "object") {
    inner = root.data as Record<string, unknown>;
  }

  const entries = Array.isArray(inner.entries)
    ? (inner.entries as PointsDailyLeaderboardPayload["entries"])
    : [];

  const hasShape =
    typeof inner.date === "string" ||
    inner.epoch_number != null ||
    typeof inner.refreshed_at === "string" ||
    inner.total != null ||
    entries.length > 0;

  if (!hasShape) return null;

  return {
    date: String(inner.date ?? ""),
    epoch_number: Number(inner.epoch_number) || 0,
    refreshed_at: String(inner.refreshed_at ?? ""),
    total: typeof inner.total === "number" ? inner.total : Number(inner.total) || 0,
    entries,
  };
}

function authHeaders(jwtToken?: string | null): HeadersInit {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (jwtToken) headers.Authorization = `Bearer ${jwtToken}`;
  return headers;
}

export async function fetchPointsEpochs(baseUrl: string): Promise<PointsEpochsServerResponse> {
  const res = await fetch(buildPointsEpochsUrl(baseUrl), {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`epochs ${res.status} ${text}`);
  }
  return (await res.json()) as PointsEpochsServerResponse;
}

export async function fetchPointsUser(
  baseUrl: string,
  epochId: number,
  jwtToken?: string | null,
): Promise<PointsUserServerResponse> {
  const res = await fetch(buildPointsUserUrl(baseUrl, epochId), {
    method: "GET",
    headers: authHeaders(jwtToken),
    mode: "cors",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`points ${res.status} ${text}`);
  }
  return (await res.json()) as PointsUserServerResponse;
}

/**
 * 积分累计榜 `GET /points/leaderboard`（文档；无需认证）。
 * @param options.type_ 排行类型，默认 total；参数名须为 `type_`
 */
export async function fetchPointsLeaderboard(
  baseUrl: string,
  epochId: number,
  options?: { type_?: string; limit?: number },
): Promise<PointsLeaderboardServerResponse> {
  const url = buildPointsLeaderboardUrl(baseUrl, {
    epoch: epochId,
    type_: options?.type_,
    limit: options?.limit ?? 100,
  });
  const res = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    mode: "cors",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`points/leaderboard ${res.status} ${text}`);
  }
  const json: unknown = await res.json().catch(() => null);
  return unwrapPointsLeaderboardServerResponse(json);
}

/**
 * 当日 UTC 积分增量榜 `GET /points/leaderboard/daily`（文档；无需认证）。
 */
export async function fetchPointsDailyLeaderboard(
  baseUrl: string,
  params: { epoch?: number; limit?: number; offset?: number },
): Promise<PointsDailyLeaderboardPayload> {
  const res = await fetch(buildPointsDailyLeaderboardUrl(baseUrl, params), {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    mode: "cors",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`points/leaderboard/daily ${res.status} ${text}`);
  }
  const json: unknown = await res.json().catch(() => null);
  const payload = unwrapPointsDailyLeaderboardJson(json);
  return (
    payload ?? {
      date: "",
      epoch_number: 0,
      refreshed_at: "",
      total: 0,
      entries: [],
    }
  );
}
