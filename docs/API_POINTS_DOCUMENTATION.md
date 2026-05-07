# Axblade 积分系统 API 接口文档

## 概述

本文档描述 Axblade 平台的积分系统 API 接口，包括用户积分查询、排行榜查询和 Epoch 管理等功能。

---

## 1. 获取用户积分数据

### 接口信息
- **接口路径**: `/api/points`
- **请求方法**: `POST`
- **接口说明**: 获取当前登录用户的积分详细数据
- **需要认证**: 是（后端从认证信息中获取钱包地址）

### 请求参数

#### Request Body (JSON)

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| epoch  | number | 否 | 查询指定 Epoch 的积分数据，不传则使用当前 Epoch |

### 请求示例

```bash
POST /api/points
Authorization: Bearer {JWT_TOKEN}
Content-Type: application/json

{
  "epoch": 3
}
```

### 响应参数

#### Response Body (JSON)

```typescript
{
  "totalPoints": number | null,           // 总积分
  "epochRanking": number | null,          // 本期排名
  "currentEpochPoints": number | null,    // 本期积分
  "walletAddress": string | null,         // 钱包地址
  "referralCode": string | null,          // 推荐码
  "pointsBreakdown": {                    // 积分明细
    "trading": number | null,             // 交易积分
    "holding": number | null,             // 持仓积分
    "pnl": number | null,                 // 盈亏积分
    "referral": number | null,            // 推荐积分
    "staking": number | null              // 质押积分
  },
  "currentUserRank": number | null        // 当前用户排名
}
```

### 响应示例

#### 成功响应 (200 OK)

```json
{
  "totalPoints": 618139.5,
  "epochRanking": 2616.1,
  "currentEpochPoints": 2616.1,
  "walletAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb7",
  "referralCode": "F3EGTA",
  "pointsBreakdown": {
    "trading": 1316.5,
    "holding": 216,
    "pnl": 716,
    "referral": 716,
    "staking": 716
  },
  "currentUserRank": 111
}
```

#### 未授权 (401 Unauthorized)

```json
{
  "error": "Unauthorized",
  "message": "Authentication required"
}
```

#### 用户未找到 (404 Not Found)

```json
{
  "error": "User not found",
  "message": "No data found for the authenticated user"
}
```

---

## 2. 获取排行榜数据

### 接口信息
- **接口路径**: `/api/leaderboard`
- **请求方法**: `GET`
- **接口说明**: 获取指定 Epoch 的排行榜数据

### 请求参数

#### Query Parameters
| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| epoch | number | 否 | 当前期数 | 查询指定 Epoch 的排行榜 |
| limit | number | 否 | 100 | 返回记录数量 (1-1000) |
| offset | number | 否 | 0 | 分页偏移量 |

### 请求示例

```bash
GET /api/leaderboard?epoch=3&limit=50&offset=0
Authorization: Bearer {JWT_TOKEN}
```

**注意**: 如果提供了认证信息，返回的排行榜数据中 `isCurrent` 字段会根据当前登录用户自动标记。

### 响应参数

#### Response Body (JSON)

```typescript
{
  "items": [
    {
      "rank": number,           // 排名
      "address": string,        // 钱包地址
      "points": number,         // 积分
      "isCurrent": boolean      // 是否为当前用户
    }
  ],
  "total": number,              // 总记录数
  "epoch": number,              // Epoch 期数
  "limit": number,              // 每页数量
  "offset": number              // 偏移量
}
```

### 响应示例

#### 成功响应 (200 OK)

```json
{
  "items": [
    {
      "rank": 1,
      "address": "0xb1...fw30",
      "points": 6000000,
      "isCurrent": false
    },
    {
      "rank": 2,
      "address": "0xb1...fw31",
      "points": 5900000,
      "isCurrent": false
    },
    {
      "rank": 111,
      "address": "0x742d...bEb7",
      "points": 618139.5,
      "isCurrent": true
    }
  ],
  "total": 15832,
  "epoch": 3,
  "limit": 50,
  "offset": 0
}
```

---

## 3. 获取 Epoch 列表

### 接口信息
- **接口路径**: `/api/epochs`
- **请求方法**: `GET`
- **接口说明**: 获取所有可用的 Epoch 列表

### 请求参数
无

### 请求示例

```bash
GET /api/epochs
```

### 响应参数

#### Response Body (JSON)

```typescript
{
  "epochs": [
    {
      "id": number,           // Epoch ID
      "label": string,        // Epoch 标签
      "startDate": string,    // 开始日期 (ISO 8601)
      "endDate": string,      // 结束日期 (ISO 8601)
      "status": string        // 状态: "upcoming" | "active" | "ended"
    }
  ],
  "currentEpochId": number    // 当前活跃的 Epoch ID
}
```

### 响应示例

#### 成功响应 (200 OK)

```json
{
  "epochs": [
    {
      "id": 1,
      "label": "Epoch 1: 2026.1.1 - 2026.1.7",
      "startDate": "2026-01-01T00:00:00Z",
      "endDate": "2026-01-07T23:59:59Z",
      "status": "ended"
    },
    {
      "id": 2,
      "label": "Epoch 2: 2026.1.8 - 2026.1.15",
      "startDate": "2026-01-08T00:00:00Z",
      "endDate": "2026-01-15T23:59:59Z",
      "status": "ended"
    },
    {
      "id": 3,
      "label": "Epoch 3: 2026.3.8 - 2026.3.15",
      "startDate": "2026-03-08T00:00:00Z",
      "endDate": "2026-03-15T23:59:59Z",
      "status": "active"
    }
  ],
  "currentEpochId": 3
}
```