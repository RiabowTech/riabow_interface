// API Response Types for Zanbara Backend

// ============================================
// Auth Types
// ============================================
export interface NonceResponse {
  nonce: number; // API returns number, not string
  message: string;
  typed_data?: {
    types: Record<string, Array<{ name: string; type: string }>>;
    primaryType: string;
    domain: {
      name: string;
      version: string;
      chainId: number;
      verifyingContract: string;
    };
    message: {
      wallet: string;
      nonce: string;
      timestamp: string;
    };
  };
}

export interface LoginRequest {
  address: string;
  signature: string;
  timestamp: number;
}

export interface LoginResponse {
  token: string;
  expires_at: number;
}

// ============================================
// Market Types
// ============================================
export interface Market {
  symbol: string;
  base_asset: string;
  quote_asset: string;
  last_price: string;
  price_change_24h: string;
  price_change_percent_24h: string;
  high_24h: string;
  low_24h: string;
  volume_24h: string;
  volume_24h_usd: string;
  rank: number;
  type?: string; // Dynamic market type from API (e.g., "layer1", "meme", "defi", "ai", "rwa", "layer2")
  leverage: number;
  price_decimals: number;
  size_decimals: number;
  status: "active" | "inactive" | "suspended";
}

export interface Orderbook {
  symbol: string;
  bids: [string, string][]; // [price, size]
  asks: [string, string][]; // [price, size]
  timestamp: number;
}

export interface Trade {
  id: string;
  symbol?: string; // Market symbol (e.g., "ETHUSDT")
  market_symbol?: string;
  price: string;
  amount: string;
  size?: string;
  side: "buy" | "sell";
  timestamp: number | string; // Can be Unix timestamp or ISO 8601 string
  created_at?: string;
  executed_at?: string;
  fee?: string; // Transaction fee
  realized_pnl?: string; // Realized PnL
  pnl?: string;
  order_id?: string; // Related order ID
  role?: string;
  liquidity?: string;
  is_maker?: boolean;
  type?: string;
  trade_type?: string;
  execution_type?: string;
  position_side?: "long" | "short" | "LONG" | "SHORT";
  reduce_only?: boolean;
}

export interface Ticker {
  symbol: string;
  last_price: string;
  price_change_24h: string;
  price_change_percent_24h: string;
  high_24h: string;
  low_24h: string;
  volume_24h: string;
  open_interest: string;
  funding_rate: string;
  next_funding_time: number;
}

export interface PriceResponse {
  symbol: string;
  mark_price: string;
  index_price: string;
  last_price: string;
  bid_price: string;
  ask_price: string;
  funding_rate: string;
  next_funding_rate: string;
  next_funding_time: number;
  updated_at: number;
}

// ============================================
// Account Types
// ============================================
export interface AccountProfile {
  address: string;
  created_at: number;
  total_trades: number;
  total_volume: string;
}

export interface AccountBalance {
  token: string;
  symbol: string;
  available: string;
  frozen: string; // API uses "frozen" not "locked"
  total: string; // API returns "total" not "balance"
}

// ============================================
// Order Types
// ============================================
export type OrderSide = "buy" | "sell"; // API uses "buy"/"sell" for orders (matching actual backend implementation)
export type OrderType = "market" | "limit" | "stop_market" | "stop_limit" | "take_profit" | "take_profit_limit";
export type OrderStatus = "pending" | "open" | "partially_filled" | "filled" | "cancelled" | "rejected" | "expired";
export type TimeInForce = "GTC" | "IOC" | "FOK" | "GTX";
export type WorkingType = "MARK_PRICE" | "CONTRACT_PRICE";
export type PositionModeSide = "BOTH" | "LONG" | "SHORT";

