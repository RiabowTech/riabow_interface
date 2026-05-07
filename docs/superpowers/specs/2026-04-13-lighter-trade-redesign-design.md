# Lighter 风格 /trade 页面改造 — 设计文档

- **日期**: 2026-04-13
- **分支**: `feat/lighter`
- **参考目标**: https://app.lighter.xyz/trade/BTC
- **本地改造目标**: http://localhost:3012/trade
- **范围**: 纯 UI 改造,复用现有 dex 数据层。不接 Lighter 官方 API,不动 dex/cex 原代码。

---

## 1. 目标与原则

1. **完全对齐 Lighter 布局与视觉**:像素级复刻三段式布局、表格密度、字号行距、颜色系统、扁平无圆角。
2. **完全舍弃 AxBlade 品牌色/圆角风**:仅保留 AxBlade 站点的 7 个导航入口。
3. **不引入新后端**:复用 dex 的行情/订单簿/下单/钱包/持仓 hooks,通过适配层映射到 Lighter 组件。
4. **模块隔离**:新代码集中于 `src/modules/lighter/`,原 dex trade 代码保留不动,路由 `/trade` 切到新模块。
5. **缺数据不阻塞**:Lighter 有而本地暂无的字段(Next Funding / Est. Liq. Price / Accounts 明细等)先以 `-` 占位,留 TODO。

## 2. 顶层架构

### 2.1 目录结构

```
src/modules/lighter/
├── pages/
│   └── LighterTradePage.tsx
├── components/
│   ├── TopNav/
│   │   ├── TopNav.tsx
│   │   └── TopNav.module.scss
│   ├── SymbolBar/
│   ├── ChartPanel/
│   ├── OrderBookPanel/
│   ├── OrderFormPanel/
│   │   ├── OrderFormPanel.tsx
│   │   ├── MarketOrderForm.tsx
│   │   ├── LimitOrderForm.tsx
│   │   └── AdvancedOrderForm.tsx
│   ├── BottomTabs/
│   │   ├── BottomTabs.tsx
│   │   ├── PositionsTab.tsx
│   │   ├── AssetsTab.tsx
│   │   ├── OpenOrdersTab.tsx
│   │   ├── OrderHistoryTab.tsx
│   │   ├── TradeHistoryTab.tsx
│   │   └── FundingHistoryTab.tsx
│   └── AccountsPanel/
├── adapters/
│   ├── useMarketInfoAdapter.ts
│   ├── useOrderBookAdapter.ts
│   ├── usePositionsAdapter.ts
│   └── usePlaceOrderAdapter.ts
├── styles/
│   ├── tokens.scss            # 颜色/间距/字号
│   └── global.scss            # 只在 lighter 模块内生效
└── routes.ts
```

### 2.2 路由接入

`src/app/MainRoutes.tsx` 中将 `/trade` 的 element 替换为 `<LighterTradePage />`。原 dex trade 页面保留在原路径不动。

### 2.3 组件树

```
LighterTradePage
├── TopNav (48px)
│   └── Logo │ Trade │ Earn │ Referrals │ Leaderboard │ Portfolio │ Points │ API Keys │ ⟨spacer⟩ │ Block #N │ 钱包地址 │ Settings │ Connect Wallet
├── SymbolBar (56px)
│   └── [BTC 50x ▾] │ Mark Price │ Index Price │ 24h Change │ 24h Volume │ Open Interest │ 1hr Funding │ Next Funding
├── MainGrid (flex-1, 3 列: 1fr / 340px / 320px)
│   ├── ChartPanel
│   │   ├── Tabs: Price / Funding / Details
│   │   ├── Toolbar: TradingView / Original / Depth + 5m/15m/1h/4h/More + Chart Elements
│   │   └── Chart 渲染区 (沿用 TVChart)
│   ├── OrderBookPanel
│   │   ├── Tabs: Order Book / Trades
│   │   ├── 表头: Price / Size BTC / Total
│   │   ├── 卖盘 (红)
│   │   ├── Spread 行
│   │   └── 买盘 (绿)
│   └── OrderFormPanel
│       ├── Tabs: Market / Limit / Advanced
│       ├── [Buy/Long | Sell/Short] 分段按钮
│       └── 字段表单 (见 §4.5)
└── BottomGrid (高度 260px, 2 列: 1fr / 320px)
    ├── BottomTabs
    │   └── Positions / Assets / Open Orders / Order History / Trade History / Funding History
    └── AccountsPanel
        └── Perpetuals Equity / Spot Equity / Perpetuals Overview / Unrealized PnL / Cross Leverage / Cross Margin Usage / Maintenance Margin / ...
```

