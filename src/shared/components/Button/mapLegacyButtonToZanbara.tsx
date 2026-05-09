import type { ReactNode } from "react";

import type { ButtonProps as ZanbaraUIButtonProps } from "shared/ui/Button/Button";

type LegacyVariant = "primary" | "primary-action" | "secondary" | "link" | "ghost";
type LegacySize = "small" | "medium" | "controlled" | "icon";

export function mapLegacyVariantToZanbara(
  variant: LegacyVariant,
): NonNullable<ZanbaraUIButtonProps["variant"]> {
  if (variant === "ghost") return "ghost";
  if (variant === "secondary") return "secondary";
  return "primary";
}

export function mapLegacySizeToZanbara(
  variant: LegacyVariant,
  size: LegacySize,
): NonNullable<ZanbaraUIButtonProps["size"]> {
  if (size === "icon") return "icon";
  if (variant === "primary-action") {
    if (size === "medium") return "lg";
    return "md";
  }
  if (size === "small") return "md";
  return "md";
}

export function buildZanbaraIconStart(
  imgSrc: string | undefined,
  imgAlt: string,
  imgClassName: string | undefined,
): ReactNode {
  if (!imgSrc) return undefined;
  return <img className={imgClassName} src={imgSrc} alt={imgAlt} />;
}