export interface CreateOrderRequest {
  symbol: string;
  side: OrderSide;
  order_type: OrderType;
  price?: string; // Required for limit orders
  amount: string; // Order size (was "size" in old API)
  leverage: number; // 1-50, required
  margin_mode?: "cross" | "isolated";
  signature: string; // EIP-712 signature, required
  timestamp: number; // Unix timestamp, required
  // --- 可选扩展(后端 2026-04 新增) ---
  /** 只减仓 */
  reduce_only?: boolean;
  /** 止盈触发价(成交后后台自动创建条件平仓单) */
  tp_price?: string;
  /** 止损触发价(成交后后台自动创建条件平仓单) */
  sl_price?: string;
  /** 最大滑点宽容度(市价单,例 "0.01" = 1%) */
  max_slippage?: string;
  /** 条件单触发价 */
  trigger_price?: string;
  /** 有效方式 */
  time_in_force?: TimeInForce;
  /** 触发类型 */
  working_type?: WorkingType;
  /** 持仓方向 */
  position_side?: PositionModeSide;
  /** 触发后是否全平 */
  close_position?: boolean;
  /** 自定义客户端订单 ID */
  client_order_id?: string;
}

/** 订单预估请求(不需要签名) */
export interface OrderPreviewRequest {
  symbol: string;
  side: OrderSide;
  order_type: Extract<OrderType, "market" | "limit">;
  amount: string;
  leverage: number;
  margin_mode?: "cross" | "isolated";
  reduce_only?: boolean;
  price?: string; // 限价单必填
}

/** 订单预估返回数据 */
export interface OrderPreviewData {
  order_size: string;
  order_size_symbol: string;
  order_value: string;
  est_price: string;
  est_liq_price: string;
  position_margin_before: string;
  position_margin_after: string;
  est_slippage: string;
  max_slippage: string;
  taker_fee_rate: string;
  maker_fee_rate: string;
  est_fee: string;
  is_reduce_only: boolean;
  available_balance: string;
  required_margin: string;
  has_sufficient_balance: boolean;
}

export interface OrderPreviewResponse {
  success: boolean;
  data: OrderPreviewData | null;
  error: string | null;
  timestamp: number;
}

export interface Order {
  id: string;
  client_order_id?: string;
  symbol: string;
  side: OrderSide;
  order_type: OrderType;
  trigger_type?: TriggerType;
  size: string; // Keep "size" for response (API returns "size")
  price?: string;
  trigger_price?: string;
  filled_size: string;
  filled_amount?: string; // API may return "filled_amount" instead
  average_price?: string;
  mark_price?: string; // Mark price for the order
  status: OrderStatus;
  reduce_only: boolean;
  time_in_force: TimeInForce;
  /** Take-profit price set at order creation (null if not set) */
  tp_price?: string | null;
  /** Stop-loss price set at order creation (null if not set) */
  sl_price?: string | null;
  created_at: number;
  updated_at: number;
}

export interface BatchCancelRequest {
  order_ids: string[];
  signature: string; // EIP-712 signature, required
  timestamp: number; // Unix timestamp, required
}

export interface BatchCancelResponse {
  cancelled: string[];
  failed: Array<{ id: string; error: string }>;
}

export interface UpdateOrderRequest {
  price?: string;
  size?: string;
  amount?: string;
}

export interface UpdateOrderResponse {
  order_id: string;
  status: string;
  price?: string | null;
  size?: string | null;
  amount?: string | null;
  updated_at?: string | number;
}

// ============================================
// Position Types
// ============================================
export type PositionSide = "long" | "short";

export interface Position {
  position_id: string; // API returns "position_id" not "id"
  id?: string; // Keep for backward compatibility
  symbol: string;
  side: PositionSide;
  size: string; // USDT value
  amount: string; // Token quantity (e.g., BTC amount)
  entry_price: string;
  mark_price: string;
  liquidation_price?: string;
  unrealized_pnl: string;
  unrealized_pnl_percent?: string; // API may return this
  realized_pnl?: string;
  collateral_amount: string; // API returns "collateral_amount" not "margin"
  margin?: string; // Keep for backward compatibility
  leverage: number;
  margin_ratio: string;
  /** Take-profit trigger price — null/undefined = not set */
  take_profit_price?: string | null;
  /** Stop-loss trigger price — null/undefined = not set */
  stop_loss_price?: string | null;
  status?: string; // "open" | "closed"
  created_at: number;
  updated_at: number;
}

export interface OpenPositionRequest {
  symbol: string;
  side: PositionSide;
  size: string;
  leverage: number;
  order_type: OrderType;
  price?: string;
  take_profit?: string;
  stop_loss?: string;
}

