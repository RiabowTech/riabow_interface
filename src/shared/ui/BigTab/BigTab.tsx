import cx from "classnames";
import React from "react";

import { primitGuidelinesFigmaUrl } from "../../docs/primit/primitFigmaNodes";

/** Figma 第 9 章 · Big_Tab 大标签选项 / Item（`152-691`） */
export const PRIMIT_BIG_TAB_ITEM_FIGMA_URL = primitGuidelinesFigmaUrl("152-691");

export type BigTabProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  /** 选中：主色文案 + 2px 底边线；未选中为同色宽透明底边占位，避免切换抖动 */
  selected?: boolean;
};

/**
 * 大标签 Tab 单项（订单簿 Order book / Trades 等大 Tab）。
 * 样式见 `themes/primit/primit-big-tab.primit.css`（随 `component-themes` 加载）。
 */
export const BigTab = React.forwardRef<HTMLButtonElement, BigTabProps>(function BigTab(
  { selected = false, className, type = "button", children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled}
      aria-pressed={selected}
      className={cx("BigTab", selected && "BigTab--selected", className)}
      {...rest}
    >
      <span className="BigTab-label">{children}</span>
    </button>
  );
});
