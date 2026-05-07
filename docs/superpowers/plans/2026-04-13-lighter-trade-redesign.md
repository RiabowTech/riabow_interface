# Lighter 风格 /trade 页面改造 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

---

## 实施进度(2026-04-14 更新)

### ✅ 已完成(Task 1–8 + 10 像素对齐)

- **Task 1 模块脚手架 + 主题 tokens** — 完成
- **Task 2 TopNav** — 完成(Block 号改白、Connect Wallet bg `#1f1f24`/border `#2b2b30` 对齐 Lighter)
- **Task 3 SymbolBar + useMarketInfoAdapter** — 完成(单行布局,7 个 stats 12/400;移除 row2 + funding 边角)
- **Task 4 ChartPanel 外壳** — 完成(含 SymbolBar 32h header + chart 572h,chartCol 统一面板背景)
- **Task 5 OrderBookPanel + useOrderBookAdapter** — 完成,并扩展:
  - Tabs(gray-9 active bg + 2px blue-7 underline)
  - Subbar 3 模式按钮(all/asks/bids,20×20 + 12×12 SVG,点击切换订单显示)
  - BTC/USD 与 0.1/1/10/100/1,000 两个下拉
  - 双层深度条(total 外层淡 + size 内层深,total 宽度 × 1.6 留白)
  - Kebab 下拉 Tab/Stacked/Large
  - Trades tab(side-filter,行 20h,卖红 `#120915` / 买绿 `#071012`)
- **Task 6 OrderFormPanel(Market / Limit / Advanced)** — 完成,并扩展:
  - Tabs Market/Limit/Advanced(active gray-9 + blue-7 underline + Advanced 下拉 6 类型)
  - Buy/Sell toggle(精确色 `#159564`/`#e63348`,border `#19be7d`/`#ff4c61`)
  - PercentSlider(8h 轨道 + 17 刻度 + 6×20 thumb + % input)
  - 自定义 Checkbox(14×14 gray-9 border + gray-10 checked bg + 8×6 checkmark)
  - MarketOrderForm:Amount + Slider + Reduce Only + TP/SL(2×2 grid)+ Est. 行汇总
  - LimitOrderForm:Limit Price + Mid 链接 + Advanced 可折叠(Time in Force + Post Only + Good till Time/N/Unit)+ Maximum Order Value 汇总
  - AdvancedOrderForm 6 类子表单差异化:Stop Market / Stop Limit / TP Market / TP Limit / TWAP(Running Time + Slices)/ Scale(Start + End Price)
- **Task 7 BottomTabs** — 完成(tabs bg `#121218`,active `#2b2b30`,underline `#5e85ff`,th/td 12px)
- **Task 8 AccountsPanel** — 完成(无分隔线,section gap 12px,row gap 6px,label gray-3 / value gray-0)
- **Task 10 像素对齐 + K 线/深度图** — 完成:
  - Trade 页 4 区域固定像素:Chart 1165×608 / OrderBook 321×608 / Form 321×608 / BottomTabs 1490×392 / Accounts 321×392
  - Page 固定 width 1823,横向滚动提升到 body 层(视口 < 1823 时 body 横滚,视口不够高时纵向滚动)
  - `.App` 左侧栏通过 `body.lighter-active` 隐藏,不干扰 lighter 布局
  - **TVChart** 蜡烛图接入,Lighter 主题覆盖(`paneProperties.background` `#121218`,up `#00B26B` / down `#E64558`,隐藏 header_widget / timeframes_toolbar / control_bar 等)
  - **DepthChartx10000** 深度图并行挂载,TradingView / Original / Depth 三档切换通过 opacity + z-index 避免图表重载

### ✅ Task 9 接入真实 dex 数据到 adapters — 完成(部分)

- `useMarketInfoAdapter` — `selectChartToken` + `selectChartHeaderInfo` + `useApiTicker` 组合接入(mark/index/openInterest 来自 chart selector,24h 变化/24h 成交量/next funding 来自 API ticker,无数据时回退 mock)
- `useOrderBookAdapter` — `useApiOrderbook(chainId, symbol)` 映射到 `{price, size, total}[]` 累加 total,API 排序按 Lighter 惯例:asks 升序 / bids 降序,无数据回退 mock
- `useTradesAdapter` — `useApiTrades(chainId, symbol)` → `{time, size, price, side}[]`,时间 `timestamp` 兼容秒/毫秒/ISO,无数据回退 mock
- `usePositionsAdapter` — 已通过 `selectPositionsInfoData` 接入(之前版本)
- `useOpenOrdersAdapter` — 已通过 `selectOrdersInfoData` 接入(之前版本)
- `usePlaceOrderAdapter` — **仍为 stub**。真实提交需要耦合 `TradeBoxx10000` 的状态(`useTradeboxButtonStatex10000` 内部依赖 tradebox form state),跨模块同步状态属于较大重构,留待专门 PR。目前仅 `console.warn`。

> 未连钱包时,所有 adapter 走 mock 路径以保持 UI 完整。

### ⏳ 未做

- **Task 10(TVChart 主题 CSS 覆盖)** — 当前 chart 区为占位,未做 TVChart 深度主题 override
- **Task 11 响应式降级** — 未做(目前依赖 body 横/纵滚,未加断点变体)
- **Task 12 验收 + PR** — 未做

### 最近关键提交

| Commit | 内容 |
|---|---|
| `230d2348` | 统一 TopNav 路由 & LighterShell(earn/accounts/referrals)|
| `476c0842` | page 固定 1823,横向滚动提升 body |
| `066c94a8` | 锁定 main/bottom 行高防溢出 |
| `d54530fd` | 深度条 total × 1.6 留白 |
| `e528aed5` | OrderBook BTC/USD + tick group 下拉 |
| `7afc7557` | OrderBook 3 模式切换 + 倒序渲染 |
| `31ac39e5` | OrderBook tabs gray-9 + underline + kebab 图标 |
| `0a574a3f` | 自定义 14×14 Checkbox |
| `42820fbb` | MarketOrderForm 重构 + TP/SL 网格 |
| `3dfadbd3` | LimitOrderForm 重构 + Mid + Advanced 折叠 |
| `c34e1900` | OrderForm Advanced 下拉 6 类型 |
| `4173511c` | Buy/Sell toggle 精确色 |
| `4f5fec21` | Limit Advanced Time in Force / Good till Time |
| `b164e3a4` | 补 Maximum Order Value 行 |
| `37eba44c` | 6 种 Advanced 子表单差异化 |
| `2cd9d862` | BottomTabs gray-10 + blue-7 |
| `41cd691a` | AccountsPanel 无边框对齐 |
| `406e9ce0` | SymbolBar 单行化 |
| `2ad66222` | TopNav Connect Wallet 色校正 |

---

