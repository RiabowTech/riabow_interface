import type { ReactNode } from "react";

import type { ButtonProps as PrimitUIButtonProps } from "shared/ui/Button/Button";

type LegacyVariant = "primary" | "primary-action" | "secondary" | "link" | "ghost";
type LegacySize = "small" | "medium" | "controlled" | "icon";

export function mapLegacyVariantToPrimit(
  variant: LegacyVariant,
): NonNullable<PrimitUIButtonProps["variant"]> {
  if (variant === "ghost") return "ghost";
  if (variant === "secondary") return "secondary";
  return "primary";
}

export function mapLegacySizeToPrimit(
  variant: LegacyVariant,
  size: LegacySize,
): NonNullable<PrimitUIButtonProps["size"]> {
  if (size === "icon") return "icon";
  if (variant === "primary-action") {
    if (size === "medium") return "lg";
    return "md";
  }
  if (size === "small") return "md";
  return "md";
}

export function buildPrimitIconStart(
  imgSrc: string | undefined,
  imgAlt: string,
  imgClassName: string | undefined,
): ReactNode {
  if (!imgSrc) return undefined;
  return <img className={imgClassName} src={imgSrc} alt={imgAlt} />;
}
