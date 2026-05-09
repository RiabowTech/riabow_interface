import cx from "classnames";
import React, { HTMLProps, MouseEvent as ReactMouseEvent, ReactNode, RefObject, useMemo } from "react";

import { Button as ZanbaraUIButton, type ZanbaraMainButtonAccent } from "shared/ui/Button/Button";
import { useDesignSystem } from "shared/context/DesignSystemContext/DesignSystemContext";

import ButtonLink from "./ButtonLink";
import { buildZanbaraIconStart, mapLegacySizeToZanbara, mapLegacyVariantToZanbara } from "./mapLegacyButtonToZanbara";

import "./Button.scss";

type ButtonVariant = "primary" | "primary-action" | "secondary" | "link" | "ghost";

type ButtonProps = Omit<HTMLProps<HTMLButtonElement>, "size"> & {
  children: ReactNode;
  variant: ButtonVariant;
  className?: string;
  textAlign?: "center" | "left" | "right";
  disabled?: boolean;
  onClick?: (event: ReactMouseEvent) => void;
  to?: string;
  type?: "button" | "submit" | "reset";
  imgSrc?: string;
  imgAlt?: string;
  imgClassName?: string;
  /** Primit MainBtn：金 / 青绿强调环（见 `themes/primit/button.primit.css`） */
  mainAccent?: ZanbaraMainButtonAccent;
  newTab?: boolean;
  showExternalLinkArrow?: boolean;
  buttonRef?: RefObject<HTMLButtonElement>;
  /** `icon` → Zanbara IconBtn_40（顶栏齿轮等纯图标） */
  size?: "small" | "medium" | "controlled" | "icon";
  qa?: string;
};

/**
 * 默认委托到 `shared/ui/Button`（Zanbara 稿面）。
 * Zanbara 界面主题下，内部路由 `to` 使用 Zanbara `Link`（与纯按钮同形）；外链仍用 `ButtonLink`。
 * Legacy 界面主题下，带 `to` 仍用 `ButtonLink` + SCSS。
 * Storybook 切到 DEX / Prediction / RWA 时由 `Button.storybook-classic-skins.css` 覆盖为产品线经典外形与配色。
 */
export default function Button({
  variant,
  disabled,
  onClick,
  children,
  textAlign = "center",
  to,
  className,
  imgSrc,
  imgAlt = "",
  imgClassName = "",
  mainAccent,
  type = "button",
  newTab,
  buttonRef,
  showExternalLinkArrow: showExternalLinkArrowOverride,
  size = "small",
  qa,
  ...rest
}: ButtonProps) {
  const { isZanbara } = useDesignSystem();

  const isHttpLikeTo =
    Boolean(to) &&
    (to!.startsWith("http://") || to!.startsWith("https://") || to!.startsWith("//"));

  /** Zanbara：无路由或与壳同主题的站内 `to` 走 Zanbara 按钮/链；外链或 Legacy+to 走经典 ButtonLink */
  const useZanbaraUi =
    variant !== "link" && (!to || (isZanbara && Boolean(to) && !isHttpLikeTo));

  const classNames = cx("button", variant, className, textAlign, {
    "px-12 py-8 text-[13px] min-h-32": variant === "primary-action" && size === "small",
    "px-24 py-18 text-16 min-h-40": variant === "primary-action" && size === "medium",
    "px-32 py-20 text-18 min-h-48": variant === "primary-action" && size === "large",
    "px-12 py-8 text-[13px] max-md:px-10 max-md:py-6": variant !== "primary-action",
    "min-h-32 gap-4 px-12 py-8 text-[13px]": size === "small" && variant !== "primary-action",
    "min-h-40 gap-6": size === "medium" && variant !== "primary-action",
  });
  const showExternalLinkArrow = showExternalLinkArrowOverride ?? variant === "secondary";

  const img = useMemo(() => {
    if (!imgSrc) {
      return null;
    }

    return <img className={cx("btn-image", imgClassName)} src={imgSrc} alt={imgAlt} />;
  }, [imgSrc, imgAlt, imgClassName]);

  function handleClick(event: ReactMouseEvent) {
    if (disabled || !onClick) {
      return;
    }

    if (onClick) {
      onClick(event);
    }
  }

  if (useZanbaraUi) {
    const { style: restStyle, ...restForZanbara } = rest;
    const zanbaraVariant = mapLegacyVariantToZanbara(variant);
    const zanbaraSize = mapLegacySizeToZanbara(variant, size);
    const iconStart = buildZanbaraIconStart(imgSrc, imgAlt, imgClassName ? cx("btn-image", imgClassName) : "btn-image");
    const mergedStyle =
      textAlign && textAlign !== "center"
        ? { ...(typeof restStyle === "object" && restStyle ? restStyle : {}), textAlign }
        : restStyle;

    const routerTo = to && !isHttpLikeTo ? to : undefined;

    return (
      <ZanbaraUIButton
        {...restForZanbara}
        ref={buttonRef as React.Ref<HTMLButtonElement & HTMLAnchorElement>}
        data-qa={qa}
        type={type}
        variant={zanbaraVariant}
        size={zanbaraSize}
        className={className}
        disabled={disabled}
        onClick={onClick ? handleClick : undefined}
        iconStart={iconStart}
        mainAccent={mainAccent}
        style={mergedStyle}
        routerTo={routerTo}
      >
        {children}
      </ZanbaraUIButton>
    );
  }

  if (to) {
    return (
      <ButtonLink
        ref={buttonRef as React.Ref<HTMLAnchorElement>}
        className={classNames}
        to={to}
        onClick={onClick}
        newTab={newTab}
        showExternalLinkArrow={showExternalLinkArrow}
        disabled={disabled}
        qa={qa}
        {...rest}
      >
        {img}
        {children}
      </ButtonLink>
    );
  }

  if (onClick) {
    return (
      <button
        data-qa={qa}
        ref={buttonRef}
        type={type}
        className={classNames}
        onClick={handleClick}
        disabled={disabled}
        {...rest}
      >
        {img}
        {children}
      </button>
    );
  }

  return (
    <button data-qa={qa} ref={buttonRef} type={type} className={classNames} disabled={disabled} {...rest}>
      {img}
      {children}
    </button>
  );
}
