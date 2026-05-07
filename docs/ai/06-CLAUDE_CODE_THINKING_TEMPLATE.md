# Claude Code Thinking & Self-Review Template

> 本文档用于 **强制 Claude Code 的思考流程**  
> 目标是：
> - 防止乱写代码
> - 防止职责混乱
> - 防止“能跑但不可维护”
>
> 本文档优先级：
> Claude Code 行为规范 > Coding Standards > Architecture Guide > 其他任何指示

---

## 一、写代码前：强制思考模板（Before Coding）

Claude Code **在写任何代码前，必须完整执行以下步骤**，并以文字形式输出结论。

---

### Step 1：明确需求本质（禁止直接写代码）

Claude Code 必须回答：

1. 这是一个：
   - UI 组件？
   - 业务 Feature？
   - Hook？
   - Service / API？
2. 这是 **新增** 还是 **修改**？
3. 是否影响已有 Feature？

> ❌ 未回答清楚不得写代码

---

### Step 2：职责边界确认（强制）

Claude Code 必须明确说明：

- 本次代码 **只做什么**
- 明确列出 **不做什么**

示例：

```txt
本次代码：
✅ 只负责 order book 数据的整理与排序
❌ 不负责 UI 渲染
❌ 不负责 WebSocket 连接
❌ 不负责全局状态管理
```

---

### Step 3：架构位置确认（非常重要）

Claude Code 必须指出代码放置位置：

- 文件路径：

- 所属层级：

  - Page / Feature / Component / Hook / Service / Store / Utils

- 是否符合 Architecture Guide 的分层原则

> ❌ 不允许“写完再决定放哪”

---

### Step 4：数据与状态设计

Claude Code 必须明确：

1. 数据来源：
   - API
   - WebSocket
   - Props
   - Store
2. 状态分类：
   - UI State
   - Derived Data
   - Business State

3. 是否存在：
   - Derived State（如存在，必须说明为什么不可避免）

---

### Step 5：类型边界设计（TypeScript）

Claude Code 必须列出：

- DTO（如有）
- 业务 Model
- Props / Return Types

并明确说明：
> ❌ DTO 是否会直接进入 UI（默认不允许）

---

### Step 6：性能影响评估（必须）

Claude Code 必须回答：

- 是否涉及：
  - 列表渲染
  - 高频更新
  - 排序 / 聚合 / BigNumber

- 是否需要：
  - useMemo
  - useCallback
  - 数据预处理（脱离 render）

---

### Step 7：失败与异常路径

Claude Code 必须说明：

- API 失败如何处理
- 数据为空 / 异常的兜底策略
- 是否需要 error boundary 或 fallback UI

## 二、编码中：强制约束（During Coding）

Claude Code 在写代码时必须遵守：

- 不跨层 import

- 不在 JSX 中写业务逻辑

- 不在 render 中做计算

- 不创建“未来可能用到”的代码

- 不提前抽象

> 原则：现在合理 > 未来幻想

## 三、写代码后：强制自检模板（After Coding）

Claude Code 在输出最终代码前，必须逐条自检并明确回答：

✅ 架构自检

- [ ]是否严格遵守目录结构
- [ ]是否有跨 Feature 依赖
- [ ]是否破坏分层（UI / 业务 / 数据）

✅ React 自检

- [ ]是否存在滥用 useEffect

- [ ]是否存在 derived state

- [ ]是否在 render 中进行计算 / 排序

- [ ]key 是否稳定且业务唯一

 ✅ TypeScript 自检

- [ ]是否存在 any

- [ ]unknown 是否已正确收窄

- [ ]类型命名是否语义清晰

✅ 可维护性自检（非常重要）

Claude Code 必须回答：

- [ ]6 个月后他人是否能快速理解？

- [ ]是否存在“我知道但代码看不出来”的隐含逻辑？

- [ ]是否有必要拆分得更清晰？

✅ 反模式扫描（必须否定）

Claude Code 必须明确确认 不存在以下问题：

- ❌ 一个组件干多件事

- ❌ 一个 hook 管所有事情

- ❌ utils 里掺业务逻辑

- ❌ 为了省代码而牺牲清晰度

---

## 四、最终输出格式（强制）

Claude Code 最终输出必须按以下顺序：

- 1.本次改动目标（1–2 行）

- 2.涉及文件列表（含路径）

- 3.关键设计决策说明

- 4.代码实现

- 5.自检确认（引用本模板）

> ❌ 不允许只输出代码

---

## 五、最高行为准则（不可违背）

> Claude Code 不是在“帮忙写代码”，而是在“参与长期维护的工程”

如果存在冲突：

- 1.架构正确性

- 2.可维护性

- 3.类型安全

- 4.性能

- 5.代码量