## 3. 视觉规范

### 3.1 颜色 tokens

| Token | 值 | 用途 |
|-------|-----|------|
| `--bg-root` | `#0B0B0B` | 全局背景 |
| `--bg-panel` | `#111111` | 面板背景 |
| `--bg-panel-2` | `#151515` | 次级面板 |
| `--border` | `#1F1F1F` | 所有分隔线 |
| `--text-primary` | `#E6E6E6` | 主文字 |
| `--text-secondary` | `#8A8A8A` | 次文字 / 表头 |
| `--text-muted` | `#5A5A5A` | 占位 |
| `--up` | `#10B981` | 涨 / 买 |
| `--down` | `#EF4444` | 跌 / 卖 |
| `--accent-buy-bg` | `#10B981` | Buy 按钮底 |
| `--accent-sell-bg` | `#EF4444` | Sell 按钮底 |
| `--warn-banner` | `#3A1212` | 顶部红色警告条 |

### 3.2 间距与尺寸

- 圆角:全局 `border-radius: 0`;按钮/输入 ≤ `2px`
- 面板 padding:`8px 12px`
- 表格行高:`22px`,表头 `20px`
- 字号:主体 `12px`,表头 `11px`,标题 `13px`,SymbolBar 数值 `13px`
- 字体栈:`Inter, system-ui` + 数字列 `ui-monospace, Menlo`

### 3.3 交互

- 无阴影,无 hover 位移
- 可点击行 hover 背景 `#1A1A1A`
- 按钮无圆角,无渐变,实心色块
- tab 选中态:文字白色 + 下方 2px 白色下划线

## 4. 组件规格

### 4.1 TopNav

- 高 48px,背景 `--bg-root`,底边 1px `--border`
- 左:Logo (AxBlade 单字 / 极简字标,黑白)
- 中:7 个导航 `Trade / Earn / Referrals / Leaderboard / Portfolio / Points / API Keys`,间距 24px,当前项白色 + 下划线
- 右:`Block #214225698`(绿点)+ 地区/语言 + 设置齿轮 + `Connect Wallet`

### 4.2 SymbolBar

- 高 56px
- 左:`[BTC] 50x ▾`(点击弹出交易对选择 + 杠杆选择)+ ★ 收藏
- 右:inline stats,每项为两行(label 11px / value 13px)
- `Next Funding` 是倒计时格式 `HH:MM`

### 4.3 ChartPanel

- 沿用现有 `TVChart`,包一层 Lighter 壳:去除品牌 watermark,颜色覆盖
- Tabs `Price / Funding / Details`:MVP 仅实现 Price;Funding、Details 留占位
- Toolbar 左:`5m/15m/1h/4h/More` (More 弹出更多周期);右:`TradingView / Original / Depth` + 全屏/截图图标

### 4.4 OrderBookPanel

- Tabs:`Order Book` / `Trades`
- Order Book:20 档,卖盘倒序在上,买盘正序在下,中间 Spread 行显示价差和百分比
- Size 单位跟随交易对标的
- 背景深度条:从右向左渐变,Size 越大越长,透明度 20%
- 点击某一行 → 把 price 填入右侧 OrderFormPanel 的 Limit price

### 4.5 OrderFormPanel

顶部 Tabs:`Market / Limit / Advanced`
下一行:`[Buy/Long] [Sell/Short]` 分段按钮(选中侧背景 = `--up` 或 `--down`)

**字段顺序(Market 状态):**

| 字段 | 类型 | 说明 |
|------|------|------|
| Available to Trade | 只读 | USDT 余额 |
| Position | 只读 | 当前仓位 |
| Amount | 输入 + 单位下拉 (BTC/USDT) | 带 0-100% 滑块 + 输入框 |
| Reduce Only | checkbox | |
| Take Profit / Stop Loss | checkbox | 展开时加两个价格输入 |
| Order Size | 只读 | 计算值 |
| Order Value | 只读 | 计算值 |
| Est. Liq. Price | 只读 | 占位 `-` |
| Position Margin | 只读 | |
| Est. Price | 只读 | |
| Slippage | 只读 + ✏️ | `Est: 0.00% │ Max: 1%` |
| Fees | 只读 | `Taker: 0% │ Maker: 0%` |

