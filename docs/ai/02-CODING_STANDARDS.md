## 编码标准

# React Coding Standards (For Claude Code)

> 本文档是 **逐行代码级别的强制编码标准**  
> Claude Code 在实现任何 React / TypeScript 代码时 **必须严格遵守**  
> 本文档优先级仅次于《Architecture Guide》

---

## 1. 通用编码原则（最高优先级）

### 1.1 三个“必须先满足”

写任何代码前，必须满足：

1. **可读性优先**
2. **类型安全优先**
3. **未来可维护优先**

> ❌ 禁止为了“少写代码 / 图省事”牺牲以上原则

---

### 1.2 禁止“聪明代码”

以下行为一律禁止：

- 过度链式调用
- 隐式副作用
- 依赖 JS 隐式类型转换
- 需要读三遍才能懂的写法

```ts
// ❌ 禁止
const value = foo && bar && baz()

// ✅ 推荐
if (!foo || !bar) return
baz()
```

## 2. 文件与命名规范（强制）

### 2.1 文件命名

| 类型       | 规则              | 示例                       |
| -------- | --------------- | ------------------------ |
| React 组件 | PascalCase      | `OrderBook.tsx`          |
| Hooks    | camelCase + use | `useOrderBookData.ts`    |
| 工具函数     | camelCase       | `formatPrice.ts`         |
| 类型定义     | camelCase       | `orderBook.types.ts`     |
| 常量       | kebab / camel   | `orderBook.constants.ts` |

❌ 禁止：

- index.tsx（除非 re-export）

- utils.ts

- helper.ts

- common.ts

### 2.2 变量命名

- 必须 语义完整

- 禁止缩写（除非领域标准）

```typescript
// ❌
const d = data
const fn = fetchData

// ✅
const orderBookData = data
const fetchOrderBook = fn
```

## 3. React 组件编码规范

### 3.1 组件职责限制

一个组件 只能承担一种职责：

- UI 渲染

- 布局

- 交互容器

❌ 禁止：

- UI + 数据请求

- UI + 业务计算

- UI + WebSocket

### 3.2 Props 规范

- Props 必须显式 typing

- 禁止隐式 children

```typescript
// ❌
function Card(props) {}

// ✅
type CardProps = {
  title: string
  children: React.ReactNode
}

function Card({ title, children }: CardProps) {}
```

### 3.3 JSX 中的规则

JSX 中 只允许：

- 简单条件渲染

- 简单 map

- 样式 class 组合

```typescript
// ❌ 禁止
{price > lastPrice * 1.1 ? '🔥' : '⬇️'}

// ✅
const isHot = isPriceHot(price, lastPrice)
{isHot ? '🔥' : '⬇️'}
```

## 4. Hooks 编码标准（重点）

### 4.1 useEffect 使用规则（强约束）

只有以下情况可以使用 useEffect：

- 订阅 / 取消订阅

- 请求副作用

- 同步外部系统

❌ 禁止：

- 派生状态

- 数据转换

- 替代计算

```typescript
// ❌
useEffect(() => {
  setTotal(price * amount)
}, [price, amount])

// ✅
const total = useMemo(() => price * amount, [price, amount])
```

### 4.2 Hooks 内部结构（推荐模板）

```typescript
export function useOrderBookData() {
  // 1. state
  // 2. external hooks
  // 3. derived data
  // 4. handlers
  // 5. return
}
```
顺序不得随意调整

## 5. 状态与数据处理规范

### 5.1 禁止 Derived State

```typescript
// ❌
const [total, setTotal] = useState(0)

// ✅
const total = useMemo(() => calcTotal(price, amount), [price, amount])
```

### 5.2 不可变数据原则

- 不允许直接修改对象 / 数组

- Zustand / Redux 内同样适用（除非明确使用 immer）

## 6. 类型系统硬性规则（TypeScript）

### 6.1 any / unknown 规则

- ❌ 禁止 any
- unknown 使用后 必须缩小类型

```typescript
if (typeof value === 'string') {}
```

### 6.2 类型边界原则

- API 层：DTO

- 业务层：Model

- UI 层：Props

```typescript
// ❌ 禁止 DTO 直通 UI
```

## 7. 工具函数（utils）规范

### 7.1 utils 必须是纯函数

- 相同输入 → 相同输出

- 禁止：
  - 访问 store
  - 访问 window / document
  - console.log

### 7.2 命名必须体现“意图”

```typescript
// ❌
calc(a, b)

// ✅
calculateOrderTotal(price, quantity)
```

## 8. 性能相关硬性要求

### 8.1 渲染期禁止重计算

- BigNumber
- 精度处理
- 排序
- 聚合

```typescript
// ❌ render 中 sort
// ✅ hook 中 memo
```

## 8.2 key 规则

- 禁止使用 index 作为 key
- key 必须稳定、业务唯一

## 9. 错误处理规范

- API 错误必须显式处理
- 不允许静默失败
- 不允许 catch 后什么都不做

```typescript
catch (error) {
  reportError(error)
}
```

## 10. Claude Code 行为标准（非常重要）

Claude Code 在每次输出代码前必须：

- 简述本次修改目标

- 列出新增 / 修改文件

- 说明是否符合本规范

Claude Code 禁止：

- 为了“先跑起来”而违反规范

- 在未说明原因的情况下合并职责

- 输出无法维护的“一次性代码”

## 11. 自检清单（Claude 必须执行）

在输出最终代码前，Claude Code 必须确认：

- [ ]组件是否只做 UI

- [ ]业务逻辑是否在 hook / service

- [ ]是否存在 derived state

- [ ]是否存在 render 中计算

- [ ]是否存在 any

- [ ]是否破坏架构分层

## 12. 终极编码信条

“写给下一个接手你代码的人，而不是写给编译器”
