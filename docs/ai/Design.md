# 交易所前端项目架构说明 (Autonomy Architecture)

## 核心设计思想：业务自治 (Business Autonomy)

本架构采用**“物理隔离、业务自治”**的策略，将 CEX（中心化交易）、DEX（去中心化交易）、Landing（官网） 视为三个互不干扰的独立应用。

- 隔离优于复用：宁可代码重复，不可逻辑耦合。

- 各司其职：每个模块拥有独立的 UI 风格、数据流、API 处理逻辑。

- 极简共享：shared 目录仅存放无业务逻辑的工程化工具。

## 目录结构指南

```txt
src/
├── app/                    # 【调度层】
│   ├── routes/             # 路由分发器，负责按需加载 modules
│   ├── providers/          # 全局 Context (如 i18n, Theme, QueryClient)
│   ├── store/              # 总store配置（组合DEX/CEX的模块化store）
│   │   └── index.ts        # store分发入口，动态加载DEX/CEX store
│   └── theme.ts            # 共享主题配置（如果DEX/CEX无差异）
├── shared/                 # 共享代码层，确保DEX/CEX不重复代码
│   ├── hooks/              # 共享hooks（如useAuth、useTheme）
│   ├── lib/                # 共享工具函数、utils、constants
│   ├── types/              # 共享类型定义（如通用接口）
│   ├── locales/            # 共享国际化文件（如果语言一致）
│   └── utils/              # 纯逻辑工具 (格式化、校验)
├── modules/                # 【业务层】所有业务逻辑必须在此完成闭环
│   ├── dex/                # DEX 专属目录,完全隔离的链上交易代码
│   │   └── components/     # DEX专属组件
│   │   └── hooks/          # DEX专属hooks（如useWalletConnect）
│   │   └── lib/            # DEX专属工具（如链上交互utils）
│   │   └── pages/          # 如果使用pages router；否则迁移到app router子路径
│   │   └── route/          # DEX路由配置（如果需要子路由）
│   │   └── chains/         # 链配置（如Ethereum、Solana支持）
│   │   ├── contracts/      # ABI 与合约交互逻辑
│   │   └── store/          # DEX专属store模块（如reducers/slices）
│   │   └── types.ts        # DEX专属类型
│   │   └── img/            # DEX专属图片（如果不共享）
│   │   └── locales/        # DEX专属本地化（如果有差异）
│   ├── cex/                 # CEX模块，完全隔离的中心化交易代码
│   │   └── components/     # CEX专属组件
│   │   └── hooks/          # CEX专属hooks（如useApiAuth）
│   │   └── lib/            # CEX专属工具（如API调用utils）
│   │   └── pages/          # 如果使用pages router；否则迁移到app router子路径
│   │       └── views/      # 页面级组件
│   │   └── route/          # CEX路由配置（如果需要子路由）
│   │   └── services/       # CEX服务层（如API服务封装）
│   │   └── store/          # CEX专属store模块（如reducers/slices）
│   │   └── types.ts        # CEX专属类型
│   │   └── img/            # CEX专属图片（如果不共享）
│   │   └── locales/        # CEX专属本地化（如果有差异）
│   └── landing/            # 官网专属目录
       ├── components/     # 官网 UI 组件
         └── assets/         # 官网专用高清图/视频
```

## 开发守则 (Red Lines)

🚫 严禁跨模块引用

- 禁止：import { CexButton } from '@/modules/cex/components' 出现在 dex 模块中。
- 对策：如果发现某个组件在两边都很有用，直接 复制 一份到自己的模块目录下，并根据自身业务调整。

🎨 样式隔离原则

- 各模块根组件需包裹专属 Class（如 .cex-scope, .landing-scope）。

- 利用 Tailwind 局部变量或 CSS 变量控制风格，确保修改官网样式不会导致交易页错位。

📦 产物隔离 (Performance)

- 必须使用 React.lazy 进行模块加载。

- 目标：用户访问 Landing 官网时，浏览器不应下载 ethers.js (DEX) 或大体积图表库 (CEX)。

## 常见场景处理

- 场景 A：发现 shared/utils 里的一个时间格式化函数不满足 DEX 需求。

  - 答：不要修改 shared。在 modules/dex/utils 中新建一个函数，或者直接写在业务逻辑里。

- 场景 B：想要添加一个新的业务模块（如 NFT 市场）。

  - 答：在 modules/ 下新建 nft/ 文件夹，完全复刻上述结构即可

## 状态管理建议 (Zustand)

每个模块维护自己的 Store 文件：

- modules/cex/store/useCexStore.ts
- modules/dex/store/useDexStore.ts
在模块切换时，建议在 useEffect 的卸载函数中调用 reset 操作，以保证内存纯净。
