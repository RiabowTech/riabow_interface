# 更新日志 (Changelog)

## [未发布] - 2025

### 🎨 UI/UX 优化

#### Earn 页面 (Earn Page)
- ✨ **全新 Earn 页面开发**：完整实现理财策略展示和订阅功能
  - 策略卡片展示（Active/Completed 状态）
  - 支持倒计时显示和完成状态标记
  - 集成 FAQ 工具提示（InfoHelpIcon）
- ✨ **Past Performance 图表**
  - 使用 Recharts 实现动态柱状图
  - 根据 APR 排名动态调整柱子和标签颜色亮度
  - 自适应 Y 轴范围计算
  - 渐变色填充（绿色主题，透明度 0.15-0.5）
  - 支持 Tooltip 悬停显示详细数据
- ✨ **My Subscriptions 表格**
  - 卡片式布局，显示订阅状态、产品名称、订阅金额、预估利息和到期日
  - 使用分隔线区分字段
  - 利息百分比高亮显示（绿色）
  - 状态徽章（In Progress）
- ✨ **订阅申购弹窗 (SubscriptionModal)**
  - 三步流程：输入份额 → 处理中 → 成功/失败
  - 表单验证和余额检查
  - 渐变边框效果（参考首页卡片）
  - 模拟 Approve 和订阅流程
  - 成功/失败状态反馈动画
- ✨ **页面标题组件重构 (EarnTitle)**
  - 组件化封装：抽象为独立的 `EarnTitle` 组件（40 行 TSX + 242 行 CSS）
  - 四图合一：整合 `earn-logo-plain`、`earn-title-divider`、`earn-title-text`、`earn-title-coin` 和 `earn-background.jpg`
  - 精确布局：Logo 居中（top: 58%），A 横线叠加（left: 63%, width: 15%），底部文字（gap: 120px），币图标（right: 240px）
  - 动态动画：
    - Logo 呼吸发光（3 秒循环，缩放 1.0-1.02）
    - **A 横线上下扫描**（5 秒循环，Y 轴 -55% → -45%，配合发光强度和缩放变化）
    - 币图标浮动旋转（8 秒循环）
  - 移动端优化：
    - 使用 `!important` 覆盖全局 `img { max-width: 100%; height: auto }` 样式
    - 响应式尺寸（Logo: 88px → 60px，Text: 24px → 14px，Coin: 60px → 45px）
    - A 横线移动端缩小（15% → 25%）
    - 完美适配 H5 屏幕，无压缩变形
  - 代码优化：从 `Earn.tsx` 减少 30 行，从 `Earn.css` 减少 220 行，提升可维护性
- ✨ **组件封装与复用**
  - 将 Past Performance 图表抽象为独立组件 `PastPerformanceChart`
  - 创建 `SubscriptionModal` 独立组件
  - 实现 `Divider` 可复用组件（统一分隔线样式）
- ✨ **样式系统优化**
  - 提取公共样式类：`.info-field`、`.info-row`、`.info-label`、`.value-number`
  - 统一字体样式（Outfit、Chakra Petch）
  - 合并重复 CSS 选择器，减少代码冗余
  - 明确的样式分区和注释
- ✨ **响应式设计**
  - 完整的移动端 H5 适配（≤768px）
  - 弹窗宽度自适应（桌面端 fit-content，移动端 95vw）
  - 字体大小分级（11px/12px/13px/14px/16px）
  - 触控友好的按钮和输入框尺寸
  - 垂直布局避免横向滚动
- ✨ **视觉细节**
  - 页面背景色 `#090909`
  - 模块背景 `rgba(255, 255, 255, 0.05)`，圆角 20px
  - 分隔线颜色 `rgba(255, 255, 255, 0.10)`
  - APR 卡片渐变背景
  - COMPLETED 徽章（使用 titleBg.png）
  - USDT 图标集成（SVG）
- ✨ **钱包集成**
  - 根据钱包连接状态切换按钮文案（SUBSCRIBE NOW / CONNECT WALLET）
  - 集成 `useWallet` 和 `useConnectModal`
- 🐛 **代码质量优化**
  - 移除未使用的导入（formatUsd、Table 组件等）
  - 简化注释，保留核心信息
  - 颜色常量提取（便于主题管理）
  - 删除冗余 wrapper div