**Goal:** 把 `http://localhost:3012/trade` 改造成 Lighter (https://app.lighter.xyz/trade/BTC) 的像素级复刻版本,完全舍弃 AxBlade 品牌色/圆角风,复用现有 dex 数据层。

**Architecture:** 新建独立模块 `src/modules/lighter/`,内部包含页面 + 组件 + 适配层 + 主题 tokens。路由 `/trade` 切到新模块,原 dex trade (`Syntheticsx10000Page`) 保留不改。数据 hook 沿用现有 dex (`useMarketInfo / useOrderBook / usePositions / usePlaceOrder`),通过 adapters 层做字段映射。

**Tech Stack:** React 18, TypeScript, Vite, SCSS Modules, React Router v5, 现有 TVChart, Playwright MCP (视觉验证)

**分支:** `feat/lighter`
**参考 spec:** `docs/superpowers/specs/2026-04-13-lighter-trade-redesign-design.md`

---

## 文件清单

### 新建
```
src/modules/lighter/
├── pages/LighterTradePage.tsx
├── components/
│   ├── TopNav/TopNav.tsx + TopNav.module.scss
│   ├── SymbolBar/SymbolBar.tsx + SymbolBar.module.scss
│   ├── ChartPanel/ChartPanel.tsx + ChartPanel.module.scss
│   ├── OrderBookPanel/OrderBookPanel.tsx + OrderBookPanel.module.scss
│   ├── OrderFormPanel/OrderFormPanel.tsx + OrderFormPanel.module.scss
│   ├── OrderFormPanel/MarketOrderForm.tsx
│   ├── OrderFormPanel/LimitOrderForm.tsx
│   ├── OrderFormPanel/AdvancedOrderForm.tsx
│   ├── BottomTabs/BottomTabs.tsx + BottomTabs.module.scss
│   ├── BottomTabs/PositionsTab.tsx
│   ├── BottomTabs/AssetsTab.tsx
│   ├── BottomTabs/OpenOrdersTab.tsx
│   ├── BottomTabs/OrderHistoryTab.tsx
│   ├── BottomTabs/TradeHistoryTab.tsx
│   ├── BottomTabs/FundingHistoryTab.tsx
│   └── AccountsPanel/AccountsPanel.tsx + AccountsPanel.module.scss
├── adapters/
│   ├── useMarketInfoAdapter.ts
│   ├── useOrderBookAdapter.ts
│   ├── usePositionsAdapter.ts
│   ├── useOpenOrdersAdapter.ts
│   └── usePlaceOrderAdapter.ts
└── styles/
    ├── tokens.scss
    └── global.scss
```

### 修改
- `src/app/MainRoutes.tsx:121-130` — `/trade` 路由切换
- `src/app/App.tsx` — 若左侧 SideNav 在 /trade 条件下需隐藏,增加判断

---

## Task 1: 模块脚手架 + 主题 tokens

**Files:**
- Create: `src/modules/lighter/styles/tokens.scss`
- Create: `src/modules/lighter/styles/global.scss`
- Create: `src/modules/lighter/pages/LighterTradePage.tsx`
- Create: `src/modules/lighter/pages/LighterTradePage.module.scss`

- [x] **Step 1: 写 tokens.scss**

```scss
// src/modules/lighter/styles/tokens.scss
:root {
  --ltr-bg-root: #0B0B0B;
  --ltr-bg-panel: #111111;
  --ltr-bg-panel-2: #151515;
  --ltr-bg-hover: #1A1A1A;
  --ltr-border: #1F1F1F;
  --ltr-text-primary: #E6E6E6;
  --ltr-text-secondary: #8A8A8A;
  --ltr-text-muted: #5A5A5A;
  --ltr-up: #10B981;
  --ltr-down: #EF4444;
  --ltr-up-bg: rgba(16, 185, 129, 0.12);
  --ltr-down-bg: rgba(239, 68, 68, 0.12);
  --ltr-warn-bg: #3A1212;

  --ltr-row-h: 22px;
  --ltr-row-h-header: 20px;
  --ltr-font-body: 12px;
  --ltr-font-header: 11px;
  --ltr-font-title: 13px;
  --ltr-topnav-h: 48px;
  --ltr-symbolbar-h: 56px;
  --ltr-bottom-h: 260px;
}
```

- [x] **Step 2: 写 global.scss**

```scss
// src/modules/lighter/styles/global.scss
@import "./tokens.scss";

.lighter-root {
  background: var(--ltr-bg-root);
  color: var(--ltr-text-primary);
  font-family: Inter, system-ui, -apple-system, sans-serif;
  font-size: var(--ltr-font-body);
  line-height: 1.4;
  min-height: 100vh;

  *, *::before, *::after { box-sizing: border-box; }

  button { background: none; border: 0; color: inherit; cursor: pointer; padding: 0; font: inherit; }
  input { background: transparent; border: 0; color: inherit; font: inherit; outline: none; }
  table { border-collapse: collapse; width: 100%; }

  .ltr-mono { font-family: ui-monospace, Menlo, monospace; font-variant-numeric: tabular-nums; }
  .ltr-up { color: var(--ltr-up); }
  .ltr-down { color: var(--ltr-down); }
}
```

- [x] **Step 3: 写 LighterTradePage 空壳**

```tsx
// src/modules/lighter/pages/LighterTradePage.tsx
import "../styles/global.scss";
import styles from "./LighterTradePage.module.scss";

export default function LighterTradePage() {
  return (
    <div className={`lighter-root ${styles.page}`}>
      <div className={styles.topnav}>TopNav placeholder</div>
      <div className={styles.symbolbar}>SymbolBar placeholder</div>
      <div className={styles.main}>
        <div className={styles.chart}>Chart</div>
        <div className={styles.orderbook}>OrderBook</div>
        <div className={styles.orderform}>OrderForm</div>
      </div>
      <div className={styles.bottom}>
        <div className={styles.tabs}>BottomTabs</div>
        <div className={styles.accounts}>Accounts</div>
      </div>
    </div>
  );
}
```

- [x] **Step 4: 写 LighterTradePage.module.scss**

```scss
// src/modules/lighter/pages/LighterTradePage.module.scss
.page {
  display: grid;
  grid-template-rows: var(--ltr-topnav-h) var(--ltr-symbolbar-h) 1fr var(--ltr-bottom-h);
  height: 100vh;
}
.topnav { border-bottom: 1px solid var(--ltr-border); }
.symbolbar { border-bottom: 1px solid var(--ltr-border); }

.main {
  display: grid;
  grid-template-columns: 1fr 340px 320px;
  gap: 0;
  min-height: 0;
  border-bottom: 1px solid var(--ltr-border);
  > div { border-right: 1px solid var(--ltr-border); min-height: 0; overflow: hidden; }
  > div:last-child { border-right: 0; }
}

.bottom {
  display: grid;
  grid-template-columns: 1fr 320px;
  > div { border-right: 1px solid var(--ltr-border); overflow: hidden; }
  > div:last-child { border-right: 0; }
}
```

- [x] **Step 5: 切换路由**

修改 `src/app/MainRoutes.tsx:36` 附近添加 lazy import,修改 `:121-130` 范围 /trade 路由:

```tsx
// 新增 lazy import (加在现有 lazy 区块)
const LighterTradePage = lazyWithRetry(() => import("@/modules/lighter/pages/LighterTradePage"));

// 替换 /trade Route 内容
<Route exact path="/trade/:tradeType?">
  <X10000StateProvider>
    <SyntheticsStateContextProvider skipLocalReferralCode={false} pageType="x10000trade">
      <SuspenseWrapper>
        <LighterTradePage />
      </SuspenseWrapper>
    </SyntheticsStateContextProvider>
  </X10000StateProvider>
</Route>
```

Provider 保留以便后续 adapters 直接复用 context。

- [x] **Step 6: 验证路由渲染**

```bash
# 开发服务器应已在 3012 运行;若未运行则:
yarn start
```

用 Playwright 访问 `http://localhost:3012/trade`,确认看到 6 个占位文字块。

- [x] **Step 7: 隐藏左侧 SideNav (仅 /trade 路径)**

读 `src/app/App.tsx`,找到渲染 `SideNav` 的地方。若 SideNav 在所有路由下都渲染,用 `useLocation` 判断 `pathname.startsWith("/trade")` 时不渲染 (或让 LighterTradePage 占满视口,用 `position: fixed; inset: 0; z-index: 100` 覆盖)。

最简实现:在 `LighterTradePage.module.scss` 的 `.page` 上加:

```scss
.page {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: var(--ltr-bg-root);
}
```

- [x] **Step 8: 再次验证 + 提交**

Playwright 访问 `/trade`,确认左侧边栏被完全遮盖,页面纯黑 + 6 个占位。

```bash
git add src/modules/lighter src/app/MainRoutes.tsx
git commit -m "feat(lighter): 模块脚手架 + tokens + 路由切换"
```

---

## Task 2: TopNav

**Files:**
- Create: `src/modules/lighter/components/TopNav/TopNav.tsx`
- Create: `src/modules/lighter/components/TopNav/TopNav.module.scss`
- Modify: `src/modules/lighter/pages/LighterTradePage.tsx`

- [x] **Step 1: 写 TopNav.tsx**

```tsx
import { NavLink } from "react-router-dom";
import styles from "./TopNav.module.scss";

const NAV_ITEMS = [
  { to: "/trade", label: "Trade" },
  { to: "/earn", label: "Earn" },
  { to: "/referrals", label: "Referrals" },
  { to: "/leaderboard", label: "Leaderboard" },
  { to: "/portfolio", label: "Portfolio" },
  { to: "/points", label: "Points" },
  { to: "/keys", label: "API Keys" },
];

export function TopNav() {
  return (
    <nav className={styles.root}>
      <div className={styles.logo}>AxBlade</div>
      <ul className={styles.nav}>
        {NAV_ITEMS.map((item) => (
          <li key={item.to}>
            <NavLink to={item.to} className={styles.link} activeClassName={styles.active}>
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
      <div className={styles.right}>
        <span className={styles.block}>
          <span className={styles.dot} /> Block —
        </span>
        <button className={styles.iconBtn} aria-label="language">🌐</button>
        <button className={styles.iconBtn} aria-label="settings">⚙</button>
        <button className={styles.connect}>Connect Wallet</button>
      </div>
    </nav>
  );
}
```

- [x] **Step 2: 写 TopNav.module.scss**

```scss
.root {
  height: var(--ltr-topnav-h);
  display: flex;
  align-items: center;
  padding: 0 16px;
  gap: 24px;
  background: var(--ltr-bg-root);
}
.logo { font-weight: 700; font-size: 14px; letter-spacing: 0.5px; }
.nav { display: flex; list-style: none; gap: 20px; margin: 0; padding: 0; flex: 1; }
.link {
  color: var(--ltr-text-secondary);
  text-decoration: none;
  font-size: 13px;
  padding: 14px 0;
  display: inline-block;
  border-bottom: 2px solid transparent;
  &:hover { color: var(--ltr-text-primary); }
}
.active { color: var(--ltr-text-primary); border-bottom-color: var(--ltr-text-primary); }
.right { display: flex; align-items: center; gap: 8px; }
.block {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 12px; color: var(--ltr-text-primary);
  padding: 4px 8px;
  border: 1px solid var(--ltr-border);
}
.dot { width: 6px; height: 6px; background: var(--ltr-up); border-radius: 50%; }
.iconBtn { width: 28px; height: 28px; color: var(--ltr-text-secondary); }
.connect {
  padding: 6px 12px; background: transparent;
  border: 1px solid var(--ltr-border);
  color: var(--ltr-text-primary);
  font-size: 12px;
  &:hover { background: var(--ltr-bg-hover); }
}
```

- [x] **Step 3: 在 LighterTradePage 挂上 TopNav**

```tsx
import { TopNav } from "../components/TopNav/TopNav";
// 替换 <div className={styles.topnav}>TopNav placeholder</div>
<div className={styles.topnav}><TopNav /></div>
```

- [x] **Step 4: 视觉验证**

Playwright 截图 `/trade`,对比参考 Lighter 顶栏的高度、间距、active 下划线。修字号/间距至接近。

- [x] **Step 5: 提交**

```bash
git add src/modules/lighter
git commit -m "feat(lighter): TopNav 水平导航"
```

---

## Task 3: SymbolBar + useMarketInfoAdapter

**Files:**
- Create: `src/modules/lighter/adapters/useMarketInfoAdapter.ts`
- Create: `src/modules/lighter/components/SymbolBar/SymbolBar.tsx`
- Create: `src/modules/lighter/components/SymbolBar/SymbolBar.module.scss`

- [x] **Step 1: 定位 dex 现有行情 hook**

```bash
grep -rn "useMarketInfo\|useMarkets\|useChartTokenInfo" src/context src/features/stats src/shared | head
```

找到返回当前交易对 Mark Price / Index Price / 24h Change / 24h Vol / Open Interest / 1h Funding 的 hook。若没有完全对应的,用 `useSelector` 从 `SyntheticsStateContext` 取。

- [x] **Step 2: 写 adapter**

```ts
// src/modules/lighter/adapters/useMarketInfoAdapter.ts
import { useMemo } from "react";
// TODO: 替换为实际存在的 hook
// import { useChartTokenInfo } from "...";

export type LighterMarketInfo = {
  symbol: string;
  leverage: number;
  markPrice: number | null;
  indexPrice: number | null;
  change24hPct: number | null;
  volume24hUsd: number | null;
  openInterestUsd: number | null;
  funding1hPct: number | null;
  nextFundingTs: number | null;
};

export function useMarketInfoAdapter(): LighterMarketInfo {
  // 目前先返回占位,后续接入真实 hook
  return useMemo(() => ({
    symbol: "BTC",
    leverage: 50,
    markPrice: null,
    indexPrice: null,
    change24hPct: null,
    volume24hUsd: null,
    openInterestUsd: null,
    funding1hPct: null,
    nextFundingTs: null,
  }), []);
}
```

- [x] **Step 3: 写 SymbolBar.tsx**

```tsx
import { useMarketInfoAdapter } from "../../adapters/useMarketInfoAdapter";
import styles from "./SymbolBar.module.scss";

function fmt(n: number | null, d = 2, prefix = ""): string {
  if (n == null) return "-";
  return prefix + n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
}
function fmtPct(n: number | null): string {
  if (n == null) return "-";
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}
function Stat({ label, value, cls }: { label: string; value: string; cls?: string }) {
  return (
    <div className={styles.stat}>
      <div className={styles.label}>{label}</div>
      <div className={`${styles.value} ltr-mono ${cls ?? ""}`}>{value}</div>
    </div>
  );
}

export function SymbolBar() {
  const m = useMarketInfoAdapter();
  const changeCls = m.change24hPct == null ? "" : m.change24hPct >= 0 ? "ltr-up" : "ltr-down";

  return (
    <div className={styles.root}>
      <button className={styles.symbol}>
        <span className={styles.symName}>{m.symbol}</span>
        <span className={styles.lev}>{m.leverage}x</span>
        <span className={styles.caret}>▾</span>
      </button>
      <button className={styles.fav} aria-label="favorite">☆</button>
      <div className={styles.stats}>
        <Stat label="Mark Price" value={fmt(m.markPrice)} />
        <Stat label="Index Price" value={fmt(m.indexPrice)} />
        <Stat label="24h Change" value={fmtPct(m.change24hPct)} cls={changeCls} />
        <Stat label="24h Volume" value={fmt(m.volume24hUsd, 2, "$")} />
        <Stat label="Open Interest" value={fmt(m.openInterestUsd, 2, "$")} />
        <Stat label="1hr Funding" value={fmtPct(m.funding1hPct)} />
        <Stat label="Next Funding" value="-" />
      </div>
    </div>
  );
}
```

- [x] **Step 4: 写 SymbolBar.module.scss**

```scss
.root {
  height: var(--ltr-symbolbar-h);
  display: flex; align-items: center;
  padding: 0 12px; gap: 12px;
  background: var(--ltr-bg-root);
}
.symbol {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 6px 10px; border: 1px solid var(--ltr-border);
  font-size: 13px;
}
.symName { font-weight: 600; }
.lev { color: var(--ltr-text-secondary); font-size: 11px; padding: 1px 4px; border: 1px solid var(--ltr-border); }
.caret { color: var(--ltr-text-secondary); }
.fav { color: var(--ltr-text-secondary); font-size: 16px; width: 24px; }
.stats { display: flex; gap: 24px; margin-left: 8px; }
.stat { display: flex; flex-direction: column; gap: 2px; }
.label { color: var(--ltr-text-secondary); font-size: var(--ltr-font-header); }
.value { font-size: var(--ltr-font-title); }
```

- [x] **Step 5: 挂到页面**

替换 `<div className={styles.symbolbar}>SymbolBar placeholder</div>` 为 `<div className={styles.symbolbar}><SymbolBar /></div>`。

- [x] **Step 6: 视觉验证 + 提交**

Playwright 截图,对比 Lighter SymbolBar。提交:

```bash
git add src/modules/lighter
git commit -m "feat(lighter): SymbolBar + market info adapter"
```

---

## Task 4: ChartPanel 外壳

**Files:**
- Create: `src/modules/lighter/components/ChartPanel/ChartPanel.tsx`
- Create: `src/modules/lighter/components/ChartPanel/ChartPanel.module.scss`

- [x] **Step 1: 写 ChartPanel.tsx (静态 shell,图表区域先放 placeholder)**

```tsx
import { useState } from "react";
import styles from "./ChartPanel.module.scss";

type TopTab = "Price" | "Funding" | "Details";
type ChartMode = "TradingView" | "Original" | "Depth";

export function ChartPanel() {
  const [topTab, setTopTab] = useState<TopTab>("Price");
  const [mode, setMode] = useState<ChartMode>("TradingView");
  const [tf, setTf] = useState("5m");
  const tabs: TopTab[] = ["Price", "Funding", "Details"];
  const modes: ChartMode[] = ["TradingView", "Original", "Depth"];
  const tfs = ["5m", "15m", "1h", "4h"];

  return (
    <div className={styles.root}>
      <div className={styles.topTabs}>
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTopTab(t)}
            className={topTab === t ? styles.tabActive : styles.tab}
          >{t}</button>
        ))}
        <div className={styles.modes}>
          {modes.map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={mode === m ? styles.modeActive : styles.mode}
            >{m}</button>
          ))}
        </div>
      </div>
      <div className={styles.toolbar}>
        <div className={styles.tfs}>
          {tfs.map((t) => (
            <button
              key={t}
              onClick={() => setTf(t)}
              className={tf === t ? styles.tfActive : styles.tf}
            >{t}</button>
          ))}
          <button className={styles.tf}>More ▾</button>
        </div>
        <div className={styles.toolsRight}>
          <button className={styles.tool}>Chart Elements</button>
        </div>
      </div>
      <div className={styles.chart}>
        {/* TODO Phase 后接入 TVChart */}
        <div className={styles.chartPlaceholder}>Chart</div>
      </div>
    </div>
  );
}
```

- [x] **Step 2: 写 ChartPanel.module.scss**

```scss
.root { display: flex; flex-direction: column; height: 100%; background: var(--ltr-bg-panel); }
.topTabs {
  display: flex; align-items: center; gap: 16px;
  padding: 0 12px; height: 32px;
  border-bottom: 1px solid var(--ltr-border);
}
.tab, .tabActive {
  font-size: 12px; padding: 8px 0;
  color: var(--ltr-text-secondary);
  border-bottom: 2px solid transparent;
}
.tabActive { color: var(--ltr-text-primary); border-bottom-color: var(--ltr-text-primary); }
.modes { margin-left: auto; display: flex; gap: 8px; }
.mode, .modeActive {
  font-size: 11px; color: var(--ltr-text-secondary); padding: 4px 6px;
}
.modeActive { color: var(--ltr-text-primary); background: var(--ltr-bg-hover); }

.toolbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 12px; height: 28px;
  border-bottom: 1px solid var(--ltr-border);
}
.tfs { display: flex; gap: 4px; }
.tf, .tfActive {
  font-size: 11px; padding: 3px 8px; color: var(--ltr-text-secondary);
}
.tfActive { color: var(--ltr-text-primary); background: var(--ltr-bg-hover); }

.tool { font-size: 11px; color: var(--ltr-text-secondary); padding: 3px 6px; }

.chart { flex: 1; position: relative; min-height: 0; }
.chartPlaceholder {
  display: flex; align-items: center; justify-content: center;
  height: 100%; color: var(--ltr-text-muted);
}
```

- [x] **Step 3: 挂到页面 + 视觉验证 + 提交**

```bash
git add src/modules/lighter
git commit -m "feat(lighter): ChartPanel 外壳 (tabs + toolbar)"
```

> **TVChart 接入留到 Task 10 像素对齐阶段一起处理**,本 Task 仅完成 shell。

---

## Task 5: OrderBookPanel + useOrderBookAdapter

**Files:**
- Create: `src/modules/lighter/adapters/useOrderBookAdapter.ts`
- Create: `src/modules/lighter/components/OrderBookPanel/OrderBookPanel.tsx`
- Create: `src/modules/lighter/components/OrderBookPanel/OrderBookPanel.module.scss`

- [x] **Step 1: 定位 dex 现有订单簿 hook / selector**

```bash
grep -rn "orderbook\|OrderBook\|depth" src/context src/modules/cex src/modules/dex --include="*.ts" --include="*.tsx" | grep -i hook | head
```

- [x] **Step 2: 写 adapter (暂返回 mock 数据,结构贴合 UI 需求)**

```ts
// src/modules/lighter/adapters/useOrderBookAdapter.ts
export type OrderBookLevel = { price: number; size: number; total: number };
export type OrderBookData = {
  asks: OrderBookLevel[]; // 由低到高,组件渲染时自行 reverse
  bids: OrderBookLevel[]; // 由高到低
  spread: number;
  spreadPct: number;
  tickSize: number;
};

export function useOrderBookAdapter(): OrderBookData {
  // TODO: 接入 dex useOrderBook selector
  return {
    asks: [],
    bids: [],
    spread: 0,
    spreadPct: 0,
    tickSize: 0.1,
  };
}
```

- [x] **Step 3: 写 OrderBookPanel.tsx**

```tsx
import { useState } from "react";
import { useOrderBookAdapter, OrderBookLevel } from "../../adapters/useOrderBookAdapter";
import styles from "./OrderBookPanel.module.scss";

type Tab = "OrderBook" | "Trades";

function Row({ level, side, max }: { level: OrderBookLevel; side: "ask" | "bid"; max: number }) {
  const pct = max > 0 ? (level.total / max) * 100 : 0;
  const priceCls = side === "ask" ? "ltr-down" : "ltr-up";
  return (
    <tr className={styles.row}>
      <td className={`${styles.price} ${priceCls} ltr-mono`}>{level.price.toLocaleString()}</td>
      <td className={`${styles.size} ltr-mono`}>{level.size.toFixed(5)}</td>
      <td className={`${styles.total} ltr-mono`}>{level.total.toFixed(5)}</td>
      <div
        className={side === "ask" ? styles.depthAsk : styles.depthBid}
        style={{ width: `${pct}%` }}
      />
    </tr>
  );
}

export function OrderBookPanel() {
  const [tab, setTab] = useState<Tab>("OrderBook");
  const ob = useOrderBookAdapter();
  const maxAskTotal = Math.max(0, ...ob.asks.map((l) => l.total));
  const maxBidTotal = Math.max(0, ...ob.bids.map((l) => l.total));

  return (
    <div className={styles.root}>
      <div className={styles.tabs}>
        <button onClick={() => setTab("OrderBook")} className={tab === "OrderBook" ? styles.tabActive : styles.tab}>Order Book</button>
        <button onClick={() => setTab("Trades")} className={tab === "Trades" ? styles.tabActive : styles.tab}>Trades</button>
      </div>
      {tab === "OrderBook" && (
        <>
          <div className={styles.header}>
            <div>Price</div>
            <div>Size BTC</div>
            <div>Total</div>
          </div>
          <div className={styles.asks}>
            <table>
              <tbody>
                {[...ob.asks].reverse().map((l, i) => (
                  <Row key={`a${i}`} level={l} side="ask" max={maxAskTotal} />
                ))}
              </tbody>
            </table>
          </div>
          <div className={styles.spreadRow}>
            <span className="ltr-mono">{ob.tickSize}</span>
            <span className={styles.spreadLabel}>Spread</span>
            <span className="ltr-mono">{ob.spreadPct.toFixed(3)}%</span>
          </div>
          <div className={styles.bids}>
            <table>
              <tbody>
                {ob.bids.map((l, i) => (
                  <Row key={`b${i}`} level={l} side="bid" max={maxBidTotal} />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {tab === "Trades" && <div className={styles.empty}>No trades</div>}
    </div>
  );
}
```

- [x] **Step 4: 写 OrderBookPanel.module.scss**

```scss
.root { display: flex; flex-direction: column; height: 100%; background: var(--ltr-bg-panel); overflow: hidden; }
.tabs { display: flex; border-bottom: 1px solid var(--ltr-border); height: 32px; align-items: center; padding: 0 12px; gap: 16px; }
.tab, .tabActive { font-size: 12px; color: var(--ltr-text-secondary); padding: 8px 0; border-bottom: 2px solid transparent; }
.tabActive { color: var(--ltr-text-primary); border-bottom-color: var(--ltr-text-primary); }

.header {
  display: grid; grid-template-columns: 1fr 1fr 1fr;
  font-size: var(--ltr-font-header); color: var(--ltr-text-secondary);
  padding: 4px 12px; border-bottom: 1px solid var(--ltr-border);
  text-align: right;
  > div:first-child { text-align: left; }
}
.asks, .bids { flex: 1; overflow: auto; min-height: 0; }
.asks { display: flex; flex-direction: column-reverse; }
.row { height: var(--ltr-row-h); position: relative; }
.price, .size, .total { padding: 0 12px; font-size: var(--ltr-font-body); text-align: right; }
.price { text-align: left; width: 33%; }
.size { width: 33%; }
.total { width: 33%; }
.depthAsk, .depthBid {
  position: absolute; top: 0; right: 0; height: 100%; z-index: 0; pointer-events: none;
}
.depthAsk { background: var(--ltr-down-bg); }
.depthBid { background: var(--ltr-up-bg); }

.spreadRow {
  display: grid; grid-template-columns: 1fr 1fr 1fr;
  padding: 4px 12px;
  font-size: var(--ltr-font-body);
  background: var(--ltr-bg-panel-2);
  border-top: 1px solid var(--ltr-border);
  border-bottom: 1px solid var(--ltr-border);
}
.spreadLabel { color: var(--ltr-text-secondary); text-align: center; }
.spreadRow > span:last-child { text-align: right; }
.empty { padding: 40px 12px; color: var(--ltr-text-muted); text-align: center; }
```

- [x] **Step 5: 挂到页面 + 提交**

```bash
git add src/modules/lighter
git commit -m "feat(lighter): OrderBookPanel 壳 + depth rows"
```

---

## Task 6: OrderFormPanel (Market / Limit / Advanced)

**Files:**
- Create: `src/modules/lighter/components/OrderFormPanel/OrderFormPanel.tsx`
- Create: `src/modules/lighter/components/OrderFormPanel/OrderFormPanel.module.scss`
- Create: `src/modules/lighter/components/OrderFormPanel/MarketOrderForm.tsx`
- Create: `src/modules/lighter/components/OrderFormPanel/LimitOrderForm.tsx`
- Create: `src/modules/lighter/components/OrderFormPanel/AdvancedOrderForm.tsx`
- Create: `src/modules/lighter/adapters/usePlaceOrderAdapter.ts`

- [x] **Step 1: 写 usePlaceOrderAdapter (先空实现 + 类型)**

```ts
// src/modules/lighter/adapters/usePlaceOrderAdapter.ts
export type OrderSide = "buy" | "sell";
export type OrderType = "market" | "limit";

export type PlaceOrderParams = {
  side: OrderSide;
  type: OrderType;
  amount: number;
  price?: number;
  reduceOnly?: boolean;
  tpPrice?: number;
  slPrice?: number;
};

export function usePlaceOrderAdapter() {
  // TODO: 接入 dex usePlaceOrder
  return {
    placeOrder: async (_p: PlaceOrderParams) => {
      console.warn("[lighter] placeOrder stub", _p);
    },
    submitting: false,
  };
}
```

- [x] **Step 2: 写共享 shell OrderFormPanel.tsx**

```tsx
import { useState } from "react";
import { MarketOrderForm } from "./MarketOrderForm";
import { LimitOrderForm } from "./LimitOrderForm";
import { AdvancedOrderForm } from "./AdvancedOrderForm";
import styles from "./OrderFormPanel.module.scss";

type Mode = "Market" | "Limit" | "Advanced";

export function OrderFormPanel() {
  const [mode, setMode] = useState<Mode>("Market");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const modes: Mode[] = ["Market", "Limit", "Advanced"];

  return (
    <div className={styles.root}>
      <div className={styles.modes}>
        {modes.map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={mode === m ? styles.modeActive : styles.mode}
          >{m}</button>
        ))}
      </div>
      <div className={styles.sides}>
        <button
          onClick={() => setSide("buy")}
          className={`${styles.sideBtn} ${side === "buy" ? styles.buyActive : ""}`}
        >Buy / Long</button>
        <button
          onClick={() => setSide("sell")}
          className={`${styles.sideBtn} ${side === "sell" ? styles.sellActive : ""}`}
        >Sell / Short</button>
      </div>
      <div className={styles.body}>
        {mode === "Market" && <MarketOrderForm side={side} />}
        {mode === "Limit" && <LimitOrderForm side={side} />}
        {mode === "Advanced" && <AdvancedOrderForm side={side} />}
      </div>
    </div>
  );
}
```

- [x] **Step 3: 写 OrderFormPanel.module.scss**

```scss
.root { display: flex; flex-direction: column; height: 100%; background: var(--ltr-bg-panel); }

.modes { display: flex; border-bottom: 1px solid var(--ltr-border); padding: 0 12px; gap: 16px; height: 32px; align-items: center; }
.mode, .modeActive { font-size: 12px; color: var(--ltr-text-secondary); padding: 8px 0; border-bottom: 2px solid transparent; }
.modeActive { color: var(--ltr-text-primary); border-bottom-color: var(--ltr-text-primary); }

.sides { display: grid; grid-template-columns: 1fr 1fr; padding: 8px 12px; gap: 6px; }
.sideBtn {
  padding: 8px; font-size: 12px; color: var(--ltr-text-secondary);
  border: 1px solid var(--ltr-border); background: transparent;
}
.buyActive { background: var(--ltr-up); color: #fff; border-color: var(--ltr-up); }
.sellActive { background: var(--ltr-down); color: #fff; border-color: var(--ltr-down); }

.body { flex: 1; overflow: auto; padding: 0 12px 12px; }
```

- [x] **Step 4: 写共享字段组件 (放 MarketOrderForm.tsx 内)**

```tsx
// src/modules/lighter/components/OrderFormPanel/MarketOrderForm.tsx
import { useState } from "react";
import { usePlaceOrderAdapter } from "../../adapters/usePlaceOrderAdapter";

type Props = { side: "buy" | "sell" };

export function MarketOrderForm({ side }: Props) {
  const [amount, setAmount] = useState("");
  const [pct, setPct] = useState(0);
  const [reduceOnly, setReduceOnly] = useState(false);
  const [tpsl, setTpsl] = useState(false);
  const { placeOrder, submitting } = usePlaceOrderAdapter();

  const submit = () => placeOrder({
    side, type: "market", amount: Number(amount) || 0, reduceOnly,
  });

  return (
    <div>
      <Row label="Available to Trade" value="-" />
      <Row label="Position" value="-" />
      <div style={{ marginTop: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", color: "var(--ltr-text-secondary)", fontSize: 11, marginBottom: 4 }}>
          <span>Amount</span>
          <span>BTC ▾</span>
        </div>
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00000"
          style={{ width: "100%", border: "1px solid var(--ltr-border)", padding: "6px 8px", fontSize: 12, textAlign: "right", fontVariantNumeric: "tabular-nums" }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
          <input type="range" min={0} max={100} value={pct} onChange={(e) => setPct(Number(e.target.value))} style={{ flex: 1 }} />
          <span style={{ width: 32, textAlign: "right", color: "var(--ltr-text-secondary)", fontSize: 11 }}>{pct}%</span>
        </div>
      </div>
      <label style={{ display: "flex", gap: 6, marginTop: 10, fontSize: 12 }}>
        <input type="checkbox" checked={reduceOnly} onChange={(e) => setReduceOnly(e.target.checked)} /> Reduce Only
      </label>
      <label style={{ display: "flex", gap: 6, marginTop: 6, fontSize: 12 }}>
        <input type="checkbox" checked={tpsl} onChange={(e) => setTpsl(e.target.checked)} /> Take Profit / Stop Loss
      </label>
      <Row label="Order Size" value="-" />
      <Row label="Order Value" value="-" />
      <Row label="Est. Liq. Price" value="-" />
      <Row label="Position Margin" value="$0.00" />
      <Row label="Est. Price" value="-" />
      <Row label="Slippage" value="Est: 0.00% | Max: 1% ✎" />
      <Row label="Fees" value="Taker: 0% | Maker: 0%" />
      <button
        onClick={submit}
        disabled={submitting}
        style={{
          width: "100%", marginTop: 12, padding: "10px 0", fontSize: 13,
          background: side === "buy" ? "var(--ltr-up)" : "var(--ltr-down)",
          color: "#fff", fontWeight: 600,
        }}
      >
        {side === "buy" ? "Buy / Long" : "Sell / Short"}
      </button>
    </div>
  );
}

export function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderTop: "1px solid var(--ltr-border)", fontSize: 12 }}>
      <span style={{ color: "var(--ltr-text-secondary)" }}>{label}</span>
      <span className="ltr-mono">{value}</span>
    </div>
  );
}
```

- [x] **Step 5: 写 LimitOrderForm.tsx**

```tsx
import { useState } from "react";
import { Row } from "./MarketOrderForm";
import { usePlaceOrderAdapter } from "../../adapters/usePlaceOrderAdapter";

type Props = { side: "buy" | "sell" };

export function LimitOrderForm({ side }: Props) {
  const [price, setPrice] = useState("");
  const [amount, setAmount] = useState("");
  const [postOnly, setPostOnly] = useState(false);
  const { placeOrder, submitting } = usePlaceOrderAdapter();

  return (
    <div>
      <Row label="Available to Trade" value="-" />
      <div style={{ marginTop: 8 }}>
        <div style={{ color: "var(--ltr-text-secondary)", fontSize: 11, marginBottom: 4 }}>Price</div>
        <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" style={{ width: "100%", border: "1px solid var(--ltr-border)", padding: "6px 8px", fontSize: 12, textAlign: "right" }} />
      </div>
      <div style={{ marginTop: 8 }}>
        <div style={{ color: "var(--ltr-text-secondary)", fontSize: 11, marginBottom: 4 }}>Amount (BTC)</div>
        <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00000" style={{ width: "100%", border: "1px solid var(--ltr-border)", padding: "6px 8px", fontSize: 12, textAlign: "right" }} />
      </div>
      <label style={{ display: "flex", gap: 6, marginTop: 10, fontSize: 12 }}>
        <input type="checkbox" checked={postOnly} onChange={(e) => setPostOnly(e.target.checked)} /> Post Only
      </label>
      <Row label="Order Value" value="-" />
      <Row label="Est. Liq. Price" value="-" />
      <Row label="Fees" value="Maker: 0%" />
      <button
        onClick={() => placeOrder({ side, type: "limit", amount: Number(amount) || 0, price: Number(price) || undefined })}
        disabled={submitting}
        style={{
          width: "100%", marginTop: 12, padding: "10px 0", fontSize: 13,
          background: side === "buy" ? "var(--ltr-up)" : "var(--ltr-down)",
          color: "#fff", fontWeight: 600,
        }}
      >
        {side === "buy" ? "Buy / Long" : "Sell / Short"}
      </button>
    </div>
  );
}
```

- [x] **Step 6: 写 AdvancedOrderForm.tsx (带 Leverage 滑块 + TIF)**

```tsx
import { useState } from "react";
import { Row } from "./MarketOrderForm";

type Props = { side: "buy" | "sell" };

export function AdvancedOrderForm({ side }: Props) {
  const [leverage, setLeverage] = useState(10);
  const [tif, setTif] = useState<"GTC" | "IOC" | "FOK">("GTC");
  const tifs: Array<"GTC" | "IOC" | "FOK"> = ["GTC", "IOC", "FOK"];

  return (
    <div>
      <div style={{ marginTop: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", color: "var(--ltr-text-secondary)", fontSize: 11, marginBottom: 4 }}>
          <span>Leverage</span><span>{leverage}x</span>
        </div>
        <input type="range" min={1} max={50} value={leverage} onChange={(e) => setLeverage(Number(e.target.value))} style={{ width: "100%" }} />
      </div>
      <div style={{ marginTop: 10 }}>
        <div style={{ color: "var(--ltr-text-secondary)", fontSize: 11, marginBottom: 4 }}>Time in Force</div>
        <div style={{ display: "flex", gap: 4 }}>
          {tifs.map((t) => (
            <button
              key={t}
              onClick={() => setTif(t)}
              style={{
                padding: "4px 10px", fontSize: 11,
                border: "1px solid var(--ltr-border)",
                background: tif === t ? "var(--ltr-bg-hover)" : "transparent",
                color: tif === t ? "var(--ltr-text-primary)" : "var(--ltr-text-secondary)",
              }}
            >{t}</button>
          ))}
        </div>
      </div>
      <Row label="Est. Liq. Price" value="-" />
      <Row label="Margin Mode" value="Cross" />
      <button
        style={{
          width: "100%", marginTop: 12, padding: "10px 0", fontSize: 13,
          background: side === "buy" ? "var(--ltr-up)" : "var(--ltr-down)",
          color: "#fff", fontWeight: 600,
        }}
      >
        {side === "buy" ? "Buy / Long" : "Sell / Short"}
      </button>
    </div>
  );
}
```

- [x] **Step 7: 挂到页面 + 视觉验证 + 提交**

```bash
git add src/modules/lighter
git commit -m "feat(lighter): OrderFormPanel (Market/Limit/Advanced)"
```

---

## Task 7: BottomTabs

**Files:**
- Create: `src/modules/lighter/components/BottomTabs/BottomTabs.tsx`
- Create: `src/modules/lighter/components/BottomTabs/BottomTabs.module.scss`
- Create: `src/modules/lighter/components/BottomTabs/PositionsTab.tsx`
- Create: `src/modules/lighter/components/BottomTabs/AssetsTab.tsx`
- Create: `src/modules/lighter/components/BottomTabs/OpenOrdersTab.tsx`
- Create: `src/modules/lighter/components/BottomTabs/OrderHistoryTab.tsx`
- Create: `src/modules/lighter/components/BottomTabs/TradeHistoryTab.tsx`
- Create: `src/modules/lighter/components/BottomTabs/FundingHistoryTab.tsx`
- Create: `src/modules/lighter/adapters/usePositionsAdapter.ts`
- Create: `src/modules/lighter/adapters/useOpenOrdersAdapter.ts`

- [x] **Step 1: 写 adapters (stub,返回空数组)**

```ts
// src/modules/lighter/adapters/usePositionsAdapter.ts
export type LighterPosition = {
  market: string; side: "long" | "short"; size: number; entryPrice: number;
  markPrice: number; liqPrice: number; unrealizedPnl: number; margin: number;
};
export function usePositionsAdapter(): LighterPosition[] { return []; }
```

```ts
// src/modules/lighter/adapters/useOpenOrdersAdapter.ts
export type LighterOpenOrder = {
  id: string; market: string; side: "buy" | "sell"; type: "market" | "limit";
  price: number; size: number; filled: number; status: string; createdAt: number;
};
export function useOpenOrdersAdapter(): LighterOpenOrder[] { return []; }
```

- [x] **Step 2: 写 BottomTabs.tsx**

```tsx
import { useState } from "react";
import { PositionsTab } from "./PositionsTab";
import { AssetsTab } from "./AssetsTab";
import { OpenOrdersTab } from "./OpenOrdersTab";
import { OrderHistoryTab } from "./OrderHistoryTab";
import { TradeHistoryTab } from "./TradeHistoryTab";
import { FundingHistoryTab } from "./FundingHistoryTab";
import styles from "./BottomTabs.module.scss";

type Tab = "Positions" | "Assets" | "Open Orders" | "Order History" | "Trade History" | "Funding History";

export function BottomTabs() {
  const [tab, setTab] = useState<Tab>("Positions");
  const tabs: Tab[] = ["Positions", "Assets", "Open Orders", "Order History", "Trade History", "Funding History"];
  return (
    <div className={styles.root}>
      <div className={styles.tabs}>
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={tab === t ? styles.tabActive : styles.tab}
          >{t}</button>
        ))}
      </div>
      <div className={styles.body}>
        {tab === "Positions" && <PositionsTab />}
        {tab === "Assets" && <AssetsTab />}
        {tab === "Open Orders" && <OpenOrdersTab />}
        {tab === "Order History" && <OrderHistoryTab />}
        {tab === "Trade History" && <TradeHistoryTab />}
        {tab === "Funding History" && <FundingHistoryTab />}
      </div>
    </div>
  );
}
```

- [x] **Step 3: 写 BottomTabs.module.scss**

```scss
.root { display: flex; flex-direction: column; height: 100%; background: var(--ltr-bg-panel); }
.tabs { display: flex; padding: 0 12px; gap: 20px; height: 32px; align-items: center; border-bottom: 1px solid var(--ltr-border); }
.tab, .tabActive { font-size: 12px; color: var(--ltr-text-secondary); padding: 8px 0; border-bottom: 2px solid transparent; }
.tabActive { color: var(--ltr-text-primary); border-bottom-color: var(--ltr-text-primary); }
.body { flex: 1; overflow: auto; }

.empty { padding: 20px 12px; color: var(--ltr-text-muted); font-size: 12px; }
.table { width: 100%; font-size: 12px; }
.th { text-align: left; color: var(--ltr-text-secondary); font-size: 11px; font-weight: normal; padding: 6px 12px; border-bottom: 1px solid var(--ltr-border); }
.td { padding: 6px 12px; height: var(--ltr-row-h); }
```

- [x] **Step 4: 写 PositionsTab.tsx**

```tsx
import { usePositionsAdapter } from "../../adapters/usePositionsAdapter";
import styles from "./BottomTabs.module.scss";

export function PositionsTab() {
  const positions = usePositionsAdapter();
  if (positions.length === 0) return <div className={styles.empty}>Trading is not available from your current location.</div>;
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th className={styles.th}>Market</th>
          <th className={styles.th}>Side</th>
          <th className={styles.th}>Size</th>
          <th className={styles.th}>Entry</th>
          <th className={styles.th}>Mark</th>
          <th className={styles.th}>Liq.</th>
          <th className={styles.th}>Unrealized PnL</th>
          <th className={styles.th}>Margin</th>
        </tr>
      </thead>
      <tbody>
        {positions.map((p, i) => (
          <tr key={i}>
            <td className={styles.td}>{p.market}</td>
            <td className={`${styles.td} ${p.side === "long" ? "ltr-up" : "ltr-down"}`}>{p.side}</td>
            <td className={`${styles.td} ltr-mono`}>{p.size}</td>
            <td className={`${styles.td} ltr-mono`}>{p.entryPrice}</td>
            <td className={`${styles.td} ltr-mono`}>{p.markPrice}</td>
            <td className={`${styles.td} ltr-mono`}>{p.liqPrice}</td>
            <td className={`${styles.td} ltr-mono ${p.unrealizedPnl >= 0 ? "ltr-up" : "ltr-down"}`}>{p.unrealizedPnl}</td>
            <td className={`${styles.td} ltr-mono`}>{p.margin}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [x] **Step 5: 写 OpenOrdersTab.tsx**

```tsx
import { useOpenOrdersAdapter } from "../../adapters/useOpenOrdersAdapter";
import styles from "./BottomTabs.module.scss";

export function OpenOrdersTab() {
  const orders = useOpenOrdersAdapter();
  if (orders.length === 0) return <div className={styles.empty}>No open orders.</div>;
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th className={styles.th}>Market</th>
          <th className={styles.th}>Type</th>
          <th className={styles.th}>Side</th>
          <th className={styles.th}>Price</th>
          <th className={styles.th}>Size</th>
          <th className={styles.th}>Filled</th>
          <th className={styles.th}>Status</th>
          <th className={styles.th}></th>
        </tr>
      </thead>
      <tbody>
        {orders.map((o) => (
          <tr key={o.id}>
            <td className={styles.td}>{o.market}</td>
            <td className={styles.td}>{o.type}</td>
            <td className={`${styles.td} ${o.side === "buy" ? "ltr-up" : "ltr-down"}`}>{o.side}</td>
            <td className={`${styles.td} ltr-mono`}>{o.price}</td>
            <td className={`${styles.td} ltr-mono`}>{o.size}</td>
            <td className={`${styles.td} ltr-mono`}>{o.filled}</td>
            <td className={styles.td}>{o.status}</td>
            <td className={styles.td}><button style={{ color: "var(--ltr-down)" }}>Cancel</button></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [x] **Step 6: 写 AssetsTab / OrderHistoryTab / TradeHistoryTab / FundingHistoryTab (四个空壳)**

每个文件内容 (调整 colheaders 即可,其余结构一致):

```tsx
// AssetsTab.tsx
import styles from "./BottomTabs.module.scss";
export function AssetsTab() {
  return (
    <table className={styles.table}>
      <thead><tr>
        <th className={styles.th}>Asset</th><th className={styles.th}>Balance</th>
        <th className={styles.th}>Available</th><th className={styles.th}>USD Value</th>
      </tr></thead>
      <tbody></tbody>
    </table>
  );
}
```

```tsx
// OrderHistoryTab.tsx
import styles from "./BottomTabs.module.scss";
export function OrderHistoryTab() {
  return (
    <table className={styles.table}>
      <thead><tr>
        <th className={styles.th}>Time</th><th className={styles.th}>Market</th>
        <th className={styles.th}>Type</th><th className={styles.th}>Side</th>
        <th className={styles.th}>Price</th><th className={styles.th}>Size</th>
        <th className={styles.th}>Filled</th><th className={styles.th}>Status</th>
      </tr></thead>
      <tbody></tbody>
    </table>
  );
}
```

```tsx
// TradeHistoryTab.tsx
import styles from "./BottomTabs.module.scss";
export function TradeHistoryTab() {
  return (
    <table className={styles.table}>
      <thead><tr>
        <th className={styles.th}>Time</th><th className={styles.th}>Market</th>
        <th className={styles.th}>Side</th><th className={styles.th}>Price</th>
        <th className={styles.th}>Size</th><th className={styles.th}>Fee</th>
        <th className={styles.th}>PnL</th>
      </tr></thead>
      <tbody></tbody>
    </table>
  );
}
```

```tsx
// FundingHistoryTab.tsx
import styles from "./BottomTabs.module.scss";
export function FundingHistoryTab() {
  return (
    <table className={styles.table}>
      <thead><tr>
        <th className={styles.th}>Time</th><th className={styles.th}>Market</th>
        <th className={styles.th}>Rate</th><th className={styles.th}>Payment</th>
      </tr></thead>
      <tbody></tbody>
    </table>
  );
}
```

- [x] **Step 7: 挂到页面 + 视觉验证 + 提交**

```bash
git add src/modules/lighter
git commit -m "feat(lighter): BottomTabs 6 标签"
```

---

## Task 8: AccountsPanel

**Files:**
- Create: `src/modules/lighter/components/AccountsPanel/AccountsPanel.tsx`
- Create: `src/modules/lighter/components/AccountsPanel/AccountsPanel.module.scss`

- [x] **Step 1: 写 AccountsPanel.tsx**

```tsx
import styles from "./AccountsPanel.module.scss";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.row}>
      <span className={styles.label}>{label}</span>
      <span className={`${styles.value} ltr-mono`}>{value}</span>
    </div>
  );
}

export function AccountsPanel() {
  return (
    <div className={styles.root}>
      <div className={styles.section}>
        <div className={styles.head}>Accounts</div>
        <Row label="Perpetuals Equity" value="-" />
        <Row label="Spot Equity" value="-" />
      </div>
      <div className={styles.section}>
        <div className={styles.head}>Perpetuals Overview</div>
        <Row label="Unrealized PnL" value="-" />
        <Row label="Cross Leverage" value="-" />
        <Row label="Cross Margin Usage" value="-" />
        <Row label="Maintenance Margin" value="-" />
        <Row label="Cross Margin Ratio" value="-" />
        <Row label="Free Collateral" value="-" />
      </div>
    </div>
  );
}
```

- [x] **Step 2: 写 AccountsPanel.module.scss**

```scss
.root { height: 100%; overflow: auto; background: var(--ltr-bg-panel); padding: 8px 12px; }
.section { margin-bottom: 12px; }
.head { font-size: 12px; color: var(--ltr-text-primary); padding: 6px 0; border-bottom: 1px solid var(--ltr-border); margin-bottom: 4px; }
.row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 12px; }
.label { color: var(--ltr-text-secondary); }
.value { color: var(--ltr-text-primary); }
```

- [x] **Step 3: 挂到页面 + 提交**

```bash
git add src/modules/lighter
git commit -m "feat(lighter): AccountsPanel"
```

---

## Task 9: 接入真实 dex 数据到 adapters

**Files:**
- Modify: `src/modules/lighter/adapters/useMarketInfoAdapter.ts`
- Modify: `src/modules/lighter/adapters/useOrderBookAdapter.ts`
- Modify: `src/modules/lighter/adapters/usePositionsAdapter.ts`
- Modify: `src/modules/lighter/adapters/useOpenOrdersAdapter.ts`
- Modify: `src/modules/lighter/adapters/usePlaceOrderAdapter.ts`

- [x] **Step 1: 定位现有 hook 真实名**

```bash
grep -rn "export function use" src/modules/cex/components/TradeBoxx10000/hooks src/context/SyntheticsStateContext/selectors --include="*.ts" --include="*.tsx" | head -40
grep -rn "useChartTokenInfo\|getMarketInfo\|useMarketsInfo" src --include="*.ts" --include="*.tsx" | head -20
```

记录找到的 hook/selector 名称。

- [x] **Step 2: 写 useMarketInfoAdapter 实现**

替换 stub,从 `SyntheticsStateContext` 取当前交易对信息:

```ts
import { useMemo } from "react";
import { useSelector } from "context/SyntheticsStateContext/SyntheticsStateContextProvider";
import { selectChartToken, selectTradeboxSelectedTradeType } from "context/SyntheticsStateContext/selectors/globalSelectors";

export type LighterMarketInfo = { /* 同前 */ };

export function useMarketInfoAdapter(): LighterMarketInfo {
  const token = useSelector(selectChartToken);
  return useMemo(() => ({
    symbol: token?.symbol ?? "BTC",
    leverage: 50,
    markPrice: Number(token?.prices?.maxPrice ?? null),
    indexPrice: Number(token?.prices?.minPrice ?? null),
    change24hPct: null,
    volume24hUsd: null,
    openInterestUsd: null,
    funding1hPct: null,
    nextFundingTs: null,
  }), [token]);
}
```

> 若上述 selector 名不准,用 Step 1 grep 到的真实名替换。缺失字段先保留 `null`,Task 10 像素对齐时补。

- [x] **Step 3: 写 useOrderBookAdapter 实现**

从 dex orderbook selector 取数据并映射到 `{ price, size, total }[]`,在 adapter 里累加 total。

- [x] **Step 4: 写 usePositionsAdapter 实现**

从 `selectPositionsInfoData` (或类似) 取 positions,映射字段。

- [ ] **Step 5: 写 usePlaceOrderAdapter 实现**

调用 dex 现有下单入口 (如 `useSubmitOrderTransaction` / `createIncreaseOrderTxn`),映射 `PlaceOrderParams` 到其入参。

- [ ] **Step 6: 浏览器冒烟**

连接钱包 → 下一笔 market 小单 → 看持仓是否出现 → 撤单路径可用。

- [x] **Step 7: 提交**

```bash
git add src/modules/lighter/adapters
git commit -m "feat(lighter): adapters 接入 dex 真实数据"
```

---

## Task 10: TVChart 接入 + 像素对齐

**Files:**
- Modify: `src/modules/lighter/components/ChartPanel/ChartPanel.tsx`
- Modify: `src/modules/lighter/components/ChartPanel/ChartPanel.module.scss`
- Modify: 各 `*.module.scss` (按视觉对比结果微调)

- [x] **Step 1: 把 TVChart 挂进 ChartPanel**

```tsx
// 替换 chart placeholder
import { TVChart } from "shared/components/TVChart/TVChart";
// ...
<div className={styles.chart}>
  <TVChart />
</div>
```

若 TVChart 需要 props,参考 `src/modules/cex/features/x10000trade/pages/Syntheticsx10000Page/Syntheticsx10000Page.tsx` 里的接入方式。

- [x] **Step 2: 用 CSS 覆盖 TVChart 主题**

在 `ChartPanel.module.scss` 的 `.chart` 下加:

```scss
.chart :global(.TVChart) { background: var(--ltr-bg-panel); }
.chart :global(.TVChart .price-line) { /* 如有必要覆盖 */ }
```

- [ ] **Step 3: Playwright 像素对比**

```
调用 browser_navigate http://localhost:3012/trade
调用 browser_take_screenshot(filename: "local-trade-v2.png", fullPage: true)
对比 .playwright-mcp/lighter-trade.png 与 local-trade-v2.png
```

记录差异点 (字号/间距/颜色/行高),逐一修到各 `*.module.scss` tokens 里。

- [ ] **Step 4: 迭代 2-3 轮直到视觉一致度目测 ≥90%**

- [ ] **Step 5: 提交**

```bash
git add src/modules/lighter
git commit -m "feat(lighter): TVChart 接入 + 像素对齐"
```

---

## Task 11: 响应式降级

**Files:**
- Modify: `src/modules/lighter/pages/LighterTradePage.module.scss`

- [ ] **Step 1: 加断点**

```scss
@media (max-width: 1279px) {
  .main { grid-template-columns: 1fr 300px; }
  .main > :nth-child(3) { display: none; }
  // OrderForm 并入 OrderBook tab 作为第二 tab — 需要在 OrderBookPanel 里加 "Trade" tab 方案
}
@media (max-width: 1023px) {
  .main { grid-template-columns: 1fr; grid-template-rows: auto auto auto; }
  .main > div { border-right: 0; border-bottom: 1px solid var(--ltr-border); }
  .bottom { grid-template-columns: 1fr; }
}
```

> 1024-1279 的"OrderForm 并入 OrderBook"先用简单的 `display: none` + 让用户滚动页面看到 OrderForm 下方版本;如果时间允许,再做真正的 tab 合并。

- [ ] **Step 2: 用 browser_resize 测 3 档断点**

```
browser_resize 1440x900 → 三列完整
browser_resize 1200x800 → 两列
browser_resize 800x1200 → 单列
```

每档截图确认无溢出无错位。

- [ ] **Step 3: 提交**

```bash
git add src/modules/lighter
git commit -m "feat(lighter): 响应式 3 档断点"
```

---

## Task 12: 验收 + PR

- [ ] **Step 1: 走一遍验收清单** (spec §10)

- [ ] `/trade` 路由渲染新页面,原 dex 代码未改 → `git log src/modules/cex` 看没有本分支改动
- [ ] 截图对比 ≥ 90%
- [ ] 7 个导航项可跳转 → 手点一遍
- [ ] 钱包连接、行情、订单簿、下单、持仓、撤单可用 → Task 9 冒烟已覆盖
- [ ] 无 AxBlade 橙/黄/紫残留 → `grep -r "#F08000\|--brand" src/modules/lighter` 应为空
- [ ] 三档断点无溢出 → Task 11 已覆盖

- [ ] **Step 2: 运行 tscheck**

```bash
yarn tscheck
```

修复 TS 错误。

- [ ] **Step 3: 运行 lint**

```bash
yarn lint
```

修复 lint 错误。

- [ ] **Step 4: 最终截图归档**

```
browser_take_screenshot filename=final-trade-1440.png fullPage=true
```

放入 `docs/superpowers/plans/artifacts/` (新建该目录)。

- [ ] **Step 5: 创建 PR**

```bash
gh pr create --base main --title "feat(lighter): /trade 页面 Lighter 风格重构" --body "$(cat <<'EOF'
## Summary
- 按 Lighter (app.lighter.xyz) 像素复刻 /trade 页面
- 新建独立模块 src/modules/lighter/,dex/cex 现有代码零改动
- 复用 dex 数据层 hooks,adapters 做字段映射
- 完全舍弃 AxBlade 品牌色与圆角

## Test plan
- [ ] /trade 路由可访问,左侧旧 SideNav 被遮盖
- [ ] 顶部 7 导航项跳转正常
- [ ] 钱包连接、行情刷新、订单簿渲染、市价/限价下单、撤单、持仓显示均可用
- [ ] 1440/1200/800 三断点无溢出
- [ ] 视觉与 app.lighter.xyz/trade/BTC 对比一致度 ≥ 90%

参考 spec: docs/superpowers/specs/2026-04-13-lighter-trade-redesign-design.md
EOF
)"
```

---

## Self-Review

- **Spec 覆盖:** 10 节验收全部映射到 Task 1-12
- **Placeholder 扫描:** 各 Task 的 Step 均带真实代码片段与命令;Task 9/10 的真实 hook 名需要实施时 grep 替换,保留的 "TODO" 仅为数据层接入点,属于必要的 stub 标记
- **类型一致:** `LighterMarketInfo`、`OrderBookLevel`、`LighterPosition`、`LighterOpenOrder`、`PlaceOrderParams` 在定义处与使用处命名一致
- **风险已覆盖:** spec §9 的 4 项风险分别由 Task 9 (字段缺失 `-` 占位)、Task 10 (TVChart 主题覆盖用 :global 降级)、tokens 参数化 (行高)、模块隔离 (品牌断裂仅限 /trade) 对应

计划文档完成,保存于 `docs/superpowers/plans/2026-04-13-lighter-trade-redesign.md`。
