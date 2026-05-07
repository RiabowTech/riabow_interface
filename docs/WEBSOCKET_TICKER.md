# WebSocket Ticker 数据结构文档

## 概述

Ticker 频道提供实时市场数据，包括价格、成交量、持仓量、流动性和资金费率等信息。数据每 **2 秒** 推送一次。

## 订阅方式

```json
{
  "type": "subscribe",
  "channel": "ticker:BTCUSDT"
}
```

## 数据结构

### Ticker 消息格式

```typescript
interface TickerMessage {
  type: "ticker";
  symbol: string;

  // 价格数据
  last_price: string;
  mark_price: string;
  index_price: string;

  // 24小时统计
  price_change_24h: string;
  price_change_percent_24h: string;
  high_24h: string;
  low_24h: string;
  volume_24h: string;
  volume_24h_usd: string;

  // 持仓量 (Open Interest)
  open_interest_long: string;
  open_interest_short: string;
  open_interest_long_percent: string;
  open_interest_short_percent: string;

  // 流动性
  available_liquidity_long: string;
  available_liquidity_short: string;

  // 资金费率
  funding_rate_long_1h: string;
  funding_rate_short_1h: string;
}
```

### 字段说明

#### 价格数据

| 字段 | 类型 | 说明 | 示例 |
|------|------|------|------|
| `symbol` | string | 交易对符号 | `"BTCUSDT"` |
| `last_price` | string | 最新成交价 | `"87151.60"` |
| `mark_price` | string | 标记价格 (用于 PnL 计算和清算判断) | `"87155.20"` |
| `index_price` | string | 指数价格 (现货价格参考) | `"87150.00"` |

#### 24小时统计数据

| 字段 | 类型 | 说明 | 示例 |
|------|------|------|------|
| `price_change_24h` | string | 24小时价格变化 (绝对值) | `"-2432.50"` |
| `price_change_percent_24h` | string | 24小时价格变化百分比 | `"-2.72"` |
| `high_24h` | string | 24小时最高价 | `"89584.10"` |
| `low_24h` | string | 24小时最低价 | `"86800.00"` |
| `volume_24h` | string | 24小时成交量 (基础资产) | `"1308.5"` |
| `volume_24h_usd` | string | 24小时成交量 (USD) | `"114000000"` |

#### 持仓量 (Open Interest)

| 字段 | 类型 | 说明 | 示例 |
|------|------|------|------|
| `open_interest_long` | string | 多头持仓总额 (USD) | `"21300000"` |
| `open_interest_short` | string | 空头持仓总额 (USD) | `"15300000"` |
| `open_interest_long_percent` | string | 多头持仓占比 (%) | `"58"` |
| `open_interest_short_percent` | string | 空头持仓占比 (%) | `"42"` |

#### 流动性 (Available Liquidity)

| 字段 | 类型 | 说明 | 示例 |
|------|------|------|------|
| `available_liquidity_long` | string | 可供开多的流动性 (USD) - 来自卖单深度 | `"35800000"` |
| `available_liquidity_short` | string | 可供开空的流动性 (USD) - 来自买单深度 | `"41700000"` |

#### 资金费率 (Funding Rate)

| 字段 | 类型 | 说明 | 示例 |
|------|------|------|------|
| `funding_rate_long_1h` | string | 多头每小时资金费率 (负数 = 支付) | `"-0.0017%"` |
| `funding_rate_short_1h` | string | 空头每小时资金费率 (负数 = 支付) | `"+0.0014%"` |

## 示例数据

### 完整消息示例

```json
{
  "type": "ticker",
  "symbol": "BTCUSDT",
  "last_price": "87151.60",
  "mark_price": "87155.20",
  "index_price": "87150.00",
  "price_change_24h": "-2432.50",
  "price_change_percent_24h": "-2.72",
  "high_24h": "89584.10",
  "low_24h": "86800.00",
  "volume_24h": "1308.5",
  "volume_24h_usd": "114000000",
  "open_interest_long": "21300000",
  "open_interest_short": "15300000",
  "open_interest_long_percent": "58",
  "open_interest_short_percent": "42",
  "available_liquidity_long": "35800000",
  "available_liquidity_short": "41700000",
  "funding_rate_long_1h": "-0.0017%",
  "funding_rate_short_1h": "+0.0014%"
}
```