#### 首页 (Landing Page)
- ✨ **全新设计重构**：将 Zanbara 风格的首页完全重构为 Renance 品牌设计
  - 更新所有视觉元素、配色方案和布局结构
  - 集成新的字体资源（Outfit、Chakra Petch）
  - 优化图片资源引用路径
- ✨ **卡片交互效果优化**
  - 重新设计功能卡片 hover 效果，使用独立的光效层（`light-effect-top`、`light-effect-bottom`）
  - 实现文字平滑移动到卡片中心的动画效果
  - 固定卡片高度（桌面端 400px，移动端自适应），避免布局抖动
- ✨ **滚动动画**
  - 为所有首页元素添加按序加载的淡入动画
  - 集成 `react-countup` 库实现数字统计的滚动计数动画
- 🐛 **字体加载优化**
  - 为所有字体添加 `font-display: swap` 属性，防止字体闪烁（FOIT/FOUT）
- ✨ **按钮行为统一**
  - 首页所有 “START TRADING” 按钮统一跳转至 `/x10000`

#### Portfolio 页面 (Portfolio / Renance Account)
- ✨ **Portfolio 菜单新增**
  - 新增 Portfolio 菜单项，使用专属图标（`ic_portfolio.svg`）
  - 图标设计：文档样式，带文本行装饰，符合 Portfolio 语义
  - 图标尺寸：20x20，与其他菜单图标统一
  - 动态跳转逻辑：钱包已连接时跳转到 `/accounts/{address}?network=xxx&v=2`，未连接时跳转到 `/accounts`
  - 智能高亮：访问 `/accounts` 或 `/accounts/:account` 时自动高亮
  - 位置：Stats 和 Referrals 之间
  - 集成 `useWallet` 和 `buildAccountDashboardUrl` 实现动态 URL 生成
- ✨ **未连接钱包落地页**
  - 创建 `ConnectWalletPrompt` 组件：钱包未连接时显示连接提示页面
  - 设计特点：
    - 大型钱包图标，带旋转渐变边框动画
    - "Connect Your Wallet" 标题和说明文字
    - 醒目的"Connect Wallet"按钮，一键打开连接弹窗
    - 功能特性展示：View Performance、Track Positions、Monitor PnL
  - 完整的响应式设计（移动端优化）
  - 集成 `useConnectModal` 实现一键连接钱包
- ✨ **智能重定向逻辑**
  - 访问 `/accounts` 时，根据钱包连接状态智能跳转：
    - 未连接：显示 `ConnectWalletPrompt` 连接提示页
    - 已连接：自动重定向到 `/accounts/{address}?network=xxx&v=2`，显示当前钱包的 Portfolio
  - 避免显示"所有账户交易历史"页面（`SyntheticsActions`）
  - 使用 `useEffect` + `history.replace` 实现无感重定向

#### 侧边导航菜单 (Side Navigation)
- ✨ **视觉设计优化**
  - 添加顶部和底部两个绿色圆角装饰（`.renance-sidenav`）
  - 实现右侧垂直绿色发光线条（`.renance-sidenav-right-line`），中间段高亮
  - 优化 Logo 区域，添加 "RENANCE" 文字，使用 Chakra Petch 字体并加粗
  - 选中菜单项右侧显示绿色高亮竖线
- ✨ **交互优化**
  - 修复菜单折叠/展开时 Logo 和内容高度变化导致的抖动问题
  - 优化菜单折叠时的完全收起效果，保持高度一致性
  - 将菜单项移到侧边栏顶部，优化布局结构
- 🐛 **Logo 抖动修复**
  - 将 SideNav 提升到顶层组件（`AppRoutes.tsx`），避免路由切换时重新挂载
  - 固定 Logo 区域 padding，确保位置稳定
- 🐛 **折叠宽度异常修复**
  - 折叠状态下统一侧边栏宽度，点击 `x10000` 时不再跳变

#### 主内容区域
- ✨ **视觉一致性**
  - 在主内容区域左侧添加两个绿色圆角，与侧边导航形成对称设计
  - 实现圆角对齐，确保视觉平衡
- ✨ **主题背景统一**
  - 主内容背景设为 `#111`，模块背景为 `#090909`，统一圆角 20px 与 Header 内边距

