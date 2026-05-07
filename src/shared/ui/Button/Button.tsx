/**
 * Primit 对齐的基础按钮（Storybook / 新界面试点）
 *
 * 对应文档：docs/design/PRIMIT-07-BUTTON.md
 * — MainBtn_40（Figma `119-1124`）· IconBtn_40 · Small TabBtn 24
 *
 *
 * 生产与 Storybook「Primit」稿面样式：`styles/themes/primit/button.primit.css`（经 `app/theme/component-themes.ts` 加载）。
 * Storybook 切 DEX / Prediction / RWA：`Button.storybook-classic-skins.css` 覆盖为圆角 + 实色经典产品按钮（仍用各皮肤 `--ui-*`）。
 */

import React from "react";
import { Link } from "react-router-dom";

import { primitGuidelinesFigmaUrl } from "../../docs/primit/primitFigmaNodes";

import "./Button.storybook-classic-skins.css";

/** Figma MainBtn / IconBtn 的 Style；Tab 仅使用 main | secondary */
export type PrimitButtonIntent = "main" | "secondary" | "connected" | "third";

/** 三类组件规格（PRIMIT §1–§3） */
export type PrimitButtonAppearance = "main-40" | "icon-40" | "tab-24";

/** MainBtn_40 + intent main 时的金 / 青绿外环与 Hover（Points 卡片等，Figma 168:4189） */
export type PrimitMainButtonAccent = "yellow" | "green";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * SPA 内链：渲染为 `react-router` 的 `Link`，与 `button` 共用同一套 Primit 外形类名。
   * 外部 URL 请用普通 `href`（若后续扩展）或包裹层；勿与 `type=submit` 同用。
   */
  routerTo?: string;
  /**
   * 旧版语义（默认仍兼容 Storybook 既有示例）：
   * — primary → intent main；secondary → intent secondary；outline / ghost →弱化为线框/幽灵
   */
  variant?: "primary" | "secondary" | "outline" | "ghost";
  /** 旧版尺寸：md ≈ MainBtn 40；sm ≈ Tab 24；lg ≈ 更高主按钮 */
  size?: "sm" | "md" | "lg" | "icon";
  /** 显式 Primit 规格（若设置，优先于 size 推导 appearance） */
  appearance?: PrimitButtonAppearance;
  /** Primit Style（Main / Secondary / Connected / Third） */
  intent?: PrimitButtonIntent;
  /**
   * 仅对 `appearance="main-40"` 且 intent 为 main（含 legacy `primary` 映射）生效：
   * 哑光金 / 青绿 0.5px 环、左侧竖条与 Hover 渐变。
   */
  mainAccent?: PrimitMainButtonAccent;
  /** MainBtn：前置 / 后置图标（由父级传入 SVG 或组件） */
  iconStart?: React.ReactNode;
  iconEnd?: React.ReactNode;
  /** Tab 24：选中态 */
  tabSelected?: boolean;
  loading?: boolean;
  children?: React.ReactNode;
}

/** Design 插件用 Figma 节点（MainBtn_40） */
export const PRIMIT_BUTTON_FIGMA_URL = primitGuidelinesFigmaUrl("119-1124");
/** IconBtn_40 */
export const PRIMIT_ICON_BUTTON_FIGMA_URL = primitGuidelinesFigmaUrl("119-1450");
/** SmallTabBtn（Size=24 等） */
export const PRIMIT_TAB_BUTTON_FIGMA_URL = primitGuidelinesFigmaUrl("147-337");

function resolveAppearance(
  appearance: PrimitButtonAppearance | undefined,
  size: ButtonProps["size"],
): PrimitButtonAppearance {
  if (appearance) return appearance;
  if (size === "icon") return "icon-40";
  if (size === "sm") return "tab-24";
  return "main-40";
}

function resolveIntent(variant: ButtonProps["variant"], intent: PrimitButtonIntent | undefined): PrimitButtonIntent {
  if (intent) return intent;
  switch (variant) {
    case "secondary":
      return "secondary";
    case "outline":
      return "secondary";
    case "ghost":
      return "third";
    default:
      return "main";
  }
}

