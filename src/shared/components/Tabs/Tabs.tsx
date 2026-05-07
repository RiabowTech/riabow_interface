import cx from "classnames";
import { ReactNode, useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";

import { useDesignSystem } from "shared/context/DesignSystemContext/DesignSystemContext";

import NestedTab from "./NestedTab";
import RegularTab from "./RegularTab";
import { isNestedOption, Option, BaseOptionValue, RegularOption } from "./types";

import "./Tabs.css";

type Props<V extends BaseOptionValue> = {
  options: Option<V>[];
  selectedValue: V | undefined;
  onChange?: (value: V) => void;
  size?: "l" | "m";
  /**
   * `primit-big-tab`：Primit 第 9 章 Big_Tab（40px、ac-15、选中底边线），见 `BigTab` / `primit-big-tab.primit.css`
   */
  type?: "inline" | "block" | "inline-primary" | "primit-big-tab";
  className?: string;
  regularOptionClassname?: string;
  qa?: string;
  rightContent?: ReactNode;
  /** 是否使用统一样式（自动应用 trade-direction-tab--active 类名和隐藏下划线） */
  useUnifiedStyle?: boolean;
  /** block 类型：完全隐藏动画下划线 */
  hideBlockUnderline?: boolean;
  /**
   * 与 useUnifiedStyle 联用：未传时由全局 `useDesignSystem().isPrimit`（`html[data-ui-theme]`）决定；
   * 显式 `"default"` | `"primit"` 可覆盖。
   */
  unifiedStyleVariant?: "default" | "primit";
};

/**
 * @deprecated 请改为从 `shared/ui` 引入：`import { Tabs } from "shared/ui"`.
 * 当前文件保留为兼容层，避免历史引用立即中断。
 */
export default function Tabs<V extends string | number>({
  options,
  selectedValue,
  onChange,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  size = "m",
  type = "block",
  className,
  regularOptionClassname,
  qa,
  rightContent,
  useUnifiedStyle = false,
  hideBlockUnderline = false,
  unifiedStyleVariant,
}: Props<V>) {
  const { isPrimit } = useDesignSystem();
  const effectiveUnifiedVariant =
    unifiedStyleVariant !== undefined ? unifiedStyleVariant : isPrimit ? "primit" : "default";

  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const [underlineStyle, setUnderlineStyle] = useState<{ left: number; width: number } | null>(null);

  const showBlockUnderline =
    type === "block" && !useUnifiedStyle && !hideBlockUnderline;

  // 自动为统一样式的 tabs 添加 active className
  const processedOptions = useMemo(() => {
    if (useUnifiedStyle) {
      return options.map((opt) => {
        if (isNestedOption(opt)) {
          return opt;
        }
        const regularOpt = opt as RegularOption<V>;
        return {
          ...regularOpt,
          className: {
            ...regularOpt.className,
            active: "trade-direction-tab--active",
          },
        };
      });
    }
    return options;
  }, [options, useUnifiedStyle]);

  const updateUnderlinePosition = useCallback(() => {
    if (!showBlockUnderline || !tabsContainerRef.current || selectedValue === undefined) {
      return;
    }

    const container = tabsContainerRef.current;
    const activeTab = container.querySelector(
      `[data-tab-value="${CSS.escape(String(selectedValue))}"]`,
    ) as HTMLElement;

    if (activeTab) {
      const containerRect = container.getBoundingClientRect();
      const tabRect = activeTab.getBoundingClientRect();
      const left = tabRect.left - containerRect.left;
      const width = tabRect.width;

      setUnderlineStyle({ left, width });
    }
  }, [showBlockUnderline, selectedValue]);

  useLayoutEffect(() => {
    const measure = () => {
      updateUnderlinePosition();
      requestAnimationFrame(() => updateUnderlinePosition());
    };
    measure();
    void document.fonts?.ready?.then(measure);

    if (showBlockUnderline) {
      window.addEventListener("resize", updateUnderlinePosition);
      return () => {
        window.removeEventListener("resize", updateUnderlinePosition);
      };
    }
  }, [showBlockUnderline, updateUnderlinePosition, processedOptions, selectedValue]);

  return (
    <div
      ref={tabsContainerRef}
      data-qa={qa}
      data-tabs-type={type}
      data-hide-block-underline={hideBlockUnderline || undefined}
      data-unified-style={useUnifiedStyle || undefined}
      data-unified-variant={useUnifiedStyle && effectiveUnifiedVariant !== "default" ? effectiveUnifiedVariant : undefined}
      className={cx(
        "relative flex items-center justify-between",
        {
          "rounded-t-8": type === "block",
        },
        type === "primit-big-tab" && "min-w-0",
        className,
      )}
    >
      <div
        className={cx("flex w-full", {
          "gap-8": type === "inline" || type === "inline-primary",
          "tabs-row--block": type === "block",
          "min-w-0 shrink-0 gap-1": type === "primit-big-tab",
        })}
      >
        {processedOptions.map((opt) =>
          isNestedOption(opt) ? (
            <NestedTab
              key={opt.label?.toString()}
              option={opt}
              selectedValue={selectedValue}
              onOptionClick={onChange}
            />
          ) : (
            <RegularTab
              key={opt.value}
              option={opt}
              selectedValue={selectedValue}
              onOptionClick={onChange}
              regularOptionClassname={regularOptionClassname}
              type={type}
              dataTabValue={opt.value}
            />
          )
        )}
      </div>

      {showBlockUnderline && underlineStyle && (
        <div
          className="tab-underline-indicator"
          style={{
            left: `${underlineStyle.left}px`,
            width: `${underlineStyle.width}px`,
          }}
        />
      )}

      {rightContent}
    </div>
  );
}
