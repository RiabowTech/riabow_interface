/**
 * 积分系统 REST 响应形状（与 `docs/api/23. 积分系统…` 及后端实现对齐）。
 * 字段名保持 snake_case，映射在 `usePointsData` / 页面层完成。
 */

export interface PointsEpochServerItem {
  id: number;
  label: string;
  startDate: string;
  endDate: string;
  status: string;
  /** 可选：多赛季时用于分组；缺省视为单赛季 */
  season_id?: number;
  season_label?: string;
}

export interface PointsEpochsServerResponse {
  success: boolean;
  data: PointsEpochServerItem[] | null;
  error: string | null;
  timestamp?: number;
}

export interface PointsUserServerData {
  user_address: string;
  epoch_number: number;
  epoch_status: string;
  trading_points: string;
  pnl_points: string;
  holding_points: string;
  referral_points: string;
  staking_points: string;
  total_points: string;
  tier: string;
  tier_multiplier: string;
  rank: number | null;
  trading_volume: string;
  trade_count: number;
  referral_count: number;
  updated_at: string;
  referral_code?: string | null;
}

export interface PointsUserServerResponse {
  success: boolean;
  data: PointsUserServerData | null;
  error: string | null;
  timestamp: number;
}

export interface PointsLeaderboardServerItem {
  rank: number;
  user_address: string;
  username: string | null;
  points: string;
  tier: string;
}

export interface PointsLeaderboardPayload {
  epoch_number: number;
  rank_type: string;
  total: number;
  updated_at: string;
  entries: PointsLeaderboardServerItem[];
}

export interface PointsLeaderboardServerResponse {
  success: boolean;
  data: PointsLeaderboardPayload | null;
  error: string | null;
}

/** `GET /points/leaderboard/daily` 单条（UTC 当日积分增量） */
export interface PointsDailyLeaderboardServerItem {
  rank: number;
  user_address: string;
  points_today: string;
  tier: string | null;
}

/** `GET /points/leaderboard/daily` 载荷（可与 `{ success, data }` 信封一起返回） */
export interface PointsDailyLeaderboardPayload {
  date: string;
  epoch_number: number;
  refreshed_at: string;
  total: number;
  entries: PointsDailyLeaderboardServerItem[];
}
