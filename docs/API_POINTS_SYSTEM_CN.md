# XBlade 积分系统 (Points System) 接口文档

**版本**: v1.0
**更新时间**: 2026-01-14
**环境**: Sepolia Testnet

---

## 1. 概述

本接口服务于积分系统前端展示，包括用户积分详情、等级（Tier）、排行榜及赛季（Epoch）信息。

*   **Base URL**: `https://api.8a27.xyz/api/v1`
*   **数据格式**: JSON
*   **数值精度**: 所有金额、积分字段均以 **字符串 (String)** 类型返回，前端需使用 `Decimal` 或 `BigNumber` 库处理。

---

## 2. 接口列表

### 2.1 用户积分详情 (User Points)

获取当前登录用户的积分概览、明细及统计数据。

*   **Endpoint**: `/api/v1/points`
*   **Method**: `GET`
*   **Auth**: Required (Header: `x-user-address` 或 `Bearer Token`)
*   **Query Parameters**:
    *   `epoch` (可选, int): 指定赛季编号。默认返回当前活跃 Epoch。

**成功响应 (200 OK)**

```json
{
  "success": true,
  "data": {
    "user_address": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    "epoch_number": 1,
    "epoch_status": "active",
    
    // 积分明细
    "trading_points": "120.50",
    "pnl_points": "50.00",
    "holding_points": "10.00",
    "referral_points": "0.00",
    "staking_points": "0.00",
    
    // 总积分
    "total_points": "180.50",
    
    // 等级信息
    "tier": "T1",
    "tier_multiplier": "1.0",
    
    // 排名 (null 表示未上榜)
    "rank": 42,
    
    // 统计数据
    "trading_volume": "100000.00",
    "trade_count": 5,
    "referral_count": 0,
    
    "updated_at": "2026-01-14T07:20:00Z"
  },
  "error": null,
  "timestamp": 1705216800
}
```

### 2.2 积分排行榜 (Leaderboard)

获取当前 Epoch 的积分排行榜。

*   **Endpoint**: `/api/v1/leaderboard`
*   **Method**: `GET`
*   **Auth**: Public
*   **Query Parameters**:
    *   `epoch` (可选, int): 赛季编号 (默认当前Epoch)
    *   `type` (可选, string): 榜单类型 (默认total，可选: trading/pnl/holding/referral/staking)
    *   `limit` (可选, int): 每页数量 (默认100)

**成功响应 (200 OK)**

```json
{
  "success": true,
  "data": {
    "epoch_number": 1,
    "rank_type": "total",
    "total": 50,
    "updated_at": "2026-01-14T08:00:00Z",
    "entries": [
      {
        "rank": 1,
        "user_address": "0x123...abc",
        "username": null,
        "points": "10000.50",
        "tier": "T4"
      },
      {
        "rank": 2,
        "user_address": "0x456...def",
        "username": null,
        "points": "8500.00",
        "tier": "T3"
      }
    ]
  },
  "error": null
}
```

### 2.3 赛季信息 (Epochs)

获取当前系统的赛季状态信息。

*   **Endpoint**: `/api/v1/epochs`
*   **Method**: `GET`
*   **Auth**: Public

**成功响应 (200 OK)**

```json
{
  "success": true,
  "data": {
    "current_epoch": {
      "number": 1,
      "status": "active",
      "start_time": "2026-01-01T00:00:00Z",
      "end_time": "2026-01-31T23:59:59Z",
      "duration_days": 30
    }
  },
  "error": null
}
```

---

## 3. 集成说明

1.  **空状态**: 若用户在当前 Epoch 无数据，`/points` 接口将返回基础结构（数值为0），而不会报 404。
2.  **异步更新**: 积分计算由后台 Worker 异步处理，交易完成后可能通过 WebSocket 推送或需前端延迟/轮询更新。
3.  **身份认证**: 当前 `/points` 接口依赖 Header 中的 `Authorization: Bearer <token>` 标识用户身份。
