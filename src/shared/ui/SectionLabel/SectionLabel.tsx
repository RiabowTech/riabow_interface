import cx from "classnames";
import type { ReactNode } from "react";

import pillLightLeft from "../../img/zanbara-figma/pill-light-left.svg";
import pillLightRight from "../../img/zanbara-figma/pill-light-right.svg";
import pillStar from "../../img/zanbara-figma/pill-star.svg";

import "./SectionLabel.css";

export type SectionLabelProps = {
  children: ReactNode;
  className?: string;
  /** 与落地页 `ZanbaraSectionPill` 一致，中间星标 */
  showStar?: boolean;
};

/**
 * 新版首页（Landing V4 `ZanbaraSectionPill`）同源：两侧青光条 + 可选星标 + 渐变字。
 * 容器为 **直角**，用于 Earn / Points 等与 Zanbara 壳一致的区块标题。
 */
export function SectionLabel({ children, className, showStar = true }: SectionLabelProps) {
  return (
    <div className={cx("zanbara-section-label", className)}>
      <div className="zanbara-section-label__cap zanbara-section-label__cap--left" aria-hidden>
        <img src={pillLightLeft} alt="" />
      </div>
      {showStar ? <img src={pillStar} alt="" className="zanbara-section-label__star" /> : null}
      <span className="zanbara-section-label__text">{children}</span>
      <div className="zanbara-section-label__cap zanbara-section-label__cap--right" aria-hidden>
        <img src={pillLightRight} alt="" />
      </div>
    </div>
  );
}

export default SectionLabel;
