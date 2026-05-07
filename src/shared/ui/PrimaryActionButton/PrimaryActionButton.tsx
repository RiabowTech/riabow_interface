/**
 * PrimaryActionButton 组件
 *
 * 封装现有的 `components/Button/Button` 的 `primary-action` 变体，
 * 与 Referrals 页面「Submit / Connect Wallet」按钮样式一致：
 * - 黑底 + 绿色渐变描边
 * - 发光效果
 * - Messina Sans 字体 + 大写 + letter-spacing
 */

import React from "react";
import cx from "classnames";

import Button from "components/Button/Button";

type BaseButtonProps = React.ComponentProps<typeof Button>;

export type PrimaryActionButtonProps = Omit<
  BaseButtonProps,
  "variant" | "textAlign"
> & {
  /** 是否占满父容器宽度（默认 false） */
  fullWidth?: boolean;
  /** 按钮尺寸（默认 "medium"） */
  size?: "small" | "medium" | "large" | "controlled";
};

export function PrimaryActionButton({
  fullWidth = false,
  size = "medium",
  className,
  ...rest
}: PrimaryActionButtonProps) {
  return (
    <Button
      variant="primary-action"
      size={size}
      textAlign="center"
      className={cx(fullWidth && "w-full", className)}
      {...rest}
    />
  );
}

export default PrimaryActionButton;