下方主按钮:`Buy / Long`(绿)或 `Sell / Short`(红),满宽,40px 高。

**Limit 状态**:`Amount` 上方多 `Price` 字段 + `Post Only` checkbox。
**Advanced 状态**:并入 Leverage 设置、TIF (GTC/IOC/FOK)、Bracket 等;杠杆滑块归到此处。

杠杆原本的独立滑块删除;SymbolBar 的 `50x` badge 点击弹窗修改杠杆。

### 4.6 BottomTabs

6 个 tab,MVP 实现:
- **Positions**:沿用本地 positions 数据
- **Open Orders**:沿用
- **Order History** / **Trade History** / **Funding History** / **Assets**:UI 完整,表格空态,数据 hook 留 TODO

每个 tab 是等宽表格,列按 Lighter 实际列集实现。

### 4.7 AccountsPanel

右下 320px 宽:
- Section `Accounts`:Perpetuals Equity / Spot Equity
- Section `Perpetuals Overview`:Unrealized PnL / Cross Leverage / Cross Margin Usage / Maintenance Margin / Cross Margin Ratio / Free Collateral / ...
- 全部显示 `-`,字段完整占位;数据 hook 留 TODO

## 5. 数据适配

dex 现有 hook → Lighter 组件 props 映射,集中在 `src/modules/lighter/adapters/`:

| Lighter 组件需要 | dex 来源 |
|------------------|----------|
| SymbolBar 行情 | `useMarketInfo` (dex) |
| OrderBookPanel | `useOrderBook` (dex) |
| OrderFormPanel 下单 | `usePlaceOrder` + 现有钱包 context |
| Positions 表 | `usePositions` |
| Open Orders 表 | `useOpenOrders` |

适配器只做字段重命名与单位换算,不改业务。

## 6. 实施阶段

1. **阶段 1 — 脚手架**:建目录、tokens.scss、路由切换、空壳 `LighterTradePage` 通过路由访问
2. **阶段 2 — TopNav + SymbolBar**:静态 UI + 真实钱包状态 + 真实行情
3. **阶段 3 — ChartPanel 壳**:TVChart 接入 + 主题覆盖
4. **阶段 4 — OrderBookPanel**:接 useOrderBook,深度条,Spread,点击填价
5. **阶段 5 — OrderFormPanel**:Market / Limit / Advanced 三态,Buy/Sell 分段,字段完整,下单联调
6. **阶段 6 — BottomTabs**:Positions / Open Orders 通,其余 UI 壳
7. **阶段 7 — AccountsPanel**:UI 壳 + 占位
8. **阶段 8 — 像素对齐**:Playwright 截图对比 Lighter,调间距/字号/颜色至接近
9. **阶段 9 — 响应式**:≥1280px 主力布局;<1280 降级单列堆叠

每阶段结束做一次 code-reviewer + 手动截图对比。

## 7. 响应式

- **主力断点 ≥1280px**:完整三列 + 底部两列
- **1024-1279px**:右侧 OrderForm 与 OrderBook 合并为 tab
- **<1024px**:单列堆叠,顺序 SymbolBar → OrderForm → Chart → OrderBook → BottomTabs

## 8. 非目标 (不做)

- 不接 Lighter 官方 API / SDK
- 不改 dex / cex 现有代码与路由
- 不做亮色主题(只暗色)
- 不做 i18n 改造(沿用本地)
- 不做新的行情数据源

## 9. 风险与对策

| 风险 | 对策 |
|------|------|
| dex 行情字段与 Lighter 所需字段不 1:1 | 适配层补齐;缺失字段 `-` 占位 |
| TVChart 主题不易覆盖 | 用 CSS 变量 + overlay;实在不行接受保留原主题 |
| 表格密度过密影响可读性 | 行高参数化在 tokens,后续可调 |
| 去品牌后与 AxBlade 站点其它页视觉断裂 | 本次只改 /trade,其它页不受影响;后续可统一 |

## 10. 验收标准

- [ ] `/trade` 路由渲染新页面,原 dex 代码未改
- [ ] 并排截图与 Lighter 视觉一致度 ≥ 90%(布局、密度、颜色、字号)
- [ ] 7 个站点导航仍可正常跳转
- [ ] 钱包连接、行情、订单簿、下单、持仓、撤单全部可用
- [ ] 无 AxBlade 品牌色(橙/黄/紫等)和圆角(>2px)残留
- [ ] 响应式三档断点均无溢出
