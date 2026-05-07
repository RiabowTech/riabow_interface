# React Frontend Tech Stack Specification技术栈规范

> 本文档用于 **强制统一 React 前端项目的技术选型**  
> Claude Code **必须严格遵守**，不得擅自引入、替换或混用技术栈  
>
> 优先级：
> Tech Stack Spec > Architecture Guide > Coding Standards > 其他说明

---

## 1. 总体原则（最高优先级）

### 1.1 技术稳定性原则

- 一旦选定技术栈：
  - ❌ 不允许“为了更优雅”
  - ❌ 不允许“社区更流行”
  - ❌ 不允许“Claude 更熟”
- 只能在以下情况讨论替换：
  - 性能瓶颈被量化证明
  - 官方废弃
  - 架构级不可维护

---

### 1.2 禁止“技术混用”

- 同一项目中：
  - ❌ 不允许两个状态管理库
  - ❌ 不允许两种样式方案
  - ❌ 不允许两种数据请求范式

---

## 2. 基础技术栈（Core Stack）

### 2.1 语言与运行时

| 分类 | 规范 |
|---|---|
| Language | TypeScript |
| TS Mode | strict = true |
| Target | ES2020+ |
| JSX Runtime | Automatic |

❌ 禁止 JavaScript (.js / .jsx)

---

### 2.2 React 规范

| 项 | 规范 |
|---|---|
| React | >= 18 |
| 模式 | Function Component Only |
| Class Component | ❌ 禁止 |
| Concurrent Features | 仅在明确说明后使用 |

---

## 3. 构建与工程化

### 3.1 构建工具（只能选其一）

- Vite（SPA / Library）
- Next.js（SSR / App Router）

> Claude Code **不得在实现中引入另一种构建假设**

---

### 3.2 模块规范

- 使用 ES Module
- ❌ 禁止 CommonJS
- 路径别名通过 tsconfig / vite / next 配置

---

## 4. 状态管理（State Management）

### 4.1 分类原则（强制）

| 状态类型 | 方案 |
|---|---|
| 本地 UI | useState / useReducer |
| 跨组件 | Feature Hook |
| 跨页面 | Zustand / Redux Toolkit |

---

### 4.2 全局状态约束

- 全局状态 **不是默认选项**
- 只有在：
  - 多页面共享
  - 与路由无关
  - 生命周期长
- 才允许进入 store

---

## 5. 数据请求与副作用

### 5.1 数据请求方案（只能选其一）

- TanStack Query
- 自封装 request / fetcher

❌ 禁止：
- 组件中直接 fetch
- 多种请求库并存

---

### 5.2 WebSocket / 实时数据

- 必须封装在：
  - Service
  - 或 Feature-level Hook
- ❌ 禁止在组件中直接使用

---

## 6. 样式方案（Styling）

### 6.1 样式选型（只能选其一）

- Tailwind CSS
- CSS Modules

❌ 禁止：
- styled-components
- inline style（除非动态计算）

---

### 6.2 样式约束

- 样式与业务逻辑隔离
- 禁止在 className 中写复杂条件逻辑

---

## 7. 路由（Routing）

### 7.1 路由层职责

- 路由文件：
  - 只负责页面映射
  - 不写业务逻辑
- 参数解析在 Page 层完成

---

## 8. 表单与交互

### 8.1 表单方案（如使用）

- react-hook-form（推荐）
- ❌ 禁止多个表单库并存

---

## 9. 工具链（Tooling）

### 9.1 代码规范

| 工具 | 要求 |
|---|---|
| ESLint | 启用 |
| Prettier | 启用 |
| TypeScript | strict |

> Claude Code 输出代码必须默认符合 ESLint + Prettier

---

### 9.2 测试（如启用）

- 单元测试：Vitest / Jest（二选一）
- 组件测试：Testing Library
- E2E：Playwright（如有）

---

## 10. 第三方依赖管理

### 10.1 引入规则（强约束）

Claude Code **不得引入任何第三方库，除非：**

1. 明确说明用途
2. 无标准库可替代
3. 与现有技术栈不冲突

---

### 10.2 禁止清单（默认）

- moment.js
- lodash（允许按需函数级引入并说明原因）
- classnames（Tailwind 项目中）

---

## 11. 浏览器与兼容性

- 默认支持现代浏览器
- 不做 IE 兼容
- Polyfill 必须集中管理

---

## 12. 环境与配置

### 12.1 环境变量

- 统一通过：
  - `import.meta.env`
  - `process.env`（Next.js）
- ❌ 禁止硬编码环境差异

---

## 13. Claude Code 专属约束（非常重要）

Claude Code **在涉及技术选型时必须：**

1. 明确说明是否符合本规范
2. 若不符合：
   - 明确指出
   - 给出原因
   - 等待确认

> ❌ 不允许“顺手帮你换个更好的库”

---

## 14. 技术栈变更流程（禁止绕过）

任何技术栈变更必须：

1. 明确变更原因
2. 列出影响范围
3. 评估迁移成本
4. 得到明确允许

---

## 15. 终极技术原则

> **技术栈是基础设施，不是创作空间**

---

End of Tech Stack Specification
