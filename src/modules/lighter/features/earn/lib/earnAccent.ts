import { useDesignSystem } from "shared/context/DesignSystemContext/DesignSystemContext";

const EARN_ACCENT_LEGACY = "#EBB800";

/** 与 `PrimitColors.css` 中 html.dark / :root 的 --primit-primary-1 一致（供 Recharts 等无法用 CSS 变量的场景） */
export function useEarnAccentHex(): string {
  const { isPrimit, colorScheme } = useDesignSystem();
  if (!isPrimit) {
    return EARN_ACCENT_LEGACY;
  }
  return colorScheme === "dark" ? "#87d7ea" : "#037788";
}

export function rgbFromHex(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "").slice(0, 6);
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}
