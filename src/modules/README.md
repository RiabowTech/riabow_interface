# Modules 业务层

当前仓库的业务实现只保留 `lighter`。

## 目录结构

```text
modules/
└── lighter/    # 当前交易主域
```

## 原则

- 业务实现放在 `modules/lighter`
- 通用能力放在 `shared`
- 不再引入 `dex` / `cex` 模块路径

## 入口示例

```tsx
// modules/lighter/pages/LighterTradePage.tsx
<div className="lighter-scope">
  {/* 交易页面内容 */}
</div>
```
