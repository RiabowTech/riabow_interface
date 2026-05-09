import { Trans } from "@lingui/macro";
import { useLingui } from "@lingui/react";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import cx from "classnames";
import { useCallback, useEffect, useRef, useState } from "react";
import { NavLink } from "react-router-dom";

import { useZanbaraAuth } from "@/modules/lighter/api/custom/useZanbaraAuth";
import { useSettings } from "@/modules/lighter/context/SettingsContext";
import { useTradingAccountModalOpen } from "@/modules/lighter/context/TradingAccountContext";
import logoIcon from "@/shared/img/logo-icon.png";
import { dynamicActivate } from "@/shared/lib/i18n";
import { sendUserAnalyticsConnectWalletClickEvent } from "@/shared/lib/userAnalytics/utils";
import useWallet from "@/shared/lib/wallets/useWallet";

import Button from "components/Button/Button";
import ConnectWalletButton from "components/ConnectWalletButton/ConnectWalletButton";
import { OneClickButton } from "components/OneClickButton/OneClickButton";

import WalletIcon from "img/ic_wallet.svg?react";

import styles from "./TopNav.module.scss";

/**
 * 顺序/命名与 3013 ZanbaraTradeHeaderNav 一致。label 全大写由 SCSS 的
 * `.link { text-transform: uppercase }` 统一处理，这里保留 Title case 原文。
 */
const NAV_ITEMS: {
  to?: string;
  href?: string;
  labelKey: "Futures" | "Spot" | "Earn" | "Portfolio" | "Leaderboard" | "Referrals" | "Points" | "VIP";
}[] = [
  { to: "/futures", labelKey: "Futures" },
  { to: "/spot", labelKey: "Spot" },
  // { to: "/earn", labelKey: "Earn" },
  { to: "/accounts/", labelKey: "Portfolio" },
  // { to: "/leaderboard/", labelKey: "Leaderboard" },
  { to: "/referrals", labelKey: "Referrals" },
  // { to: "/points", labelKey: "Points" },
  { to: "/vip", labelKey: "VIP" },
];

const LANGUAGE_OPTIONS = [
  { key: "en", label: "English" },
  { key: "zh", label: "繁體中文" },
] as const;

