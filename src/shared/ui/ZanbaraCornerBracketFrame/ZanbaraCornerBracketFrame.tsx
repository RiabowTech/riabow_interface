import cx from "classnames";
import React from "react";

import "./ZanbaraCornerBracketFrame.css";

export type ZanbaraCornerBracketLayout = "tl-br" | "all";

export type ZanbaraCornerBracketFrameProps = {
  children: React.ReactNode;
  /**
   * 为 true 时渲染 L 角与 hover 收紧动效；
   * 为 false 时仅渲染 children，无包裹层。
   */
  enabled?: boolean;
  /**
   * `tl-br`：主按钮常用，仅左上 + 右下；
   * `all`：顶栏等全框四角。
   */
  layout?: ZanbaraCornerBracketLayout;
  className?: string;
};

/**
 * Zanbara L 形角饰（lighter.xyz 式 bracket）：默认左上+右下；`layout="all"` 为四角。
 */
export function ZanbaraCornerBracketFrame({
  children,
  enabled = true,
  layout = "tl-br",
  className,
}: ZanbaraCornerBracketFrameProps) {
  if (!enabled) {
    return <>{children}</>;
  }

  const isAll = layout === "all";

  return (
    <div
      className={cx(
        "zanbara-corner-bracket-frame",
        isAll && "zanbara-corner-bracket-frame--all",
        className,
      )}
    >
      <span className="zanbara-corner-bracket-frame__corners" aria-hidden>
        <svg
          className="zanbara-corner-bracket-frame__corner zanbara-corner-bracket-frame__corner--tl"
          viewBox="0 0 4 4"
          overflow="visible"
          focusable="false"
        >
          <path
            d="M 0 4 L 0 0 L 4 0"
            fill="none"
            stroke="currentColor"
            strokeLinecap="square"
            strokeLinejoin="bevel"
            vectorEffect="nonScalingStroke"
          />
        </svg>
        <svg
          className="zanbara-corner-bracket-frame__corner zanbara-corner-bracket-frame__corner--br"
          viewBox="0 0 4 4"
          overflow="visible"
          focusable="false"
        >
          <path
            d="M 0 4 L 4 4 L 4 0"
            fill="none"
            stroke="currentColor"
            strokeLinecap="square"
            strokeLinejoin="bevel"
            vectorEffect="nonScalingStroke"
          />
        </svg>
        {isAll ? (
          <>
            <svg
              className="zanbara-corner-bracket-frame__corner zanbara-corner-bracket-frame__corner--tr"
              viewBox="0 0 4 4"
              overflow="visible"
              focusable="false"
            >
              <path
                d="M 0 0 L 4 0 L 4 4"
                fill="none"
                stroke="currentColor"
                strokeLinecap="square"
                strokeLinejoin="bevel"
                vectorEffect="nonScalingStroke"
              />
            </svg>
            <svg
              className="zanbara-corner-bracket-frame__corner zanbara-corner-bracket-frame__corner--bl"
              viewBox="0 0 4 4"
              overflow="visible"
              focusable="false"
            >
              <path
                d="M 0 0 L 0 4 L 4 4"
                fill="none"
                stroke="currentColor"
                strokeLinecap="square"
                strokeLinejoin="bevel"
                vectorEffect="nonScalingStroke"
              />
            </svg>
          </>
        ) : null}
      </span>
      {children}
    </div>
  );
}