#### Header 组件
- ✨ **底部发光渐变线**：在 Header 模块底部添加横向发光渐变线，效果类似侧边菜单右侧的竖线，使用绿色渐变（`rgba(0, 255, 178, 0)` 到 `rgba(0, 255, 178, 0.5)`），增强视觉一致性

#### Tab 组件优化
- ✨ **TradeBox 顶部 Tabs（Market/Limit/More）**
  - 激活状态文字颜色改为绿色（`#00ffb2`）
  - 添加圆润的下划线效果（`border-radius: 999px`）
  - 优化字体样式，使用 Chakra Petch 字体
- ✨ **账户页面 Tabs（Positions/Orders/Trades/Claims）**
  - 激活状态文字颜色改为绿色（`#00ffb2`）
  - 实现圆润的下划线效果
  - **新增**：下划线左右移动的平滑过渡动画（0.3s ease）
  - 移除 tabs 容器底部的分隔线
- 🎯 **样式隔离**
  - 使用 `data-qa` 属性选择器，确保样式只作用于特定 tabs，不影响其他组件
- ✨ **TradeBox x10000 顶部 Tabs**
  - `Market / Limit / More` 区域增加顶部分割线，统一视觉
- ✨ **交易方向 Tabs（Long / Short）**
  - Long / Short 按钮采用绿色渐变边框与发光效果，并在一行等分、左右仅保留外侧圆角
- ✨ **设置弹窗 Tabs（Settings Tabs）**
  - Settings Tabs 复用 Long/Short 的样式，标签文案精简为 “Trading / Display / Debug”

#### 页面标题与布局间距
- ✨ **标题迁移到 Header**：`Referrals / Pools / Stats / Leaderboard` 等菜单页的主标题统一移动到顶部 Header，与网络信息徽标并排显示，减少内容区占用高度。
- ✨ **隐藏副标题并通过 Tooltip 恢复**：在 Settings、Leaderboard、Stats 等页面中，将说明性小标题隐藏，仅在标题 hover 时通过 Tooltip 展示，保持界面简洁同时保留信息。
- ✨ **统一模块间距**：Header 与内容区之间的间距统一为 `4px`，主内容区各模块（包括 Referrals、Pools、Stats、Leaderboard、x10000）的上下左右 gap 统一为 `4px`，整体更紧凑。

#### 10000x 交易页
- ✨ **主区域布局收紧**：图表 + OrderBook 之间的横向间距从 `gap-8` 调整为 `gap-4`，视觉更加集中。
- ✨ **TradeBoxx10000 表单优化**：表单内各行、Token 行图标与文字之间的间距由 `gap-8` 调整为 `gap-4`，减少空白感。
- 🐛 **Collateral In 区域高度抖动修复**：使用绝对定位处理警告信息（`warnings`），避免在 Long/Short 切换时因警告出现/消失导致页面高度抖动，保持布局稳定。

#### Referrals 页面
- ✨ **排版与布局**：Referrals 主容器改为使用统一主题卡片背景（`bg-slate-900`）和 `gap-4`，与其它模块风格一致。
- ✨ **表单/按钮尺寸统一**：所有 `Connect Wallet` 按钮（包括 "Enter referral code" 和 "Generate Referral Code" 两个 tab）宽度统一限制为 `max-w-[400px]` 且居中，宽度与 `Enter` / `Submit` 按钮一致，避免在大屏上过宽。

#### Leaderboard 页面
- ✨ **标题与网络信息区域优化**：在 Header 内将 `Leaderboard` 标题放置在网络徽标右侧，并为标题添加 Tooltip，hover 时展示原先隐藏的说明文案。
- ✨ **表格与分页布局**：表格容器使用 `.TableBox` + `.Table` 的最小宽度策略，在窄屏设备上通过横向滚动展示完整列，同时保持默认宽度 1200px 的桌面布局。

#### 分页组件
- ✨ **BottomTablePagination 主题化**：
  - 所有翻页按钮统一为深色圆角方块（`rounded-[10px]`、背景 `#151515`），hover 时略微提亮。
  - 当前页使用品牌绿色高亮（`#00FFB2`），文本为黑色，并带有绿色描边，视觉上与导航/按钮风格一致。
  - 禁用的上一页/下一页/首尾页按钮降低不透明度并禁用指针，状态反馈更清晰。

