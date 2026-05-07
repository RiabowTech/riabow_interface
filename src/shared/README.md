# Shared 共享代码层

此目录存放**无业务逻辑**的工程化工具代码。

## 目录结构

```
shared/
├── hooks/      # 共享 hooks（如 useAuth、useTheme）
├── lib/        # 共享工具函数、utils、constants
├── types/      # 共享类型定义（如通用接口）
├── locales/    # 共享国际化文件
└── utils/      # 纯逻辑工具（格式化、校验）
```

## 使用规则

🚫 **禁止行为**：
- 禁止在此添加任何业务逻辑
- 禁止引用 `modules/` 下的任何代码
- 如果 shared 中的函数不满足某模块需求，在该模块内新建，不要修改 shared

✅ **允许内容**：
- 纯函数工具（如日期格式化、数字处理）
- 通用 UI hooks（如 useMediaQuery、useLocalStorage）
- 通用类型定义