export const Button = React.forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(function PrimitUIButton(
  {
    variant = "primary",
    size = "md",
    appearance: appearanceProp,
    intent: intentProp,
    mainAccent,
    iconStart,
    iconEnd,
    tabSelected = false,
    loading = false,
    disabled = false,
    children,
    className = "",
    type = "button",
    routerTo,
    ...props
  },
  ref,
) {
  const appearance = resolveAppearance(appearanceProp, size);
  const intent = resolveIntent(variant, intentProp);
  const isOutline = variant === "outline" && !intentProp;
  const isGhost = variant === "ghost" && !intentProp;

  const accentClass =
    appearance === "main-40" && intent === "main" && mainAccent
      ? `primit-ui-button--accent-${mainAccent}`
      : "";

  const classes = [
    "primit-ui-button",
    `primit-ui-button--${appearance}`,
    `primit-ui-button--intent-${intent}`,
    accentClass,
    tabSelected && appearance === "tab-24" ? "primit-ui-button--tab-selected" : "",
    isOutline ? "primit-ui-button--outline-compat" : "",
    isGhost ? "primit-ui-button--ghost-compat" : "",
    loading ? "primit-ui-button--loading" : "",
    disabled || loading ? "primit-ui-button--disabled" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const showText = appearance !== "icon-40" && children != null && children !== false;
  const heightClass =
    appearance === "main-40" && size === "lg" ? "primit-ui-button--main-tall" : "";
  const hasLeadingIcon = Boolean(iconStart);
  const hasTrailingIcon = Boolean(iconEnd);
  const mainPadCompact =
    appearance === "main-40" && (hasLeadingIcon || hasTrailingIcon) ? "primit-ui-button--main-40-pad-compact" : "";
  const mainDualIcons =
    appearance === "main-40" && hasLeadingIcon && hasTrailingIcon
      ? "primit-ui-button--main-40-dual-icons"
      : "";

  const soloIcon = appearance === "icon-40" ? (iconStart ?? children) : null;

  const rootClassName = `${classes} ${heightClass} ${mainPadCompact} ${mainDualIcons}`.trim();

  const inner = (
    <>
      {loading && <span className="primit-ui-button__spinner" aria-hidden />}
      <span className="primit-ui-button__inner">
        {appearance === "icon-40" ? (
          soloIcon != null && soloIcon !== false ? (
            <span className="primit-ui-button__icon primit-ui-button__icon--solo">{soloIcon}</span>
          ) : null
        ) : appearance === "main-40" ? (
          <>
            <span
              className={[
                "primit-ui-button__main-row",
                hasLeadingIcon && hasTrailingIcon ? "primit-ui-button__main-row--tight" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {iconStart ? (
                <span className="primit-ui-button__icon primit-ui-button__icon--start">{iconStart}</span>
              ) : null}
              {showText ? <span className="primit-ui-button__label">{children}</span> : null}
            </span>
            {iconEnd ? <span className="primit-ui-button__icon primit-ui-button__icon--end">{iconEnd}</span> : null}
          </>
        ) : (
          <>
            {iconStart ? (
              <span className="primit-ui-button__icon primit-ui-button__icon--start">{iconStart}</span>
            ) : null}
            {showText ? <span className="primit-ui-button__label">{children}</span> : null}
            {iconEnd ? <span className="primit-ui-button__icon primit-ui-button__icon--end">{iconEnd}</span> : null}
          </>
        )}
      </span>
    </>
  );

  if (routerTo) {
    const isDisabled = disabled || loading;
    const {
      onClick: onClickFromProps,
      style: styleFromProps,
      type: _omitType,
      ...propsRestForButton
    } = props;
    return (
      <Link
        innerRef={ref as React.Ref<HTMLAnchorElement>}
        to={routerTo}
        className={rootClassName}
        aria-disabled={isDisabled}
        tabIndex={isDisabled ? -1 : undefined}
        style={styleFromProps}
        onClick={(e) => {
          if (isDisabled) {
            e.preventDefault();
            return;
          }
          onClickFromProps?.(e as unknown as React.MouseEvent<HTMLButtonElement>);
        }}
        {...(propsRestForButton as Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "onClick" | "children">)}
      >
        {inner}
      </Link>
    );
  }

  return (
    <button
      ref={ref as React.Ref<HTMLButtonElement>}
      type={type}
      className={rootClassName}
      disabled={disabled || loading}
      {...props}
    >
      {inner}
    </button>
  );
});

Button.displayName = "PrimitUIButton";

export default Button;