#### 按钮组件
- ✨ **Connect Wallet 按钮**
  - 更新为 `primary-action` 变体，统一视觉风格
  - 优化 hover 和 active 状态的绿色发光效果

#### SVG 图标
- ✨ **颜色控制优化**
  - 将 `ic_kx_2.svg` 的填充色改为 `currentColor`，支持通过 CSS 控制颜色

#### 浏览器标签 & 品牌资产
- ✨ **Favicon 与应用图标**
  - 基于新 Logo 重新生成并替换所有 favicon / 应用图标
- ✨ **浏览器标签页标题 & SEO**
  - 将所有残留的 “Zanbara” 文案替换为 “Renance”，包括动态标题与 SEO Meta
- ✨ **移动端 Logo**
  - 小屏/H5 场景统一显示新的 Renance Logo


### 📦 依赖更新

- ✨ 集成 `react-countup` 库用于数字动画效果


### 📝 样式系统

#### Tailwind 配置
- ✨ 添加 `font-chakraPetch` 字体工具类，支持全局使用 Chakra Petch 字体

#### CSS 变量和主题
- 📚 统一主题色修改点文档化：
  - `src/config/colors.ts` - 核心颜色定义
  - `tailwind.config.ts` - Tailwind 颜色集成
  - `src/styles/Shared.scss` - 全局样式变量

---

## 技术细节

### 主要文件变更

#### 新增文件
- `src/pages/LandingPage/renance.html` - 新设计参考文件

#### 主要修改文件
- `src/pages/LandingPage/LandingPage.tsx` - 完全重构
- `src/pages/LandingPage/LandingPage.css` - 样式重写
- `src/components/SideNav/SideNav.tsx` - 视觉和交互优化
- `src/components/Tabs/Tabs.tsx` - 添加下划线动画逻辑
- `src/components/Tabs/RegularTab.tsx` - Tab 样式优化
- `src/components/Tabs/Tabs.css` - Tab 样式和动画，添加 Long/Short tabs 下移效果
- `src/components/Button/Button.scss` - TradeBox tabs 样式
- `src/styles/Shared.scss` - 侧边导航和主内容区域样式，添加 Header 底部发光渐变线
- `src/styles/Font.css` - 字体加载优化
- `src/App/AppRoutes.tsx` - 路由和布局优化
- `tailwind.config.ts` - 字体配置
- `src/components/TradeBoxx10000/TradeBoxRowsx10000/CollateralSelectorRowx10000.tsx` - 修复高度抖动问题
- `src/components/Referrals/AddAffiliateCode.tsx` - 统一 Connect Wallet 按钮宽度
- `src/components/Referrals/JoinReferralCode.tsx` - 统一 Connect Wallet 按钮宽度
- `src/components/AppHeader/AppHeader.tsx` - 添加 rightContent 支持，标题迁移到 Header
- `src/components/ChainContentHeader/ChainContentHeader.tsx` - 支持 title 和 tooltipContent 属性
- `src/components/ChainContentHeader/ChainContentHeader.scss` - 标题样式定义
- `src/components/AppPageLayout/AppPageLayout.tsx` - 统一模块间距为 4px
- `src/pages/Referrals/Referrals.tsx` - 标题迁移到 Header，统一 gap 为 4px
- `src/pages/Referrals/Referrals.css` - 布局优化，统一按钮高度
- `src/pages/Pools/Pools.tsx` - 标题迁移到 Header，统一 gap 为 4px
- `src/pages/Dashboard/DashboardV2.tsx` - 标题迁移到 Header，统一 gap 为 4px
- `src/pages/LeaderboardPage/LeaderboardPage.tsx` - 标题迁移到 Header，添加 Tooltip
- `src/pages/LeaderboardPage/components/LeaderboardContainer.tsx` - 布局优化，统一 gap 为 4px
- `src/pages/LeaderboardPage/LeaderboardPage.scss` - 移动端表格横向滚动优化
- `src/pages/Syntheticsx10000Page/Syntheticsx10000Page.tsx` - 主区域 gap 调整为 4px
- `src/components/TradeBoxx10000/TradeBoxx10000.tsx` - 表单内 gap 调整为 4px
- `src/components/Pagination/Pagination.tsx` - 分页组件主题化样式

---