export function TopNav() {
  const { i18n } = useLingui();
  const { active, account } = useWallet();
  const { setIsSettingsVisible } = useSettings();
  const [, setTradingAccountModalOpen] = useTradingAccountModalOpen();
  const { openConnectModal, connectModalOpen } = useConnectModal();
  const { isAuthenticated, isAuthenticating, authenticate, clearError } = useZanbaraAuth();
  const [isLanguageOpen, setIsLanguageOpen] = useState(false);
  const [isLanguageSwitching, setIsLanguageSwitching] = useState(false);
  const languageRef = useRef<HTMLDivElement>(null);
  const isConnected = Boolean(active && account);

  const handleConnectWallet = useCallback(() => {
    if (!openConnectModal) return;
    if (active || account) return;
    if (connectModalOpen) return;
    sendUserAnalyticsConnectWalletClickEvent("Header");
    openConnectModal();
  }, [openConnectModal, active, account, connectModalOpen]);

  const handleLanguageToggle = useCallback(() => {
    setIsLanguageOpen((prev) => !prev);
  }, []);

  const handleLanguageSelect = useCallback(
    async (locale: string) => {
      if (locale === i18n.locale || isLanguageSwitching) {
        setIsLanguageOpen(false);
        return;
      }

      setIsLanguageSwitching(true);
      try {
        await dynamicActivate(locale);
      } finally {
        setIsLanguageSwitching(false);
        setIsLanguageOpen(false);
      }
    },
    [i18n.locale, isLanguageSwitching]
  );

  const handleAuthenticate = useCallback(async () => {
    clearError();
    await authenticate();
  }, [authenticate, clearError]);

  const handleOpenTradingAccountModal = useCallback(() => {
    if (!isConnected) return;
    setTradingAccountModalOpen(true);
  }, [isConnected, setTradingAccountModalOpen]);

  useEffect(() => {
    if (!isLanguageOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!languageRef.current?.contains(event.target as Node)) {
        setIsLanguageOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isLanguageOpen]);

  return (
    <nav className={styles.root}>
      <a
        href="https://ztdx.io/"
        target="_blank"
        rel="noopener noreferrer"
        className={styles.logo}
        aria-label="Zanbara home"
      >
        <img src={logoIcon} alt="Zanbara" className={cx(styles.logoImage, "logo-glow")} />
        <span className="gold-gradient-text text-xl font-bold tracking-wider">Zanbara</span>
      </a>
      <div className={styles.nav}>
        {NAV_ITEMS.map((item) => {
          const label =
            item.labelKey === "Futures" ? (
              <Trans id="nav.futures">Futures</Trans>
            ) : item.labelKey === "Spot" ? (
              <Trans id="nav.spot">Spot</Trans>
            ) : item.labelKey === "Earn" ? (
              <Trans>Earn</Trans>
            ) : item.labelKey === "Portfolio" ? (
              <Trans>Portfolio</Trans>
            ) : item.labelKey === "Leaderboard" ? (
              <Trans>Leaderboard</Trans>
            ) : item.labelKey === "Referrals" ? (
              <Trans>Referrals</Trans>
            ) : item.labelKey === "Points" ? (
              <Trans>Points</Trans>
            ) : (
              <Trans>VIP</Trans>
            );

          return item.to ? (
            <NavLink key={item.labelKey} to={item.to} className={styles.link} activeClassName={styles.active}>
              {label}
            </NavLink>
          ) : (
            <a key={item.labelKey} href={item.href} className={styles.link}>
              {label}
            </a>
          );
        })}
      </div>
      <div className={cx(styles.right, styles.rightDense)}>
        <div className={styles.langWrap} ref={languageRef}>
          <Button
            type="button"
            variant="secondary"
            size="controlled"
            className={cx(styles.langTrigger, styles.langBtn)}
            aria-label="language"
            aria-expanded={isLanguageOpen}
            onClick={handleLanguageToggle}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 21 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M2.75 10H17.75" />
              <path d="M10.25 2.5C12.3 4.7 13.5 7.3 13.5 10s-1.2 5.3-3.25 7.5C8.2 15.3 7 12.7 7 10s1.2-5.3 3.25-7.5Z" />
              <circle cx="10.25" cy="10" r="7.5" />
            </svg>
            <svg
              className={cx(styles.caret, isLanguageOpen && styles.caretOpen)}
              width="12"
              height="12"
              viewBox="0 0 256 256"
              fill="currentColor"
            >
              <path d="M213.66,101.66l-80,80a8,8,0,0,1-11.32,0l-80-80A8,8,0,0,1,53.66,90.34L128,164.69l74.34-74.35a8,8,0,0,1,11.32,11.32Z" />
            </svg>
          </Button>
          {isLanguageOpen ? (
            <div className={styles.langMenu}>
              <div className={styles.langMenuHeader}>
                <span>Language</span>
                <svg
                  className={styles.langMenuHeaderIcon}
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M15 13.5L11.5 6.5L8 13.5" />
                  <path d="M9 11.5H14" />
                  <path d="M6 2V3.5" />
                  <path d="M2 3.5H10" />
                  <path d="M8 3.5C8 5.0913 7.36786 6.61742 6.24264 7.74264C5.11742 8.86786 3.5913 9.5 2 9.5" />
                  <path d="M4.34192 5.5C4.75558 6.67001 5.52186 7.68297 6.53519 8.39935C7.54853 9.11572 8.75906 9.50026 10 9.5" />
                </svg>
              </div>
              {LANGUAGE_OPTIONS.map((item) => {
                const isActive = i18n.locale === item.key;
                return (
                  <button
                    key={item.key}
                    className={cx(styles.langItem, isActive && styles.langItemActive)}
                    onClick={() => handleLanguageSelect(item.key)}
                    disabled={isLanguageSwitching}
                  >
                    <span>{item.label}</span>
                    {isActive ? (
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
        {!isConnected ? (
          <>
            <OneClickButton openSettings={() => setIsSettingsVisible(true)} />
            <ConnectWalletButton onClick={handleConnectWallet}>
              <Trans>Connect wallet</Trans>
            </ConnectWalletButton>
          </>
        ) : (
          <>
            <OneClickButton openSettings={() => setIsSettingsVisible(true)} />
            {!isAuthenticated ? (
              <Button
                type="button"
                variant="secondary"
                size="controlled"
                className={styles.authButton}
                onClick={handleAuthenticate}
                disabled={isAuthenticating}
              >
                <span className={styles.authStatusDot} />
                <span>{isAuthenticating ? <Trans>Signing...</Trans> : <Trans>SIGN</Trans>}</span>
              </Button>
            ) : null}
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className={styles.walletButton}
              onClick={handleOpenTradingAccountModal}
              aria-label="wallet"
            >
              <WalletIcon className={styles.walletIcon} />
            </Button>
          </>
        )}
      </div>
    </nav>
  );
}
