import type { ReactNode } from "react";

import BaseTabs from "shared/components/Tabs/Tabs";
import type { BaseOptionValue, Option } from "shared/components/Tabs/types";

export type TabsProps<V extends BaseOptionValue> = {
  options: Option<V>[];
  selectedValue: V | undefined;
  onChange?: (value: V) => void;
  size?: "l" | "m";
  type?: "inline" | "block" | "inline-primary" | "primit-big-tab";
  className?: string;
  regularOptionClassname?: string;
  qa?: string;
  rightContent?: ReactNode;
  useUnifiedStyle?: boolean;
  hideBlockUnderline?: boolean;
  /** 未传时由全局 `useDesignSystem().isPrimit` 决定 */
  unifiedStyleVariant?: "default" | "primit";
};

export function Tabs<V extends BaseOptionValue>(props: TabsProps<V>) {
  return <BaseTabs<V> {...props} />;
}

export default Tabs;