export interface ClosePositionRequest {
  size?: string; // Position size to close (e.g., "0.5" for 0.5 BTC)
  price?: string | null; // Can be null for market orders
}

export interface CollateralRequest {
  amount: string;
}

export interface LiquidationCheck {
  position_id: string;
  is_at_risk: boolean;
  liquidation_price: string;
  mark_price: string;
  margin_ratio: string;
  health_factor: string;
}

// ============================================
// Funding Rate Types
// ============================================
export interface FundingRate {
  symbol: string;
  funding_rate: string;
  funding_rate_per_hour?: string;
  mark_price: string;
  index_price: string;
  next_funding_time: string | number; // Can be ISO string or timestamp
  long_open_interest?: string;
  short_open_interest?: string;
}

export interface FundingHistory {
  symbol: string;
  rate: string;
  timestamp: number;
}

export interface FundingSettlement {
  id: string;
  position_id: string;
  symbol: string;
  side: PositionSide;
  size: string;
  funding_rate: string;
  payment: string;
  timestamp: number;
}

export interface FundingFeeHistoryItem {
  symbol: string;
  fundingRate: string;
  positionSize: string;
  fundingFee: string;
  positionSide: "LONG" | "SHORT";
  asset: string;
  time: number;
  tranId: string;
}

// ============================================
// Liquidation Types
// ============================================
export interface LiquidationEvent {
  id: string;
  position_id: string;
  symbol: string;
  side: PositionSide;
  size: string;
  price: string;
  bankruptcy_price: string;
  insurance_fund_contribution?: string;
  timestamp: number;
}

export interface LiquidationConfig {
  symbol: string;
  maintenance_margin_rate: string;
  liquidation_fee_rate: string;
  insurance_fund_rate: string;
}

export interface InsuranceFund {
  symbol: string;
  balance: string;
  updated_at: number;
}

// ============================================
// ADL Types
// ============================================
export interface AdlRanking {
  rank: number;
  position_id: string;
  user_address: string;
  side: PositionSide;
  size: string;
  pnl_ratio: string;
  leverage: number;
  adl_score: string;
}

export interface AdlEvent {
  id: string;
  position_id: string;
  counter_position_id: string;
  symbol: string;
  side: PositionSide;
  size: string;
  price: string;
  timestamp: number;
}

export interface AdlConfig {
  symbol: string;
  enabled: boolean;
  threshold: string;
}

export interface AdlStats {
  position_id: string;
  adl_score: string;
  rank: number;
  total_ranked: number;
  risk_level: "low" | "medium" | "high";
}

// ============================================
// Trigger Order Types
// ============================================
// API returns PascalCase values like "StopLoss", "TakeProfit"
// Backend enum: StopLoss, TakeProfit, TrailingStop, StopLimit, TakeProfitLimit
export type TriggerType = "StopLoss" | "TakeProfit" | "StopLimit" | "TakeProfitLimit" | "TrailingStop";
// API returns "Active", "Triggered", "Executed", "Cancelled", "Expired", "Failed"
export type TriggerStatus = "Active" | "Triggered" | "Executed" | "Cancelled" | "Expired" | "Failed";

export interface CreateTriggerOrderRequest {
  market_symbol: string;
  side: OrderSide;
  trigger_type: TriggerType;
  trigger_price: string;
  size: string;
  limit_price?: string;
  position_id?: string;
  reduce_only?: boolean;
  close_position?: boolean;
}

export interface TriggerOrderResponse {
  id: string;
  market_symbol: string;
  trigger_type: TriggerType;
  side: string;
  size: string;
  trigger_price: string;
  limit_price?: string | null;
  status: TriggerStatus;
  created_at: string;
}

