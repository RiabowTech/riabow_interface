# Primit API 接口文档

**REST API 地址:** `https://api.primit.io`
**WebSocket 地址:** `wss://api.primit.iows`

---

## 目录

1. [身份认证](#身份认证)
2. [REST API 接口](#rest-api-接口)
   - [公开接口](#公开接口)
   - [私有接口](#私有接口)
3. [WebSocket 接口](#websocket-接口)
   - [连接方式](#连接方式)
   - [认证方式](#websocket-认证)
   - [订阅频道](#订阅频道)
4. [错误码](#错误码)

---

## 身份认证

PRIMIT 采用 **EIP-712** 签名认证方式，配合 JWT Token 使用。

### 认证流程

1. **获取 Nonce** - 根据钱包地址获取签名用的 nonce
2. **签名消息** - 使用钱包对消息进行 EIP-712 签名
3. **登录** - 提交签名获取 JWT Token
4. **使用 Token** - 在私有接口请求头中携带 JWT Token

### 获取 Nonce

```
GET /api/v1/auth/nonce/:address
```

**参数:**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| address | string | 是 | 钱包地址 |

**响应:**
```json
{
  "nonce": 1,
  "message": "Sign this message to login to PRIMIT.\n\nAddress: 0x...\nNonce: 1"
}
```

### 登录

```
POST /api/v1/auth/login
```

**请求参数:**
```json
{
  "address": "0x1234567890abcdef...",
  "signature": "0x...",
  "timestamp": 1702400000
}
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| address | string | 是 | 钱包地址 |
| signature | string | 是 | EIP-712 签名 |
| timestamp | number | 是 | 时间戳（秒），5分钟内有效 |

**响应:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "expires_at": 1702486400
}
```

### 使用 JWT Token

所有私有接口需要在请求头中携带 JWT Token：

```
Authorization: Bearer <token>
```

---

## REST API 接口

### 公开接口

#### 市场数据

##### 获取市场列表
```
GET /api/v1/markets
```

**查询参数:**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| limit | number | 否 | 返回数量，默认50，最大50 |

**响应:**
```json
{
  "markets": [
    {
      "symbol": "BTCUSDT",
      "base_asset": "BTC",
      "quote_asset": "USDT",
      "last_price": "97500.50",
      "price_change_24h": "1200.30",
      "price_change_percent_24h": "1.25",
      "high_24h": "98000.00",
      "low_24h": "95000.00",
      "volume_24h": "15000.5",
      "volume_24h_usd": "1462575000",
      "rank": 1
    }
  ],
  "total": 50
}
```

##### 获取订单簿
```
GET /api/v1/markets/:symbol/orderbook
```

**参数:**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| symbol | string | 是 | 交易对，如 BTCUSDT |

**响应:**
```json
{
  "symbol": "BTCUSDT",
  "bids": [["97500.00", "1.5"], ["97499.00", "2.3"]],
  "asks": [["97501.00", "1.2"], ["97502.00", "3.1"]],
  "timestamp": 1702400000000
}
```

##### 获取最近成交
```
GET /api/v1/markets/:symbol/trades
```

**响应:**
```json
{
  "symbol": "BTCUSDT",
  "trades": [
    {
      "id": "uuid-string",
      "price": "97500.50",
      "amount": "0.5",
      "side": "buy",
      "timestamp": 1702400000000
    }
  ]
}
```

##### 获取 Ticker
```
GET /api/v1/markets/:symbol/ticker
```

**响应:**
```json
{
  "symbol": "BTCUSDT",
  "last_price": "97500.50",
  "price_change_24h": "1200.30",
  "price_change_percent_24h": "1.25",
  "high_24h": "98000.00",
  "low_24h": "95000.00",
  "volume_24h": "1462575000",
  "open_interest": "5000000",
  "funding_rate": "0.0001",
  "next_funding_time": 1702411200
}
```

##### 获取实时价格
```
GET /api/v1/markets/:symbol/price
```

**响应:**
```json
{
  "symbol": "BTCUSDT",
  "mark_price": "97500.50",
  "index_price": "97498.30",
  "last_price": "97500.50",
  "bid_price": "97500.00",
  "ask_price": "97501.00",
  "funding_rate": "0.0001",
  "next_funding_rate": "0.0001",
  "next_funding_time": 1702411200000,
  "updated_at": 1702400000000
}
```

#### K线数据

##### 获取K线
```
GET /api/v1/markets/:symbol/candles
```

**查询参数:**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| period | string | 是 | K线周期：`1m`, `5m`, `15m`, `30m`, `1h`, `4h`, `1d` |
| limit | number | 否 | 返回数量，默认100，最大500 |
| start | number | 否 | 开始时间戳（毫秒） |
| end | number | 否 | 结束时间戳（毫秒） |

**响应:**
```json
{
  "symbol": "BTCUSDT",
  "period": "1m",
  "candles": [
    {
      "time": 1702400000000,
      "open": "97450.00",
      "high": "97520.00",
      "low": "97430.00",
      "close": "97500.50",
      "volume": "125.5"
    }
  ]
}
```

##### 获取最新K线
```
GET /api/v1/markets/:symbol/candles/latest?period=1m
```

#### 资金费率

##### 获取所有资金费率
```
GET /api/v1/funding-rates
```

##### 获取指定交易对资金费率
```
GET /api/v1/funding-rates/:symbol
```

##### 获取资金费率历史
```
GET /api/v1/funding-rates/:symbol/history
```

#### 清算信息（公开）

##### 获取市场清算记录
```
GET /api/v1/liquidations/:symbol
```

##### 获取清算配置
```
GET /api/v1/liquidations/:symbol/config
```

##### 获取保险基金
```
GET /api/v1/insurance-fund/:symbol
```

#### ADL（自动去杠杆，公开）

##### 获取ADL排名
```
GET /api/v1/adl/:symbol/rankings
```

##### 获取ADL事件
```
GET /api/v1/adl/:symbol/events
```

##### 获取ADL配置
```
GET /api/v1/adl/:symbol/config
```

---

### 私有接口

所有私有接口需要在请求头中携带 `Authorization: Bearer <token>`。

#### 账户信息

##### 获取用户信息
```
GET /api/v1/account/profile
```

##### 获取账户余额
```
GET /api/v1/account/balances
```

**响应:**
```json
{
  "balances": [
    {
      "token": "0x...",
      "symbol": "USDC",
      "available": "10000.00",
      "frozen": "500.00",
      "total": "10500.00"
    }
  ]
}
```

##### 获取持仓列表
```
GET /api/v1/account/positions
```

##### 获取订单列表
```
GET /api/v1/account/orders
```

##### 获取成交记录
```
GET /api/v1/account/trades
```

#### 订单管理

##### 创建订单
```
POST /api/v1/orders
```

**请求参数:**
```json
{
  "symbol": "BTCUSDT",
  "side": "long",
  "order_type": "limit",
  "price": "97000.00",
  "amount": "0.1",
  "leverage": 10,
  "timestamp": 1702400000,
  "signature": "0x..."
}
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| symbol | string | 是 | 交易对 |
| side | string | 是 | 方向：`long`(做多) / `short`(做空) |
| order_type | string | 是 | 类型：`limit`(限价) / `market`(市价) |
| price | string | 限价单必填 | 委托价格 |
| amount | string | 是 | 委托数量 |
| leverage | number | 是 | 杠杆倍数（1-50） |
| timestamp | number | 是 | 时间戳（秒） |
| signature | string | 是 | 订单签名 |

**签名消息格式:**
```
Create Order on PRIMIT

Symbol: BTCUSDT
Side: long
Type: limit
Price: 97000.00
Amount: 0.1
Leverage: 10
Timestamp: 1702400000
Address: 0x...
```

**响应:**
```json
{
  "order_id": "uuid-string",
  "status": "open",
  "filled_amount": "0",
  "remaining_amount": "0.1",
  "average_price": null,
  "created_at": "2024-12-12T10:00:00Z"
}
```

##### 获取订单详情
```
GET /api/v1/orders/:order_id
```

##### 取消订单
```
DELETE /api/v1/orders/:order_id
```

**请求参数:**
```json
{
  "signature": "0x...",
  "timestamp": 1702400000
}
```

##### 批量取消订单
```
POST /api/v1/orders/batch
```

**请求参数:**
```json
{
  "order_ids": ["uuid-1", "uuid-2"],
  "signature": "0x...",
  "timestamp": 1702400000
}
```

**响应:**
```json
{
  "cancelled": ["uuid-1", "uuid-2"],
  "failed": []
}
```

#### 持仓管理

##### 获取所有持仓
```
GET /api/v1/positions
```

**响应:**
```json
{
  "positions": [
    {
      "position_id": "uuid-string",
      "symbol": "BTCUSDT",
      "side": "long",
      "size": "0.5",
      "entry_price": "97000.00",
      "mark_price": "97500.00",
      "liquidation_price": "87500.00",
      "collateral_amount": "5000.00",
      "leverage": 10,
      "unrealized_pnl": "250.00",
      "unrealized_pnl_percent": "5.00",
      "realized_pnl": "0",
      "margin_ratio": "0.15",
      "status": "open"
    }
  ],
  "total_unrealized_pnl": "250.00",
  "total_collateral": "5000.00"
}
```

##### 开仓
```
POST /api/v1/positions
```

**请求参数:**
```json
{
  "symbol": "BTCUSDT",
  "side": "long",
  "collateral_amount": "1000.00",
  "leverage": 10
}
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| symbol | string | 是 | 交易对 |
| side | string | 是 | 方向：`long` / `short` |
| collateral_amount | string | 是 | 保证金金额 |
| leverage | number | 是 | 杠杆倍数 |

##### 获取持仓详情
```
GET /api/v1/positions/:position_id
```

##### 平仓
```
POST /api/v1/positions/:position_id/close
```

**请求参数:**
```json
{
  "amount": "0.5",
  "price": null
}
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| amount | string | 是 | 平仓数量，全部平仓传入持仓数量 |
| price | string | 否 | 指定价格，null为市价 |

##### 追加保证金
```
POST /api/v1/positions/:position_id/collateral/add
```

**请求参数:**
```json
{
  "amount": "500.00"
}
```

##### 减少保证金
```
POST /api/v1/positions/:position_id/collateral/remove
```

**请求参数:**
```json
{
  "amount": "200.00"
}
```

##### 查询清算状态
```
GET /api/v1/positions/:position_id/liquidation
```

#### 触发单（止盈止损）

##### 设置持仓止盈止损
```
POST /api/v1/positions/:position_id/tp-sl
```

##### 获取持仓止盈止损
```
GET /api/v1/positions/:position_id/tp-sl
```

##### 创建触发单
```
POST /api/v1/trigger-orders
```

##### 获取触发单列表
```
GET /api/v1/trigger-orders
```

##### 取消触发单
```
DELETE /api/v1/trigger-orders/:order_id
```

#### 充值与提现

##### 准备充值
```
POST /api/v1/deposit/prepare
```

##### 获取充值历史
```
GET /api/v1/deposit/history
```

##### 申请提现
```
POST /api/v1/withdraw/request
```

##### 获取提现历史
```
GET /api/v1/withdraw/history
```

#### 推荐系统

##### 创建推荐码
```
POST /api/v1/referral/codes
```

##### 绑定推荐码
```
POST /api/v1/referral/bind
```

##### 获取推荐面板
```
GET /api/v1/referral/dashboard
```

##### 领取收益
```
POST /api/v1/referral/claim
```

---

## WebSocket 接口

### 连接方式

连接 WebSocket 端点：

```
wss://api.primit.io/ws
```

### WebSocket 认证

#### 方式一：Auth 消息携带 JWT Token

```json
{
  "type": "auth",
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

#### 方式二：AuthToken 消息

```json
{
  "type": "authtoken",
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

#### 方式三：签名认证

```json
{
  "type": "auth",
  "address": "0x1234567890abcdef...",
  "signature": "0x...",
  "timestamp": 1702400000
}
```

#### 方式四：订阅时携带 Token

```json
{
  "type": "subscribe",
  "channel": "positions",
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

**认证响应:**
```json
{
  "type": "authresult",
  "success": true,
  "message": null
}
```

### 订阅频道

#### 公开频道

##### Ticker（行情）
```json
{"type": "subscribe", "channel": "ticker:BTCUSDT"}
```

**推送数据:**
```json
{
  "type": "ticker",
  "symbol": "BTCUSDT",
  "last_price": "97500.50",
  "price_change_24h": "1200.30",
  "price_change_percent_24h": "1.25",
  "high_24h": "98000.00",
  "low_24h": "95000.00",
  "volume_24h": "15000.5"
}
```

##### Orderbook（订单簿）
```json
{"type": "subscribe", "channel": "orderbook:BTCUSDT"}
```

**推送数据:**
```json
{
  "type": "orderbook",
  "symbol": "BTCUSDT",
  "bids": [["97500.00", "1.5"], ["97499.00", "2.3"]],
  "asks": [["97501.00", "1.2"], ["97502.00", "3.1"]],
  "timestamp": 1702400000000
}
```

##### Trades（成交）
```json
{"type": "subscribe", "channel": "trades:BTCUSDT"}
```

**推送数据:**
```json
{
  "type": "trade",
  "symbol": "BTCUSDT",
  "price": "97500.50",
  "amount": "0.5",
  "side": "buy",
  "timestamp": 1702400000000
}
```

##### K-Line（K线）
```json
{"type": "subscribe", "channel": "kline:BTCUSDT:1m"}
```

**支持周期:** `1m`, `5m`, `15m`, `30m`, `1h`, `4h`, `1d`

**初始快照:**
```json
{
  "type": "klinesnapshot",
  "channel": "kline:BTCUSDT:1m",
  "data": [
    {
      "time": 1702400000000,
      "open": "97450.00",
      "high": "97520.00",
      "low": "97430.00",
      "close": "97500.50",
      "volume": "125.5",
      "is_final": true
    }
  ]
}
```

**实时更新:**
```json
{
  "type": "kline",
  "channel": "kline:BTCUSDT:1m",
  "data": {
    "time": 1702400060000,
    "open": "97500.50",
    "high": "97550.00",
    "low": "97490.00",
    "close": "97530.00",
    "volume": "85.3",
    "is_final": false
  }
}
```

#### 私有频道（需要认证）

##### Positions（持仓）
```json
{"type": "subscribe", "channel": "positions"}
```

**推送数据:**
```json
{
  "type": "position",
  "id": "uuid-string",
  "symbol": "BTCUSDT",
  "side": "long",
  "size": "0.5",
  "entry_price": "97000.00",
  "mark_price": "97500.00",
  "liquidation_price": "87500.00",
  "unrealized_pnl": "250.00",
  "leverage": 10
}
```

##### Orders（订单）
```json
{"type": "subscribe", "channel": "orders"}
```

**推送数据:**
```json
{
  "type": "order",
  "id": "uuid-string",
  "symbol": "BTCUSDT",
  "side": "long",
  "order_type": "limit",
  "price": "97000.00",
  "amount": "0.1",
  "filled_amount": "0",
  "status": "open"
}
```

##### Balance（余额）
```json
{"type": "subscribe", "channel": "balance"}
```

**推送数据:**
```json
{
  "type": "balance",
  "token": "0x...",
  "symbol": "USDC",
  "available": "10000.00",
  "frozen": "500.00",
  "total": "10500.00"
}
```

### 控制消息

#### 心跳
```json
{"type": "ping"}
```

**响应:**
```json
{"type": "pong"}
```

#### 取消订阅
```json
{"type": "unsubscribe", "channel": "ticker:BTCUSDT"}
```

**响应:**
```json
{"type": "unsubscribed", "channel": "ticker:BTCUSDT"}
```

---

## 错误码

| 错误码 | 说明 |
|--------|------|
| `INVALID_SYMBOL` | 不支持的交易对 |
| `TIMESTAMP_EXPIRED` | 请求时间戳已过期（超过5分钟） |
| `INVALID_SIGNATURE_FORMAT` | 签名格式无效 |
| `SIGNATURE_INVALID` | 签名验证失败 |
| `USER_NOT_FOUND` | 用户不存在，请先获取 nonce |
| `INSUFFICIENT_BALANCE` | 可用余额不足 |
| `INVALID_LEVERAGE` | 杠杆倍数必须在 1-50 之间 |
| `INVALID_AMOUNT` | 订单数量必须大于0 |
| `PRICE_REQUIRED` | 限价单必须指定价格 |
| `ORDER_NOT_FOUND` | 订单不存在 |
| `ORDER_NOT_OWNED` | 无权操作此订单 |
| `ORDER_NOT_CANCELLABLE` | 当前状态无法取消订单 |
| `AUTH_REQUIRED` | 私有频道需要认证 |
| `INVALID_MESSAGE` | WebSocket 消息格式无效 |
| `DATABASE_ERROR` | 数据库错误 |
| `MATCHING_ERROR` | 撮合引擎错误 |
| `PRICE_UNAVAILABLE` | 无法获取当前市场价格 |
| `POSITION_OPEN_FAILED` | 开仓失败 |
| `BALANCE_FETCH_FAILED` | 获取余额失败 |

---

## 频率限制

| 接口类型 | 限制 |
|----------|------|
| 公开 REST 接口 | 100 次/分钟 |
| 私有 REST 接口 | 60 次/分钟 |
| WebSocket 消息 | 100 条/秒 |

---

## 支持的交易对

当前支持的永续合约交易对：
- `BTCUSDT` - 比特币/USDT 永续合约
- `ETHUSDT` - 以太坊/USDT 永续合约

价格数据支持 Binance 成交量前50的交易对。

---

## 代码示例

### JavaScript/TypeScript

#### REST API 示例
```typescript
const API_BASE = 'https://api.primit.io/api/v1';

// 获取市场列表
const markets = await fetch(`${API_BASE}/markets`).then(r => r.json());

// 获取 nonce
const nonceResp = await fetch(`${API_BASE}/auth/nonce/${walletAddress}`).then(r => r.json());

// 登录
const loginResponse = await fetch(`${API_BASE}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    address: walletAddress,
    signature: signature,
    timestamp: Math.floor(Date.now() / 1000)
  })
}).then(r => r.json());

const token = loginResponse.token;

// 创建订单（需要认证）
const order = await fetch(`${API_BASE}/orders`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    symbol: 'BTCUSDT',
    side: 'long',
    order_type: 'market',
    amount: '0.01',
    leverage: 10,
    timestamp: Math.floor(Date.now() / 1000),
    signature: orderSignature
  })
}).then(r => r.json());

// 获取持仓
const positions = await fetch(`${API_BASE}/positions`, {
  headers: { 'Authorization': `Bearer ${token}` }
}).then(r => r.json());
```

#### WebSocket 示例
```typescript
const ws = new WebSocket('wss://api.primit.io/ws');

ws.onopen = () => {
  // JWT 认证
  ws.send(JSON.stringify({
    type: 'auth',
    token: jwtToken
  }));

  // 订阅公开频道
  ws.send(JSON.stringify({
    type: 'subscribe',
    channel: 'ticker:BTCUSDT'
  }));

  // 订阅K线
  ws.send(JSON.stringify({
    type: 'subscribe',
    channel: 'kline:BTCUSDT:1m'
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);

  switch(data.type) {
    case 'authresult':
      if (data.success) {
        // 认证成功，订阅私有频道
        ws.send(JSON.stringify({
          type: 'subscribe',
          channel: 'positions'
        }));
        ws.send(JSON.stringify({
          type: 'subscribe',
          channel: 'balance'
        }));
      }
      break;
    case 'ticker':
      console.log(`${data.symbol} 最新价: ${data.last_price}`);
      break;
    case 'kline':
      console.log(`K线更新: ${data.data.close}`);
      break;
    case 'position':
      console.log(`持仓更新: ${data.symbol} ${data.unrealized_pnl}`);
      break;
  }
};

// 心跳保持连接
setInterval(() => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'ping' }));
  }
}, 30000);
```

### Python

```python
import requests
import websockets
import asyncio
import json

API_BASE = 'https://api.primit.io/api/v1'
WS_URL = 'wss://api.primit.io/ws'

# REST API 示例
def get_markets():
    return requests.get(f'{API_BASE}/markets').json()

def get_ticker(symbol):
    return requests.get(f'{API_BASE}/markets/{symbol}/ticker').json()

def login(address, signature, timestamp):
    return requests.post(f'{API_BASE}/auth/login', json={
        'address': address,
        'signature': signature,
        'timestamp': timestamp
    }).json()

# WebSocket 示例
async def subscribe_ticker():
    async with websockets.connect(WS_URL) as ws:
        # 订阅 ticker
        await ws.send(json.dumps({
            'type': 'subscribe',
            'channel': 'ticker:BTCUSDT'
        }))

        # 订阅 K线
        await ws.send(json.dumps({
            'type': 'subscribe',
            'channel': 'kline:BTCUSDT:1m'
        }))

        async for message in ws:
            data = json.loads(message)
            if data['type'] == 'ticker':
                print(f"Ticker: {data['symbol']} @ {data['last_price']}")
            elif data['type'] == 'kline':
                print(f"K线: {data['data']['close']}")

# 运行
if __name__ == '__main__':
    # REST
    markets = get_markets()
    print(f"市场数量: {markets['total']}")

    ticker = get_ticker('BTCUSDT')
    print(f"BTC 最新价: {ticker['last_price']}")

    # WebSocket
    asyncio.run(subscribe_ticker())
```

### cURL 示例

```bash
# 获取市场列表
curl https://api.primit.io/api/v1/markets

# 获取 BTCUSDT Ticker
curl https://api.primit.io/api/v1/markets/BTCUSDT/ticker

# 获取 K线数据
curl "https://api.primit.io/api/v1/markets/BTCUSDT/candles?period=1m&limit=100"

# 获取 nonce
curl https://api.primit.io/api/v1/auth/nonce/0x1234...

# 登录
curl -X POST https://api.primit.io/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"address":"0x...","signature":"0x...","timestamp":1702400000}'

# 获取持仓（需要认证）
curl https://api.primit.io/api/v1/positions \
  -H "Authorization: Bearer eyJhbGci..."
```

---

## 更新日志

- **2024-12-12**: API 文档初版发布
- 支持 WebSocket JWT Token 认证
- K线/蜡烛图数据接口和 WebSocket 频道
- Binance 实时价格数据接入

---
