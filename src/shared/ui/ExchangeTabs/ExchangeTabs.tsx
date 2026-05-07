/**
 * ExchangeTabs 组件
 *
 * 基于 trade 页 Positions / Orders / Trades 这一类列表 Tabs 抽象：
 * - 固定使用 `type="block"`
 * - Primit 壳上 block 稿面见 `styles/themes/primit/tabs.primit.css`（`html[data-ui-theme="primit"]` + `html.dark`）
 * - 支持右侧附加操作区域（如批量取消按钮）
 *
 * 推荐用于：交易列表、账户历史、预测市场顶部分类等。
 */

import React from "react";

import { Tabs, type BaseOptionValue, type Option } from "shared/ui";

export type ExchangeTabsProps<V extends BaseOptionValue> = {
  /** 选项配置，直接复用 Tabs 的 Option 类型（label 可以是字符串或 ReactNode） */
  options: Option<V>[];
  /** 当前选中的值 */
  value: V | undefined;
  /** 选中值变化回调 */
  onChange?: (value: V) => void;
  /** data-qa 标记，用于样式和测试（如 `exchange-list-tabs`） */
  qa?: string;
  /** 右侧附加内容（可选） */
  rightContent?: React.ReactNode;
  /** 额外的 className（作用在外层容器上） */
  className?: string;
  /** 传递给 RegularTab 的自定义 className（如圆角控制） */
  regularOptionClassname?: string;
};

export function ExchangeTabs<V extends BaseOptionValue>({
  options,
  value,
  onChange,
  qa,
  rightContent,
  className,
  regularOptionClassname,
}: ExchangeTabsProps<V>) {
  return (
    <Tabs<V>
      options={options}
      selectedValue={value}
      onChange={onChange}
      type="block"
      qa={qa}
      rightContent={rightContent}
      className={className}
      regularOptionClassname={regularOptionClassname}
    />
  );
}

export default ExchangeTabs;