export interface TriggerOrder {
  id: string;
  user_address?: string;
  position_id?: string;
  market_symbol?: string; // API returns "market_symbol" instead of "symbol"
  symbol?: string; // Keep for compatibility
  trigger_type: TriggerType;
  side: string; // API returns "Buy" or "Sell" (capitalized)
  size: string;
  trigger_price: string;
  trigger_condition?: string;
  limit_price?: string | null;
  trailing_delta?: string | null;
  trailing_delta_type?: string | null;
  peak_price?: string | null;
  status: TriggerStatus;
  triggered_at?: string | null;
  triggered_price?: string | null;
  executed_order_id?: string | null;
  executed_price?: string | null;
  executed_at?: string | null;
  reduce_only: boolean;
  close_position?: boolean;
  expires_at?: string | null;
  client_order_id?: string | null;
  error_message?: string | null;
  created_at: string; // API returns ISO string
  updated_at?: string;
}

export interface TriggerOrdersResponse {
  success: boolean;
  data: TriggerOrder[];
  error: string | null;
}

export interface TriggerOrderExecution {
  id: string;
  trigger_order_id: string;
  order_id: string;
  symbol: string;
  execution_price: string;
  size: string;
  timestamp: number;
}

export interface TpSlRequest {
  take_profit_price?: string | number | null;
  take_profit_size?: string | number | null; // null or "0" means full position close
  take_profit_limit_price?: string | number | null;
  stop_loss_price?: string | number | null;
  stop_loss_size?: string | number | null; // null or "0" means full position close
  stop_loss_limit_price?: string | number | null;
  trailing_stop_delta?: string | number | null;
  trailing_stop_delta_type?: "absolute" | "percentage";
  trailing_stop_size?: string | number | null;
}

