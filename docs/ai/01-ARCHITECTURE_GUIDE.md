## 架构指南

# React Frontend Architecture & Coding Guidelines

> 本文档是 **强约束型架构指南**。  
> Claude Code 在本项目中 **必须严格遵守** 以下规则。  
> 若存在冲突，以本文件为最高优先级。

---

## 1. 技术栈约束（不可擅自变更）

- Framework: **React 18+**
- Language: **TypeScript（严格模式）**
- Build Tool: Vite / Next.js（以项目实际为准）
- State Management:
  - 组件局部：`useState / useReducer`
  - 全局状态：Zustand / Redux Toolkit（已选定后不得混用）
- Styling:
  - Tailwind CSS / CSS Modules（二选一，禁止混用）
- Data Fetching:
  - TanStack Query（如已存在）
  - 否则使用自封装 `fetcher`
- 禁止引入未经说明的第三方库

---

## 2. 项目目录结构（强制）

```txt
src/
├── app/                # 应用入口 / 路由层（如 Next.js）
├── pages/              # 页面级组件（仅负责组合）
├── components/         # 可复用 UI 组件（无业务）
│   ├── common/
│   └── layout/
├── features/           # 业务功能模块（最重要）
│   └── order-book/
│       ├── components/
│       ├── hooks/
│       ├── services/
│       ├── store.ts
│       └── types.ts
├── hooks/              # 跨业务通用 hooks
├── services/           # API / 请求封装
├── stores/             # 全局状态（如 Zustand）
├── utils/              # 工具函数（纯函数）
├── types/              # 全局类型
└── constants/
```

- 禁止：
  - 页面直接写业务逻辑
  - components 中直接请求 API
  - utils 中访问 store / window / document

---

## 3. 组件分层原则（非常重要）

### 3.1 页面组件（Page）

- 只负责：
  - 路由参数
  - 页面布局
  - 调用 feature

- ❌ 不写业务判断
- ❌ 不直接请求 API

```typescript
// ✅ 正确
<OrderBookPage>
  <OrderBookFeature />
</OrderBookPage>
```

### 3.2 页面组件（Page）

- 一个 feature = 一个完整业务
- 包含：
  - 业务组件
  - 业务 hooks
  - 业务状态
  - 业务 API

```txt
features/order-book/
├── components/
├── hooks/
├── services/
├── store.ts
└── types.ts
```

### 3.3 UI 组件（components）

- 必须是纯 UI
- 只通过 props 传数据
- 不依赖任何业务状态

```txt
type PriceCellProps = {
  price: string
  highlight?: boolean
}
```

## 4. Hooks 编写规范

### 4.1 命名

- 必须以 use 开头
- 语义化，禁止 useData / useLogic

```typescript
useOrderBookData
useOrderBookSocket
```

### 4.2 职责单一

- 一个 hook 只做一件事
- ❌ 一个 hook 同时：
  - 请求 API
  - 处理 websocket
  - 操作 UI 状态

## 5. 状态管理规范

### 5.1 状态分类

| 类型    | 存放位置         |
| ----- | ------------ |
| UI 状态 | 组件内部         |
| 页面级   | Feature hook |
| 跨页面   | 全局 store     |

### 5.2 Zustand 示例（推荐）

```typescript
type OrderBookState = {
  bids: Level[]
  asks: Level[]
  setData: (data: OrderBookData) => void
}
```

- 禁止 store 中出现 JSX
- 禁止 store 直接请求 API

## 6. API / 数据请求规范

### 6.1 API 层必须隔离

```txt
features/order-book/services/orderBook.api.ts
```

```typescript
export function fetchOrderBook(symbol: string) {
  return request<OrderBookDTO>(`/api/orderbook?symbol=${symbol}`)
}
```

### 6.2 禁止行为

- ❌ 组件中 fetch
- ❌ hook 中拼 URL
- ❌ 直接使用后端 DTO 渲染 UI

## 7. 类型系统规则（TypeScript）

### 7.1 类型分层

| 类型         | 用途   |
| ---------- | ---- |
| DTO        | 后端返回 |
| VO / Model | 前端业务 |
| Props      | 组件接口 |

```typescript
// ❌ 禁止 DTO 直接传入组件
```

## 8. 业务逻辑规范

- 所有业务判断：
  - 必须在 hook / service
- JSX 中：
  - 只允许简单条件渲染

```typescript
// ❌ 禁止
{price > lastPrice * 1.1 ? '🔥' : '—'}
```

## 9. 性能与可维护性要求

- 使用 useMemo / useCallback 但不过度

- 列表渲染必须有稳定 key

- 大型计算：

- 必须脱离 render

## 10. Claude Code 行为约束（必须遵守）

Claude Code 必须：

### 1.在写代码前说明

- 修改了哪些文件
- 为什么这样拆分

### 2.新增 feature 时

- 先给目录结构

### 3.不确定时

- 优先遵守本架构，而不是“更简单的实现”

### 4.不得为了省代码而破坏分层

Claude Code 禁止：

- 自创架构
- 合并不相关职责
- 写“能跑但不可维护”的代码

## 11. 代码风格原则（总结）

可读性 > 简洁性 > 技巧

- 宁可多文件
- 宁可多类型
- 宁可多一层抽象

## 12. 最终原则（最高优先级）

长期可维护性是唯一正确答案

如果实现方式冲突：

1. 架构正确性
2. 类型安全
3. 性能
4. 代码量