import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { useLocation } from "react-router-dom";

import { APP_UI_THEME_MODE_KEY } from "config/localStorage";
import { useTheme } from "shared/context/ThemeContext/ThemeContext";
import { useLocalStorageSerializeKey } from "lib/localStorage";
import { isPrimitAppShellPath } from "shared/lib/isPrimitAppShellPath";

export type DesignSystem = "primit" | "legacy";
export type DesignSystemMode = "auto" | "primit" | "legacy";

export type DesignSystemContextValue = {
  /** 当前解析后的界面体系（路由 + 可选用户覆盖） */
  designSystem: DesignSystem;
  isPrimit: boolean;
  /** 与 `ThemeProvider` 一致：Primit 色板在 `PrimitColors.css` 中随 `html.dark` 切换 */
  colorScheme: "light" | "dark";
  /** `auto` = 按 `isPrimitAppShellPath`；`primit` / `legacy` 为全局强制，供后续设置页切换 */
  designSystemMode: DesignSystemMode;
  setDesignSystemMode: (mode: DesignSystemMode) => void;
};

const DesignSystemContext = createContext<DesignSystemContextValue | null>(null);

function readInitialColorScheme(): "light" | "dark" {
  if (typeof document === "undefined") {
    return "light";
  }
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function readDesignSystemFromDom(): DesignSystem {
  if (typeof document === "undefined") {
    return "legacy";
  }
  return document.documentElement.getAttribute("data-ui-theme") === "primit" ? "primit" : "legacy";
}

function noopSetMode(_mode: DesignSystemMode) {
  /* 无 Provider 时（如单测）；真实写入由 DesignSystemProvider 提供 */
}

function getFallbackDesignSystemValue(): DesignSystemContextValue {
  const designSystem = readDesignSystemFromDom();
  return {
    designSystem,
    isPrimit: designSystem === "primit",
    colorScheme: readInitialColorScheme(),
    designSystemMode: "auto",
    setDesignSystemMode: noopSetMode,
  };
}

export function useDesignSystem(): DesignSystemContextValue {
  const ctx = useContext(DesignSystemContext);
  if (ctx) {
    return ctx;
  }
  return getFallbackDesignSystemValue();
}

export function DesignSystemProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { theme: colorScheme } = useTheme();
  const [designSystemMode, setDesignSystemMode] = useLocalStorageSerializeKey<DesignSystemMode>(
    APP_UI_THEME_MODE_KEY,
    "auto"
  );

  const mode = designSystemMode ?? "auto";

  const designSystem: DesignSystem = useMemo(() => {
    if (mode === "primit") {
      return "primit";
    }
    if (mode === "legacy") {
      return "legacy";
    }
    return isPrimitAppShellPath(pathname) ? "primit" : "legacy";
  }, [mode, pathname]);

  useEffect(() => {
    document.documentElement.setAttribute("data-ui-theme", designSystem);
  }, [designSystem]);

  const value = useMemo<DesignSystemContextValue>(
    () => ({
      designSystem,
      isPrimit: designSystem === "primit",
      colorScheme,
      designSystemMode: mode,
      setDesignSystemMode,
    }),
    [colorScheme, designSystem, mode, setDesignSystemMode]
  );

  return <DesignSystemContext.Provider value={value}>{children}</DesignSystemContext.Provider>;
}
