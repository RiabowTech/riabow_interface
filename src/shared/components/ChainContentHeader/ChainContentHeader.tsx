import cx from "classnames";
import { ReactNode } from "react";

import { AppHeader } from "components/AppHeader/AppHeader";
import { AppHeaderLogo } from "components/AppHeader/AppHeaderLogo";
import { ChainDataImage } from "components/ChainDataImage";
import TooltipWithPortal from "components/Tooltip/TooltipWithPortal";

import "./ChainContentHeader.scss";

export function ChainContentHeader({
  breadcrumbs,
  leftContentClassName,
  chainId,
  title,
  tooltipContent,
}: {
  breadcrumbs?: React.ReactNode;
  leftContentClassName?: string;
  chainId?: number;
  title?: ReactNode;
  tooltipContent?: ReactNode;
}) {
  const titleElement = title ? (
    tooltipContent ? (
      <TooltipWithPortal
        handle={<div className="ChainContentHeader-title">{title}</div>}
        renderContent={() => tooltipContent}
        position="bottom-start"
        maxAllowedWidth={400}
        variant="none"
      />
    ) : (
      <div className="ChainContentHeader-title">{title}</div>
    )
  ) : null;

  return (
    <>
      <AppHeader
        leftContent={
          <div className={cx("flex items-center gap-16", leftContentClassName)}>
            <AppHeaderLogo />
            <div className="flex items-center gap-16 max-md:hidden">
              {breadcrumbs}
              <ChainDataImage chainId={chainId} />
              {titleElement}
            </div>
          </div>
        }
      />
      <div className={cx("flex items-center gap-12 p-8 md:hidden", leftContentClassName)}>
        <ChainDataImage />
        {breadcrumbs}
        {titleElement}
      </div>
    </>
  );
}
