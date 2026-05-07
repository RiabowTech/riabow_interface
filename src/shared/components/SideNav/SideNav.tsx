import { t } from "@lingui/macro";
import cx from "classnames";
import { ReactNode, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";

import { useLocalStorageSerializeKey } from "lib/localStorage";
import useWallet from "lib/wallets/useWallet";
import { buildAccountDashboardUrl } from "shared/utils/buildAccountDashboardUrl";

import ExternalLink from "components/ExternalLink/ExternalLink";

import CandlestickIcon from "img/ic_candlestick_chart.svg?react";
import CollapseIcon from "img/collapse.svg?react";
import ExpandIcon from "img/expand.svg?react";
import DocsIcon from "img/docs.svg?react";
import KxIcon from "img/ic_kx_2.svg?react";
import EcosystemIcon from "img/ecosystem.svg?react";
import EarnIcon from "img/ic_earn.svg?react";
import HotIcon from "img/ic_hot.svg?react";
import LeaderboardIcon from "img/leaderboard.svg?react";
import logoCompact from "img/home/logo.png";
import logoFull from "img/home/logo-icon.png";
import PieChartIcon from "img/ic_pie_chart.svg?react";
import PointsIcon from "img/ic_points.svg?react";
import PoolsIcon from "img/database.svg?react";
import PortfolioIcon from "img/ic_portfolio.svg?react";
import ReferralsIcon from "img/referrals.svg?react";
import ApiKeyIcon from "img/ic_lock.svg?react";
import TradeIcon from "img/ic_10000x.svg?react";

import { LanguageNavItem } from "./LanguageNavItem";

function SideNav({ className }: { className?: string }) {
  const [isCollapsed, setIsCollapsed] = useLocalStorageSerializeKey("is-side-nav-collapsed", false);

  const handleCollapseToggle = useCallback(() => {
    setIsCollapsed(!isCollapsed);
  }, [isCollapsed, setIsCollapsed]);

  return (
    <nav
      className={cx(
        "flex h-full shrink-0 flex-col bg-slate-950 rounded-tr-[20px] rounded-br-[20px] primit-sidenav",
        className,
        {
          "w-[210px] max-xl:w-[184px]": !isCollapsed,
          "w-[60px]": isCollapsed, // 收缩时固定宽度，避免宽度变化影响主内容区域
        }
      )}
    >
      <div className="primit-sidenav-right-line" />
      <div className="flex w-full justify-start">
        <LogoSection isCollapsed={isCollapsed} />
      </div>

      <div className="flex flex-1 flex-col justify-between">
        <MenuSection isCollapsed={isCollapsed} />

        <ul className="flex list-none flex-col px-0">
          <LanguageNavItem isCollapsed={isCollapsed} />
          {/* TODO: Enable Docs nav when ready
          <DocsNavItem isCollapsed={isCollapsed} />
          */}
          <NavItem
            icon={isCollapsed ? <ExpandIcon /> : <CollapseIcon />}
            label={isCollapsed ? t`Expand` : t`Collapse`}
            isCollapsed={isCollapsed}
            onClick={handleCollapseToggle}
          />
        </ul>
      </div>
    </nav>
  );
}

export const DocsNavItem = ({ isCollapsed }: { isCollapsed: boolean | undefined }) => (
  <NavItem icon={<DocsIcon />} label={t`Docs`} isCollapsed={isCollapsed} to="https://docs.primit.io" external />
);

export function LogoSection({ isCollapsed }: { isCollapsed: boolean | undefined }) {
  return (
    <Link
      to="/"
      className={cx(
        "flex cursor-pointer items-start gap-5 pb-24 pt-12 pl-16 pr-20 text-typography-primary"
      )}
    >
      <div className="flex h-20 items-center justify-start shrink-0">
        <img
          src={isCollapsed ? logoCompact : logoFull}
          alt="Primit Logo"
          className={cx(
            "logo-glow object-contain",
            isCollapsed ? "h-20" : "h-20"
          )}
        />
      </div>
      {/* 暂时不显示文字，避免导航宽度变化时出现挤压和换行 */}
    </Link>
  );
}

export interface NavItemProps {
  icon: ReactNode;
  label: ReactNode;
  badge?: ReactNode;
  isActive?: boolean;
  isCollapsed: boolean | undefined;
  onClick?: () => void;
  to?: string;
  external?: boolean;
}

export function NavItem({ icon, label, badge, isActive = false, isCollapsed = false, onClick, to, external }: NavItemProps) {
  const button = (
    <button className={cx("group cursor-pointer select-none py-1", { "w-full": !isCollapsed })} onClick={onClick}>
      <div
        className={cx(
          "relative flex cursor-pointer items-center gap-10 rounded-[10px] px-16 py-14 transition-colors duration-200",
          {
            "bg-[#262626] text-[#00FFB2]": isActive,
            "text-slate-100 hover:bg-[#1b1b1b]": !isActive,
            "w-full": !isCollapsed,
          }
        )}
      >
        <div
          className={cx(
            "flex size-20 shrink-0 items-center justify-center [&>svg]:w-full transition-colors duration-200",
            isActive ? "text-[#00FFB2]" : "text-slate-300 group-hover:text-[#00FFB2]"
          )}
        >
          {icon}
        </div>
        <div className={cx("flex items-center gap-6", { hidden: isCollapsed })}>
          <span
            className={cx(
              // 不允许在收缩/展开动画过程中换行，避免文字“交易 / Earn”等抖动
              "shrink-0 whitespace-nowrap text-[14px] font-chakraPetch font-bold tracking-[0.1em] uppercase",
              isActive ? "text-[#00FFB2]" : "text-slate-200"
            )}
          >
            {label}
          </span>
          {badge && (
            <div className="flex items-center justify-center shrink-0">
              {badge}
            </div>
          )}
        </div>

        {isActive ? (
          <div className="pointer-events-none absolute right-1 top-2 bottom-2 w-[3px] rounded-full bg-[#00FFB2] shadow-[0_0_10px_rgba(0,255,178,0.9)]" />
        ) : null}
      </div>
    </button>
  );

  const content = to ? (
    external ? (
      <ExternalLink className="w-full !no-underline" href={to}>
        {button}
      </ExternalLink>
    ) : (
      <Link to={to}>{button}</Link>
    )
  ) : (
    button
  );

  // 左右留出 2px 间距，让选中背景与侧边栏边框之间有细微空隙
  return <li className="p-0 px-[3px] first:-mt-4">{content}</li>;
}

export function MenuSection({
  isCollapsed,
  onMenuItemClick,
}: {
  isCollapsed: boolean | undefined;
  onMenuItemClick?: () => void;
}) {
  const { account, chainId } = useWallet();
  const { pathname } = useLocation();
  
  // Build Portfolio URL based on wallet connection status
  const portfolioUrl = account && chainId 
    ? buildAccountDashboardUrl(account, chainId, 2)
    : "/accounts";

  const mainNavItems = [
    // { icon: <CandlestickIcon className="size-24" />, label: t`Trade`, key: "trade", to: "/trade" },
    { icon: <KxIcon className="size-24" />, label: t`Trade`, key: "trade", to: "/trade" },
    { icon: <EarnIcon className="size-24" />, label: t`Earn`, key: "earn", to: "/earn", badge: <HotIcon /> },
    { icon: <ReferralsIcon className="size-24" />, label: t`Referrals`, key: "referrals", to: "/referrals" },
    { icon: <LeaderboardIcon className="size-24" />, label: t`Leaderboard`, key: "leaderboard", to: "/leaderboard" },
    { icon: <PortfolioIcon className="size-24" />, label: t`Portfolio`, key: "portfolio", to: portfolioUrl },
    { icon: <PointsIcon className="size-24" />, label: t`Points`, key: "points", to: "/points" },
    { icon: <ApiKeyIcon className="size-24" />, label: t`API Keys`, key: "api-keys", to: "/keys" },
    // { icon: <EcosystemIcon className="size-24" />, label: t`Ecosystem`, key: "ecosystem", to: "/ecosystem" }, // Ecosystem nav commented out
  ];

  return (
    <ul className="flex list-none flex-col px-0">
      {mainNavItems.map((item) => {
        // Special handling for Portfolio menu to highlight when on /accounts or /accounts/:account
        const isActive = item.key === "portfolio"
          ? pathname.startsWith("/accounts")
          : pathname === item.to || pathname.startsWith(`${item.to}/`);

        return (
          <NavItem
            key={item.key}
            icon={item.icon}
            label={item.label}
            badge={item.badge}
            isActive={isActive}
            isCollapsed={isCollapsed}
            to={item.to}
            onClick={onMenuItemClick}
          />
        );
      })}
    </ul>
  );
}

export default SideNav;
