import cx from "classnames";

import { CHAIN_ID_TO_NETWORK_ICON } from "config/icons";
import { tryImportImage } from "lib/legacy";

import "./TokenIcon.scss";

function getIconUrlPath(symbol) {
  if (!symbol) return;

  return `ic_${symbol.toLowerCase()}.svg`;
}

// Fallback component when icon is not found - displays first letter of symbol
function FallbackIcon({
  symbol,
  displaySize,
  className,
}: {
  symbol: string;
  displaySize: number;
  className?: string;
}) {
  const letter = symbol?.charAt(0)?.toUpperCase() || "?";
  const fontSize = Math.max(10, displaySize * 0.5);

  return (
    <span
      className={cx(
        "Token-icon inline-flex items-center justify-center rounded-full bg-slate-600 text-white font-medium",
        className
      )}
      style={{
        width: displaySize,
        height: displaySize,
        fontSize: fontSize,
      }}
      data-qa="token-icon-fallback"
    >
      {letter}
    </span>
  );
}

type Props = {
  symbol: string;
  displaySize: number;
  className?: string;
  badge?: string | readonly [topSymbol: string, bottomSymbol: string];
  chainIdBadge?: number;
  badgeClassName?: string;
};

function TokenIcon({ className, symbol, displaySize, badge, badgeClassName, chainIdBadge }: Props) {
  const iconPath = getIconUrlPath(symbol);
  const classNames = cx("Token-icon inline rounded-full", className);

  if (!iconPath) return <></>;

  // Try to get the image, returns undefined if not found
  const imageSrc = tryImportImage(iconPath);

  let sub;
  let containerClassName = "";

  if (badge) {
    if (typeof badge === "string") {
      sub = (
        <span
          className={cx(
            "pointer-events-none absolute -bottom-8 -right-8 z-10 rounded-20 bg-slate-700 px-6 py-2 text-12 font-medium text-typography-secondary",
            badgeClassName
          )}
        >
          {badge}
        </span>
      );
    } else {
      const badge0Path = getIconUrlPath(badge[0]);
      const badge1Path = getIconUrlPath(badge[1]);
      const badge0Src = badge0Path ? tryImportImage(badge0Path) : undefined;
      const badge1Src = badge1Path ? tryImportImage(badge1Path) : undefined;

      sub = (
        <span
          className={cx(
            "absolute -bottom-8 -right-8 flex flex-row items-center justify-center text-typography-secondary",
            badgeClassName
          )}
        >
          {badge0Src ? (
            <img
              className="z-20 -mr-10 rounded-[100%] border-2 border-slate-900 bg-slate-900"
              src={badge0Src}
              alt={badge[0]}
              width={20}
              height={20}
            />
          ) : (
            <FallbackIcon symbol={badge[0]} displaySize={20} className="z-20 -mr-10 border-2 border-slate-900" />
          )}
          {badge1Src ? (
            <img
              className="z-10 rounded-[100%] border-2 border-slate-900 bg-slate-900"
              src={badge1Src}
              alt={badge[1]}
              width={20}
              height={20}
            />
          ) : (
            <FallbackIcon symbol={badge[1]} displaySize={20} className="z-10 border-2 border-slate-900" />
          )}
        </span>
      );
    }
  } else if (chainIdBadge !== undefined) {
    let size: number;
    let offset: string;

    if (displaySize >= 40) {
      size = 16;
      offset = "-bottom-0 -right-4";
      containerClassName = "token-icon-with-badge-large";
    } else {
      size = 10;
      offset = "-bottom-2 -right-2";
      containerClassName = "token-icon-with-badge-small";
    }
    sub = (
      <img
        src={CHAIN_ID_TO_NETWORK_ICON[chainIdBadge]}
        width={size}
        height={size}
        className={cx("absolute  z-10 box-content rounded-full bg-slate-900", offset)}
      />
    );
  }

  // Use fallback if image not found
  const img = imageSrc ? (
    <img
      data-qa="token-icon"
      className={sub ? containerClassName : classNames}
      src={imageSrc}
      alt={symbol}
      width={displaySize}
      height={displaySize}
    />
  ) : (
    <FallbackIcon symbol={symbol} displaySize={displaySize} className={sub ? containerClassName : classNames} />
  );

  if (!sub) {
    return img;
  }

  return (
    <span className={cx("relative", className)}>
      {img}
      {sub}
    </span>
  );
}

export default TokenIcon;
