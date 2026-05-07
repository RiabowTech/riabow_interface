# PRIMIT Backend API Documentation

**Base URL:** `http://localhost:8080`
**API Version:** v1
**API Prefix:** `/api/v1`
**Status:** ✅ **完全开发完成** (57 个端点)

## 开发完成状态

| 指标 | 数值 |
|------|------|
| 总 API 端点 | **57** |
| 撮合引擎性能 | **999K+ ops/sec** |
| API P99 延迟 | **< 130ms** |
| 压力测试 | **全部通过** |

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [Markets](#2-markets)
3. [Orders](#3-orders)
4. [Positions](#4-positions)
5. [Account](#5-account)
6. [Funding Rates](#6-funding-rates)
7. [Liquidation](#7-liquidation)
8. [ADL (Auto-Deleveraging)](#8-adl-auto-deleveraging)
9. [Trigger Orders](#9-trigger-orders)
10. [Deposit & Withdrawal](#10-deposit--withdrawal)
11. [Referral](#11-referral)
12. [WebSocket API](#12-websocket-api)

---

## Common Response Formats

### Error Response
```json
{
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

### Authentication Header
```
Authorization: Bearer <JWT_TOKEN>
```

---

## 1. Authentication

### 1.1 Get Nonce
Get nonce for wallet signature authentication.

**Endpoint:** `GET /api/v1/auth/nonce/:address`

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| address | path | Ethereum address (0x...) |

**Response:**
```json
{
  "nonce": 1,
  "message": "Sign this message to login to PRIMIT.\n\nAddress: 0x...\nNonce: 1"
}
```

---

### 1.2 Login
Login with wallet signature.

**Endpoint:** `POST /api/v1/auth/login`

**Request Body:**
```json
{
  "address": "0x6538469807e019E05c9ec4Bd158b12afB1DA50F3",
  "signature": "0x...",
  "timestamp": 1733650000
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "expires_at": 1733736400
}
```

**Signature Message Format:**
```
Sign this message to login to PRIMIT.

Address: {address}
Nonce: {nonce}
```

---

## 2. Markets

### 2.1 List Markets
Get all available trading pairs (top 50 by volume from OKX).

**Endpoint:** `GET /api/v1/markets`

**Query Parameters:**
| Name | Type | Default | Description |
|------|------|---------|-------------|
| limit | number | 50 | Max markets to return (max 50) |

**Response:**
```json
{
  "markets": [
    {
      "symbol": "BTC-USD",
      "base_asset": "BTC",
      "quote_asset": "USD",
      "last_price": "99500.50",
      "price_change_24h": "1500.25",
      "price_change_percent_24h": "1.53",
      "high_24h": "100200.00",
      "low_24h": "97800.00",
      "volume_24h": "12500.5",
      "volume_24h_usd": "1243750000",
      "rank": 1
    }
  ],
  "total": 50
}
```

---

### 2.2 Get Orderbook
Get orderbook for a trading pair.

**Endpoint:** `GET /api/v1/markets/:symbol/orderbook`

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| symbol | path | Trading pair (e.g., BTC-USD) |

**Response:**
```json
{
  "symbol": "BTC-USD",
  "bids": [["99500.00", "1.5"], ["99499.00", "2.3"]],
  "asks": [["99501.00", "1.2"], ["99502.00", "3.1"]],
  "timestamp": 1733650000000
}
```

---

### 2.3 Get Recent Trades
Get recent trades for a trading pair.

**Endpoint:** `GET /api/v1/markets/:symbol/trades`

**Response:**
```json
{
  "symbol": "BTC-USD",
  "trades": [
    {
      "id": "uuid",
      "price": "99500.50",
      "amount": "0.5",
      "side": "buy",
      "timestamp": 1733650000000
    }
  ]
}
```

---

### 2.4 Get Ticker
Get ticker information for a trading pair.

**Endpoint:** `GET /api/v1/markets/:symbol/ticker`

**Response:**
```json
{
  "symbol": "BTC-USD",
  "last_price": "99500.50",
  "price_change_24h": "1500.25",
  "price_change_percent_24h": "1.53",
  "high_24h": "100200.00",
  "low_24h": "97800.00",
  "volume_24h": "12500.5",
  "open_interest": "5000.0",
  "funding_rate": "0.0001",
  "next_funding_time": 1733654400
}
```

---

### 2.5 Get Price
Get real-time price data (from OKX).

**Endpoint:** `GET /api/v1/markets/:symbol/price`

**Response:**
```json
{
  "symbol": "BTC-USD",
  "mark_price": "99500.50",
  "index_price": "99498.25",
  "last_price": "99500.50",
  "bid_price": "99500.00",
  "ask_price": "99501.00",
  "funding_rate": "0.0001",
  "next_funding_rate": "0.00012",
  "next_funding_time": 1733654400000,
  "updated_at": 1733650000000
}
```

---

## 3. Orders

### 3.1 Create Order
Create a new order. **Requires Authentication**

**Endpoint:** `POST /api/v1/orders`

**Request Body:**
```json
{
  "symbol": "BTC-USD",
  "side": "buy",
  "order_type": "limit",
  "price": "99000.00",
  "amount": "0.1",
  "leverage": 10,
  "signature": "0x...",
  "timestamp": 1733650000
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| symbol | string | Yes | Trading pair (BTC-USD, ETH-USD) |
| side | string | Yes | "buy" or "sell" |
| order_type | string | Yes | "market" or "limit" |
| price | decimal | For limit | Limit price |
| amount | decimal | Yes | Order size |
| leverage | number | Yes | 1-50 |
| signature | string | Yes | EIP-712 signature |
| timestamp | number | Yes | Unix timestamp |

**Signature Message Format:**
```
Create Order on PRIMIT

Symbol: {symbol}
Side: {side}
Type: {order_type}
Price: {price|market}
Amount: {amount}
Leverage: {leverage}
Timestamp: {timestamp}
Address: {address}
```

**Response:**
```json
{
  "order_id": "uuid",
  "status": "open",
  "filled_amount": "0",
  "remaining_amount": "0.1",
  "average_price": null,
  "created_at": "2024-12-08T12:00:00Z"
}
```

---

### 3.2 Cancel Order
Cancel a single order. **Requires Authentication**

**Endpoint:** `DELETE /api/v1/orders/:order_id`

**Request Body:**
```json
{
  "signature": "0x...",
  "timestamp": 1733650000
}
```

**Response:**
```json
{
  "order_id": "uuid",
  "status": "cancelled",
  "created_at": "2024-12-08T12:00:00Z"
}
```

---

### 3.3 Batch Cancel Orders
Cancel multiple orders at once. **Requires Authentication**

**Endpoint:** `POST /api/v1/orders/batch`

**Request Body:**
```json
{
  "order_ids": ["uuid1", "uuid2"],
  "signature": "0x...",
  "timestamp": 1733650000
}
```

**Response:**
```json
{
  "cancelled": ["uuid1"],
  "failed": ["uuid2"]
}
```

---

## 4. Positions

### 4.1 Get All Positions
Get all open positions. **Requires Authentication**

**Endpoint:** `GET /api/v1/positions`

**Response:**
```json
{
  "positions": [
    {
      "position_id": "uuid",
      "symbol": "BTC-USD",
      "side": "long",
      "size": "0.5",
      "entry_price": "99000.00",
      "mark_price": "99500.00",
      "liquidation_price": "95000.00",
      "unrealized_pnl": "250.00",
      "unrealized_pnl_percent": "5.05",
      "collateral_amount": "4950.00",
      "leverage": 10,
      "margin_ratio": "0.10",
      "status": "open"
    }
  ],
  "total_unrealized_pnl": "250.00",
  "total_collateral": "4950.00"
}
```

---

### 4.2 Get Position
Get specific position details. **Requires Authentication**

**Endpoint:** `GET /api/v1/positions/:position_id`

---

### 4.3 Open Position
Open a new position or increase existing. **Requires Authentication**

**Endpoint:** `POST /api/v1/positions`

**Request Body:**
```json
{
  "symbol": "BTC-USD",
  "side": "long",
  "collateral_amount": "1000.00",
  "leverage": 10
}
```

---

### 4.4 Close Position
Close a position (fully or partially). **Requires Authentication**

**Endpoint:** `POST /api/v1/positions/:position_id/close`

**Request Body:**
```json
{
  "amount": "0.5",
  "price": null
}
```

---

### 4.5 Add Collateral
Add collateral to a position. **Requires Authentication**

**Endpoint:** `POST /api/v1/positions/:position_id/collateral/add`

**Request Body:**
```json
{
  "amount": "500.00"
}
```

---

### 4.6 Remove Collateral
Remove collateral from a position. **Requires Authentication**

**Endpoint:** `POST /api/v1/positions/:position_id/collateral/remove`

**Request Body:**
```json
{
  "amount": "200.00"
}
```

---

### 4.7 Check Liquidation
Check liquidation status for a position. **Requires Authentication**

**Endpoint:** `GET /api/v1/positions/:position_id/liquidation`

---

## 5. Account

### 5.1 Get Profile
**Requires Authentication**

**Endpoint:** `GET /api/v1/account/profile`

---

### 5.2 Get Balances
**Requires Authentication**

**Endpoint:** `GET /api/v1/account/balances`

---

### 5.3 Get Positions
**Requires Authentication**

**Endpoint:** `GET /api/v1/account/positions`

---

### 5.4 Get Orders
**Requires Authentication**

**Endpoint:** `GET /api/v1/account/orders`

---

### 5.5 Get Trades
**Requires Authentication**

**Endpoint:** `GET /api/v1/account/trades`

---

## 6. Funding Rates

### 6.1 Get All Funding Rates
**Public Endpoint**

**Endpoint:** `GET /api/v1/funding-rates`

**Response:**
```json
{
  "rates": [
    {
      "symbol": "BTC-USD",
      "funding_rate": "0.0001",
      "funding_rate_per_hour": "0.0001",
      "mark_price": "99500.50",
      "index_price": "99498.25",
      "next_funding_time": "2024-12-09T08:00:00Z",
      "long_open_interest": "1000.0",
      "short_open_interest": "950.0"
    }
  ]
}
```

---

### 6.2 Get Funding Rate
Get funding rate for a specific market.

**Endpoint:** `GET /api/v1/funding-rates/:symbol`

---

### 6.3 Get Funding History
**Endpoint:** `GET /api/v1/funding-rates/:symbol/history`

---

### 6.4 Get User Settlements
**Requires Authentication**

**Endpoint:** `GET /api/v1/funding/settlements`

---

## 7. Liquidation

### 7.1 Get Market Liquidations
**Public Endpoint**

**Endpoint:** `GET /api/v1/liquidations/:symbol`

---

### 7.2 Get Liquidation Config
**Public Endpoint**

**Endpoint:** `GET /api/v1/liquidations/:symbol/config`

**Response:**
```json
{
  "config": {
    "symbol": "BTC-USD",
    "liquidation_fee_rate": "0.00500000",
    "max_leverage": 50,
    "maintenance_margin_rate": "0.00500000",
    "min_collateral_usd": "10.000000000000000000",
    "insurance_fund_fee_rate": "0.00100000",
    "max_insurance_payout_rate": "0.50000000",
    "liquidator_reward_rate": "0.00100000"
  }
}
```

---

### 7.3 Get Insurance Fund
**Public Endpoint**

**Endpoint:** `GET /api/v1/insurance-fund/:symbol`

**Response:**
```json
{
  "fund": {
    "id": "uuid",
    "symbol": "BTC-USD",
    "balance": "100000.00",
    "total_contributions": "150000.00",
    "total_payouts": "50000.00",
    "updated_at": "2024-12-08T12:00:00Z",
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

---

### 7.4 Get User Liquidation History
**Requires Authentication**

**Endpoint:** `GET /api/v1/liquidations/history`

---

## 8. ADL (Auto-Deleveraging)

### 8.1 Get ADL Rankings
**Public Endpoint**

**Endpoint:** `GET /api/v1/adl/:symbol/rankings`

**Query Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| side | string | Yes | "long" or "short" |

---

### 8.2 Get ADL Events
**Public Endpoint**

**Endpoint:** `GET /api/v1/adl/:symbol/events`

---

### 8.3 Get ADL Config
**Public Endpoint**

**Endpoint:** `GET /api/v1/adl/:symbol/config`

**Response:**
```json
{
  "config": {
    "id": "uuid",
    "market_symbol": "BTC-USD",
    "insurance_fund_threshold": "0",
    "max_positions_per_adl": 100,
    "min_reduction_percentage": "0.1000",
    "max_reduction_percentage": "1.0000",
    "pnl_weight": "0.5000",
    "leverage_weight": "0.3000",
    "size_weight": "0.2000",
    "min_interval_seconds": 60,
    "enabled": true,
    "created_at": "2024-12-08T12:00:00Z",
    "updated_at": "2024-12-08T12:00:00Z"
  }
}
```

---

### 8.4 Get User ADL History
**Requires Authentication**

**Endpoint:** `GET /api/v1/adl/history`

---

### 8.5 Get User ADL Stats
**Requires Authentication**

**Endpoint:** `GET /api/v1/adl/:symbol/stats`

---

## 9. Trigger Orders

### 9.1 Get Trigger Order Config
**Public Endpoint**

**Endpoint:** `GET /api/v1/trigger-orders/:symbol/config`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "market_symbol": "BTC-USD",
    "max_trigger_orders_per_user": 100,
    "max_trigger_orders_per_position": 5,
    "min_trigger_distance_pct": "0.0500",
    "max_trigger_distance_pct": "50.0000",
    "min_trailing_delta_pct": "0.1000",
    "max_trailing_delta_pct": "20.0000",
    "trigger_check_interval_ms": 100,
    "slippage_tolerance_pct": "1.0000",
    "enabled": true,
    "created_at": "2024-12-08T12:00:00Z",
    "updated_at": "2024-12-08T12:00:00Z"
  },
  "error": null
}
```

**Supported Trigger Types:** `stop_loss`, `take_profit`, `stop_limit`, `trailing_stop`

---

### 9.2 Create Trigger Order
**Requires Authentication**

**Endpoint:** `POST /api/v1/trigger-orders`

**Request Body:**
```json
{
  "symbol": "BTC-USD",
  "side": "sell",
  "trigger_type": "stop_loss",
  "trigger_price": "95000.00",
  "size": "0.1",
  "reduce_only": true
}
```

---

### 9.3 Get Trigger Orders
**Requires Authentication**

**Endpoint:** `GET /api/v1/trigger-orders`

---

### 9.4 Get Trigger Order
**Requires Authentication**

**Endpoint:** `GET /api/v1/trigger-orders/:order_id`

---

### 9.5 Cancel Trigger Order
**Requires Authentication**

**Endpoint:** `DELETE /api/v1/trigger-orders/:order_id`

---

### 9.6 Get User Executions
**Requires Authentication**

**Endpoint:** `GET /api/v1/trigger-orders/executions`

---

### 9.7 Get User Stats
**Requires Authentication**

**Endpoint:** `GET /api/v1/trigger-orders/:symbol/stats`

---

### 9.8 Set Position TP/SL
**Requires Authentication**

**Endpoint:** `POST /api/v1/positions/:position_id/tp-sl`

---

### 9.9 Get Position TP/SL
**Requires Authentication**

**Endpoint:** `GET /api/v1/positions/:position_id/tp-sl`

---

## 10. Deposit & Withdrawal

### 10.1 Prepare Deposit
**Requires Authentication**

**Endpoint:** `POST /api/v1/deposit/prepare`

---

### 10.2 Get Deposit History
**Requires Authentication**

**Endpoint:** `GET /api/v1/deposit/history`

---

### 10.3 Request Withdrawal
**Requires Authentication**

**Endpoint:** `POST /api/v1/withdraw/request`

**Request Body:**
```json
{
  "token": "0x3321Fd36aEaB0d5CdfD26f4A3a93E2D2aAcCB99f",
  "amount": "100.00"
}
```

---

### 10.4 Get Withdrawal History
**Requires Authentication**

**Endpoint:** `GET /api/v1/withdraw/history`

---

## 11. Referral

### 11.1 Create Referral Code
**Requires Authentication**

**Endpoint:** `POST /api/v1/referral/codes`

**Request Body:**
```json
{
  "timestamp": 1733650000,
  "signature": "0x..."
}
```

**Response:**
```json
{
  "success": true,
  "code": "ABC12345",
  "created_at": "2024-12-08T12:00:00Z"
}
```

---

### 11.2 Bind Referral Code
**Requires Authentication**

**Endpoint:** `POST /api/v1/referral/bind`

**Request Body:**
```json
{
  "code": "ABC12345",
  "timestamp": 1733650000,
  "signature": "0x..."
}
```

---

### 11.3 Get Dashboard
**Requires Authentication**

**Endpoint:** `GET /api/v1/referral/dashboard`

**Response:**
```json
{
  "code": "ABC12345",
  "total_referrals": 25,
  "active_referrals": 10,
  "total_earnings": "1500.00",
  "pending_earnings": "200.00",
  "claimed_earnings": "1300.00",
  "tier": {
    "level": 2,
    "name": "Gold",
    "commission_rate": "0.15",
    "next_tier_requirement": 50
  },
  "recent_activity": []
}
```

---

### 11.4 Claim Earnings
**Requires Authentication**

**Endpoint:** `POST /api/v1/referral/claim`

---

### 11.5 Get On-Chain Dashboard (Public)
**Public Endpoint**

**Endpoint:** `GET /api/v1/referral/on-chain/dashboard/:address`

**Response:**
```json
{
  "code": "ABC12345",
  "total_referees": 25,
  "total_volume_usd": "1000000.00",
  "total_earnings_usd": "1500.00",
  "claimed_earnings_usd": "1300.00",
  "claimable_earnings_usd": "200.00",
  "current_tier": 2,
  "current_rate_bps": 1500,
  "tier_name": "Gold"
}
```

---

### 11.6 Get On-Chain Claimable (Public)
**Public Endpoint**

**Endpoint:** `GET /api/v1/referral/on-chain/claimable/:address`

---

### 11.7 Get Operator Status (Public)
**Public Endpoint**

**Endpoint:** `GET /api/v1/referral/on-chain/operator-status`

---

## 12. WebSocket API

### Connection
**URL:** `ws://localhost:8080/ws`

### Authentication

#### Option 1: Wallet Signature Auth
Send auth message after connection:
```json
{
  "type": "auth",
  "address": "0x6538469807e019E05c9ec4Bd158b12afB1DA50F3",
  "signature": "0x...",
  "timestamp": 1733650000
}
```

**Auth Message Format:**
```
Authenticate to PRIMIT WebSocket

Timestamp: {timestamp}
Address: {address}
```

#### Option 2: JWT Token Auth
Use an existing JWT token from the login endpoint:
```json
{
  "type": "authtoken",
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response:**
```json
{
  "type": "authresult",
  "success": true,
  "message": null
}
```

---

### Channels

#### Public Channels (No auth required)
| Channel | Description |
|---------|-------------|
| `ticker:{symbol}` | Real-time ticker updates (every 2s) |
| `orderbook:{symbol}` | Orderbook updates |
| `trades:{symbol}` | Real-time trade updates |
| `trades:*` | All trades |

#### Private Channels (Auth required)
| Channel | Description |
|---------|-------------|
| `positions` | Position updates (every 5s) |
| `orders` | Order status updates (every 5s) |
| `balance` | Balance updates (every 5s) |

---

### Subscribe
```json
{
  "type": "subscribe",
  "channel": "ticker:BTC-USD"
}
```

**Response:**
```json
{
  "type": "subscribed",
  "channel": "ticker:BTC-USD"
}
```

---

### Unsubscribe
```json
{
  "type": "unsubscribe",
  "channel": "ticker:BTC-USD"
}
```

---

### Ping/Pong
```json
{
  "type": "ping"
}
```

**Response:**
```json
{
  "type": "pong"
}
```

---

### Message Types

#### Ticker Update
```json
{
  "type": "ticker",
  "symbol": "BTC-USD",
  "last_price": "99500.50",
  "price_change_24h": "1500.25",
  "price_change_percent_24h": "1.53",
  "high_24h": "100200.00",
  "low_24h": "97800.00",
  "volume_24h": "12500.5"
}
```

#### Trade Update
```json
{
  "type": "trade",
  "symbol": "BTC-USD",
  "price": "99500.50",
  "amount": "0.5",
  "side": "buy",
  "timestamp": 1733650000000
}
```

#### Orderbook Update
```json
{
  "type": "orderbook",
  "symbol": "BTC-USD",
  "bids": [["99500.00", "1.5"]],
  "asks": [["99501.00", "1.2"]],
  "timestamp": 1733650000000
}
```

#### Position Update (Private)
```json
{
  "type": "position",
  "id": "uuid",
  "symbol": "BTC-USD",
  "side": "long",
  "size": "0.5",
  "entry_price": "99000.00",
  "mark_price": "99500.00",
  "liquidation_price": "95000.00",
  "unrealized_pnl": "250.00",
  "leverage": 10
}
```

#### Order Update (Private)
```json
{
  "type": "order",
  "id": "uuid",
  "symbol": "BTC-USD",
  "side": "buy",
  "order_type": "limit",
  "price": "99000.00",
  "amount": "0.1",
  "filled_amount": "0",
  "status": "open"
}
```

#### Balance Update (Private)
```json
{
  "type": "balance",
  "token": "0x3321Fd36aEaB0d5CdfD26f4A3a93E2D2aAcCB99f",
  "symbol": "USDC",
  "available": "10000.00",
  "frozen": "500.00",
  "total": "10500.00"
}
```

#### Error
```json
{
  "type": "error",
  "code": "AUTH_REQUIRED",
  "message": "Authentication required for private channels"
}
```

---

## Supported Trading Pairs

| Symbol | Base | Quote |
|--------|------|-------|
| BTC-USD | BTC | USD |
| ETH-USD | ETH | USD |

---

## Rate Limits

- Public endpoints: 100 requests/minute
- Private endpoints: 300 requests/minute
- WebSocket messages: 100 messages/second

---

## Error Codes

| Code | Description |
|------|-------------|
| `INVALID_ADDRESS` | Invalid Ethereum address format |
| `TIMESTAMP_EXPIRED` | Timestamp outside 5-minute window |
| `INVALID_SIGNATURE_FORMAT` | Signature format is incorrect |
| `SIGNATURE_INVALID` | Signature verification failed |
| `USER_NOT_FOUND` | User not registered |
| `INVALID_MARKET` | Unknown trading pair |
| `INVALID_SYMBOL` | Unsupported symbol |
| `INVALID_LEVERAGE` | Leverage must be 1-50 |
| `INVALID_AMOUNT` | Amount must be positive |
| `PRICE_REQUIRED` | Limit orders require price |
| `INSUFFICIENT_BALANCE` | Not enough balance |
| `ORDER_NOT_FOUND` | Order does not exist |
| `ORDER_NOT_OWNED` | Order belongs to another user |
| `ORDER_NOT_CANCELLABLE` | Order cannot be cancelled |
| `AUTH_REQUIRED` | Authentication required |
| `CODE_ALREADY_EXISTS` | User already has referral code |
| `ALREADY_BOUND` | User already bound to referrer |
| `CODE_NOT_FOUND` | Referral code not found |
| `SELF_REFERRAL` | Cannot use own referral code |
| `NO_PENDING_EARNINGS` | No earnings to claim |
| `BELOW_MINIMUM` | Below minimum claim amount |

---

## Referral Tiers

| Tier | Name | Referrals Required | Commission Rate |
|------|------|-------------------|-----------------|
| 1 | Silver | 0+ | 10% |
| 2 | Gold | 10+ | 15% |
| 3 | Platinum | 50+ | 20% |
| 4 | Diamond | 100+ | 25% |

---

## Contract Addresses (Arbitrum Sepolia)

| Contract | Address |
|----------|---------|
| Vault | `0xf39C0BDfc80c457C52EDaD728485d3B7643D7846` |
| ReferralRebate | Configured in env |
| USDC | `0x3321Fd36aEaB0d5CdfD26f4A3a93E2D2aAcCB99f` |
| WETH | `0x980B62Da83eFf3D4576C647993b0c1D7faf17c73` |

---

*Document generated: 2024-12-08*
*Last updated: 2025-12-10*
*Status: ✅ 后端 API 已完全开发完成*