## 前端展示示例

基于以上数据，前端可以展示为：

```
BTC/USDT

$ 87,151.60
-2.72%

24h Volume          $ 114.0m
Open Interest       $ 21.3m / $ 15.3m  (58% / 42%)
Available Liquidity $ 35.8m / $ 41.7m
Net Rate / 1h       - 0.0017% / + 0.0014%
```

## 数据计算说明

### 持仓占比计算

```
open_interest_long_percent = open_interest_long / (open_interest_long + open_interest_short) × 100
open_interest_short_percent = open_interest_short / (open_interest_long + open_interest_short) × 100
```

### 流动性计算

```
available_liquidity_long = Σ(asks.price × asks.amount)   // 订单簿卖单深度
available_liquidity_short = Σ(bids.price × bids.amount)  // 订单簿买单深度
```

### 资金费率计算

```
// 正费率时：多头支付，空头收取
// 负费率时：空头支付，多头收取

funding_rate_long_1h = -funding_rate_per_hour   // 多头视角 (负号表示支付)
funding_rate_short_1h = funding_rate_per_hour   // 空头视角
```

## 数据来源

| 数据类型 | 来源 |
|----------|------|
| 价格数据 | PriceFeedService (内存缓存) |
| 持仓量 | FundingRateService (从仓位汇总) |
| 流动性 | Redis OrderbookCache (订单簿深度) |
| 资金费率 | FundingRateService (每分钟更新) |

## 推送频率

- **Ticker 更新**: 每 2 秒推送一次
- **订阅后立即推送**: 订阅成功后会立即收到一条当前数据

## 使用示例

### JavaScript/TypeScript

```typescript
const ws = new WebSocket('wss://api.primit.io/ws');

ws.onopen = () => {
  // 订阅 BTC 行情
  ws.send(JSON.stringify({
    type: 'subscribe',
    channel: 'ticker:BTCUSDT'
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);

  if (data.type === 'ticker') {
    console.log(`Price: $${data.last_price}`);
    console.log(`24h Change: ${data.price_change_percent_24h}%`);
    console.log(`Volume: $${formatNumber(data.volume_24h_usd)}`);
    console.log(`OI Long/Short: $${formatNumber(data.open_interest_long)} / $${formatNumber(data.open_interest_short)}`);
    console.log(`OI Ratio: ${data.open_interest_long_percent}% / ${data.open_interest_short_percent}%`);
    console.log(`Liquidity: $${formatNumber(data.available_liquidity_long)} / $${formatNumber(data.available_liquidity_short)}`);
    console.log(`Funding: ${data.funding_rate_long_1h} / ${data.funding_rate_short_1h}`);
  }
};

function formatNumber(value: string): string {
  const num = parseFloat(value);
  if (num >= 1e9) return (num / 1e9).toFixed(1) + 'b';
  if (num >= 1e6) return (num / 1e6).toFixed(1) + 'm';
  if (num >= 1e3) return (num / 1e3).toFixed(1) + 'k';
  return num.toFixed(2);
}
```

### Python

```python
import websocket
import json

def on_message(ws, message):
    data = json.loads(message)

    if data.get('type') == 'ticker':
        print(f"Symbol: {data['symbol']}")
        print(f"Price: ${data['last_price']}")
        print(f"24h Change: {data['price_change_percent_24h']}%")
        print(f"OI Long: ${float(data['open_interest_long']):,.0f} ({data['open_interest_long_percent']}%)")
        print(f"OI Short: ${float(data['open_interest_short']):,.0f} ({data['open_interest_short_percent']}%)")
        print(f"Funding Long: {data['funding_rate_long_1h']}")
        print(f"Funding Short: {data['funding_rate_short_1h']}")

def on_open(ws):
    ws.send(json.dumps({
        "type": "subscribe",
        "channel": "ticker:BTCUSDT"
    }))

ws = websocket.WebSocketApp(
    "wss://api.primit.io/ws",
    on_open=on_open,
    on_message=on_message
)
ws.run_forever()
```

---

*文档版本: v1.1*
*更新日期: 2024-12-16*