export interface TpSlResponse {
  id?: string;
  position_id: string;
  user_address?: string;
  market_symbol?: string;
  take_profit_price?: string | null;
  take_profit_size?: string | null;
  take_profit_limit_price?: string | null;
  take_profit_trigger_order_id?: string | null;
  stop_loss_price?: string | null;
  stop_loss_size?: string | null;
  stop_loss_limit_price?: string | null;
  stop_loss_trigger_order_id?: string | null;
  trailing_stop_delta?: string | null;
  trailing_stop_delta_type?: "absolute" | "percentage" | null;
  trailing_stop_size?: string | null;
  trailing_stop_trigger_order_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface TriggerOrderConfig {
  symbol: string;
  max_trigger_orders: number;
  min_trigger_distance: string;
  max_trigger_distance: string;
}

// ============================================
// Referral Types
// ============================================
export interface ReferralCode {
  code: string;
  owner: string;
  discount_rate: string;
  rebate_rate: string;
  total_referrals: number;
  total_volume: string;
  created_at: number;
}

export interface CreateReferralCodeRequest {
  code: string;
}

export interface BindReferralCodeRequest {
  code: string;
}

export interface ReferralDashboard {
  my_code?: ReferralCode;
  bound_code?: string;
  total_earnings: string;
  pending_earnings: string;
  total_referrals: number;
  total_volume: string;
}

export interface OnChainDashboard {
  address: string;
  referral_code?: string;
  total_rebates: string;
  claimable_amount: string;
  total_trades: number;
  is_operator: boolean;
}

export interface ClaimableAmount {
  address: string;
  amount: string;
  token: string;
}

export interface OperatorStatus {
  is_operator: boolean;
  backend_address: string;
}

// Zanbara API Referral Types (根据 API 文档)
// ============================================
export interface CreateReferralCodeResponse {
  success: boolean;
  code: string;
  created_at: string;
}

export interface CreateReferralCodeParams {
  signature: string;
  timestamp: number;
}

export interface BindReferralCodeParams {
  code: string;
  signature: string;
  timestamp: number;
}

export interface BindReferralCodeResponse {
  success: boolean;
  referrer_address: string;
  referrer_code: string;
}

export interface ReferralTier {
  level: number;
  name: string;
  /** 返佣比例小数，如 "0.12" = 12% */
  commission_rate: string;
  /** 基点，1 bps = 0.01% */
  rate_bps: number;
  /** 下一档所需邀请人数；已达最高档（如 Diamond）时为 null */
  next_tier_referrals?: number | null;
  /** 下一档所需被推荐人累计成交量（USD）；已达最高档时为 null */
  next_tier_volume?: string | null;
  /** @deprecated 旧字段，与 next_tier_referrals 语义相同；新接口请用 next_tier_referrals */
  next_tier_requirement?: number;
}

export interface ReferralActivity {
  referral_address: string;
  event_type: string;
  volume: string;
  commission: string;
  timestamp: number | string; // API returns number (milliseconds), but can be string for backward compatibility
}

/** `GET /referral/leaderboard` — 按累计返佣排序的前 N 名推荐人（无需认证） */
export interface ReferralLeaderboardEntry {
  rank: number;
  referrer_address: string;
  /** 累计返佣总额（USDT），十进制字符串 */
  total_commission: string;
  /** 榜数据最后计算时间（毫秒） */
  computed_at: number;
}

export interface BoundReferral {
  code: string;
  referrer_address: string;
  /** 绑定时间（毫秒时间戳）；兼容字符串 */
  bound_at: number | string;
}

export interface ReferralDashboardResponse {
  code: string | null;
  total_referrals: number;
  active_referrals: number;
  /** 被推荐人累计交易量（USD） */
  total_referred_volume?: string;
  total_earnings: string;
  pending_earnings: string;
  claimed_earnings: string;
  /** 未达 Starter 门槛时为 null */
  tier: ReferralTier | null;
  /** 仅当 tier 为 null 时后端可能返回说明文案 */
  tier_note?: string | null;
  recent_activity: ReferralActivity[];
  bound_referral?: BoundReferral | null;
}

/** GET /referral/status */
export interface ReferralRefereeRow {
  address: string;
  bound_at: number;
}

export interface ReferralAsReferrer {
  has_code: boolean;
  code: string | null;
  code_created_at: number | null;
  total_referrals: number;
  referees: ReferralRefereeRow[];
}

export interface ReferralAsReferee {
  is_bound: boolean;
  referrer_address: string | null;
  referrer_code: string | null;
  bound_at: number | null;
}

export interface ReferralStatusResponse {
  as_referrer: ReferralAsReferrer;
  as_referee: ReferralAsReferee;
}

export interface ReferralClaimSignatureRequest {
  amount: string;
}

export interface ReferralClaimSignatureResponse {
  amount: string; // Amount in wei (6 decimals)
  nonce: number;
  deadline: number; // Unix timestamp
  signature: string; // EIP-712 signature
  contract_address: string; // ReferralRebate contract address
}

export interface ClaimReferralResponse {
  success: boolean;
  amount: string;
  tx_hash: string | null;
}

export interface OnChainDashboardResponse {
  code: string;
  total_referees: number;
  total_volume_usd: string;
  total_earnings_usd: string;
  claimed_earnings_usd: string;
  claimable_earnings_usd: string;
  current_tier: number;
  current_rate_bps: number;
  tier_name: string;
}

export interface ClaimableResponse {
  address: string;
  claimable_usd: string;
}

export interface OperatorStatusResponse {
  operator_address: string;
  is_operator: boolean;
  contract_address: string;
}

// ============================================
// Deposit & Withdrawal Types
// ============================================
export interface PrepareDepositRequest {
  token: string;
  amount: string;
}

export interface PrepareDepositResponse {
  deposit_address: string;
  token: string;
  amount: string;
  expires_at: number;
}

export interface DepositRecord {
  id: string;
  token: string;
  amount: string;
  tx_hash: string;
  status: "pending" | "confirmed" | "failed";
  created_at: number;
  confirmed_at?: number;
}

export interface WithdrawRequest {
  token: string;
  amount: string;
}

export interface WithdrawResponse {
  withdraw_id?: string; // API returns "withdraw_id"
  id?: string; // Keep for backward compatibility
  token: string;
  amount: string;
  backend_signature: string; // API returns "backend_signature"
  signature?: string; // Keep for backward compatibility
  nonce: number;
  expiry: number; // API returns "expiry"
  deadline?: number; // Keep for backward compatibility
  vault_address?: string; // API returns "vault_address"
  status?: "pending" | "signed" | "completed" | "failed";
}

export interface WithdrawRecord {
  id: string;
  token: string;
  amount: string;
  tx_hash?: string | null;
  status: "pending" | "signed" | "submitted" | "confirmed" | "completed" | "failed";
  created_at: number;
  completed_at?: number;
  nonce?: number;
  expiry?: number;
  backend_signature?: string;
}

// ============================================
// Common Types
// ============================================
export interface ApiError {
  error: string;
  message: string;
  code?: string;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
  has_more: boolean;
}

// Type guard for API errors
export function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === "object" && error !== null && "error" in error && typeof (error as ApiError).error === "string"
  );
}

