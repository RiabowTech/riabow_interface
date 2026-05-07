# App 调度层

此目录负责应用级别的配置和调度。

## 目录结构

```
app/
├── routes/              # 路由分发器
│   ├── index.ts         # 路由导出
│   └── lazyImports.ts   # 集中管理的懒加载导入
├── providers/           # 全局 Context (如 i18n, Theme, QueryClient)
├── store/               # 总 store 配置
├── App.tsx              # 应用根组件
├── AppRoutes.tsx        # 路由入口（使用旧结构）
├── MainRoutes.tsx       # 主路由配置
├── swrConfig.tsx        # SWR 配置
└── App.scss             # 全局样式
```

## 使用规则

### 路由配置
- 路由配置使用 React.lazy 实现按需加载
- 所有 lazy import 集中在 `routes/lazyImports.ts` 管理
- 遵循模块隔离原则：
  - Landing 页面不应加载 DEX/CEX 代码
  - DEX 页面不应加载 CEX 代码
  - CEX 页面不应加载 DEX 代码

### Provider 原则
- 全局 Provider 仅包含无业务逻辑的通用功能
- 业务相关的 Provider 应在各自模块内定义

### Store 原则
- Store 入口负责动态加载 DEX/CEX 的模块化 store
- 使用 Zustand 进行状态管理
- 模块切换时应调用 reset 清理状态