// ============================================
// Earn Types (理财服务)
// ============================================

export type EarnProductStatus = "created" | "subscribing" | "active" | "settling" | "settled" | "cancelled" | "ended";
export type EarnNftStatus = "active" | "matured" | "redeemed";

export interface EarnProduct {
  id: string; // UUID
  chain_product_id: number; // 链上产品 ID
  name: string;
  description?: string;
  annual_rate: string; // e.g., "190.36%"
  period_rate: string; // e.g., "3.65%"
  duration_seconds: number; // Duration in seconds (backend no longer returns duration_days)
  total_quota: string; // e.g., "200000.00"
  subscribed_amount: string;
  available_quota: string;
  subscription_rate: string; // e.g., "0.25%"
  min_amount: string;
  max_amount_per_user: string;
  status: EarnProductStatus;
  is_subscribing: boolean;
  subscribe_start_time: string; // ISO 8601 string, e.g., "2026-01-07T04:00:00Z"
  subscribe_end_time: string;
  settle_time: string;
  time_remaining_seconds: number;
  subscriber_count: number;
}

export interface EarnProductsResponse {
  products: EarnProduct[];
  total: number;
  page: number;
  page_size: number;
}

export interface EarnSubscription {
  id: string;
  product_id: string;
  chain_product_id: number;
  product_name: string;
  amount: string;
  nft_amount: string; // wei, 6 decimals
  expected_return: string; // 预期收益
  actual_return: string | null; // 实际收益
  total_return: string; // 总回款 (本金+收益)
  nft_status: EarnNftStatus;
  annual_rate: string;
  period_rate: string;
  subscribed_at: string; // ISO 8601 string
  settle_time: string; // ISO 8601 string
  settled_at: string | null;
  claimed: boolean;
  claimed_at: string | null;
  subscribe_tx_hash: string;
  claim_tx_hash: string | null;
}

export interface EarnSubscriptionsResponse {
  subscriptions: EarnSubscription[];
}

export interface EarnPerformance {
  product_id: string;
  name: string;
  annual_rate: string;
  period_rate: string;
  duration_seconds: number; // Duration in seconds (backend no longer returns duration_days)
  total_subscribed: string;
  total_interest_paid: string;
  subscriber_count: number;
  settled_at: number;
}

export interface EarnPerformanceResponse {
  performances: EarnPerformance[];
}

export interface EarnDomainResponse {
  types: Record<string, Array<{ name: string; type: string }>>;
  primaryType: string;
  domain: {
    name: string;
    version: string;
    chainId: number;
    verifyingContract: string;
  };
}

export interface EarnSubscribePrepareRequest {
  product_id: string;
  amount: string; // e.g., "500.00"
}

export interface EarnSubscribePrepareResponse {
  chain_product_id: number;
  amount: string; // wei, 6 decimals
  deadline: number; // Unix timestamp
  signature: string; // EIP-712 signature from backend
  contract_address: string;
  user_address: string;
}

// ============================================
// PnL Types (每日和累计盈亏)
// ============================================

export interface DailyPnl {
  date: string; // YYYY-MM-DD
  realized_pnl: string; // USD
  volume: string; // USD
  trade_count: number;
  fees: string; // USD
}

export interface CumulativePnl {
  total_realized_pnl: string; // USD
  total_unrealized_pnl: string; // USD
  total_pnl: string; // realized + unrealized
  total_volume: string; // USD
  total_trades: number;
  total_fees: string; // USD
  win_rate: string; // percentage, e.g., "65.5" means 65.5%
  avg_profit_per_trade: string; // USD
}

export interface PnlResponse {
  daily: DailyPnl[];
  cumulative: CumulativePnl;
  symbol: string | null;
}

export interface GetPnlParams {
  symbol?: string;
  start_date?: string; // YYYY-MM-DD
  end_date?: string; // YYYY-MM-DD
  days?: number; // default 30
}
