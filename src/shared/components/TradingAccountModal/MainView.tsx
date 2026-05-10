import { Trans, t } from "@lingui/macro";
import cx from "classnames";
import { type ChangeEvent, useCallback, useMemo, useState } from "react";
import Skeleton from "react-loading-skeleton";
import { useHistory } from "react-router-dom";
import { useCopyToClipboard } from "react-use";
import { parseUnits, getAddress } from "viem";
import { useAccount, usePublicClient } from "wagmi";

import { useZanbaraBalancesForProduct, useZanbaraUserBalances } from "@/modules/lighter/api";
import { confirmWithdraw, spotTransfer } from "@/modules/lighter/api/custom/client";
import { useTradingFundingHistory } from "@/modules/lighter/api/custom/useTradingFundingHistory";
import {
  useTradingAccountModalOpen,
  useTradingAccountSelectedTransferGuid,
} from "@/modules/lighter/context/TradingAccountContext";
import { useSettings } from "@/modules/lighter/context/SettingsContext";
import { useDisconnectAndClose } from "@/modules/lighter/domain/multichain/useDisconnectAndClose";
import { isTradeModeActive, useTradeProduct } from "@/modules/lighter/store/TradeStateContext/TradeStateContext";
import { BOTANIX, getExplorerUrl } from "config/chains";
import { DEFAULT_SPOT_CHAIN_ID, getSpotVaultAddress, getTradingVaultAddress } from "config/custom/contracts";
import VaultAbi from "sdk/abis/Vault";
import SpotVaultAbi from "sdk/abis/SpotVault";
import { isSettlementChain } from "config/multichain";
import { isMultichainFundingItemLoading } from "@/modules/lighter/domain/multichain/isMultichainFundingItemLoading";
import type { MultichainFundingHistoryItem } from "@/modules/lighter/domain/multichain/types";
import { useTradingAccountFundingHistory } from "@/modules/lighter/domain/multichain/useTradingAccountFundingHistory";
import { useChainId } from "lib/chains";
import { formatRelativeDateWithComma, formatDateTime } from "lib/dates";
import { helperToast } from "lib/helperToast";
import { useLocalizedMap } from "lib/i18n";
import { useENS } from "lib/legacy";
import { formatUsd } from "lib/numbers";
import { useBreakpoints } from "lib/useBreakpoints";
import { useNotifyModalState } from "lib/useNotifyModalState";
import { shortenAddressOrEns } from "lib/wallets";
import useWallet from "lib/wallets/useWallet";
import { getToken, getTokenBySymbol } from "sdk/configs/tokens";
import { Token } from "sdk/types/tokens";
import { buildAccountDashboardUrl } from "shared/utils/buildAccountDashboardUrl";
import { findWalletTokenConfig, useWalletTokensConfig, type WalletTokenConfig } from "@/modules/lighter/api/custom/walletTokens";

import { Amount } from "components/Amount/Amount";
import { Avatar } from "components/Avatar/Avatar";
import Button from "components/Button/Button";
import ExternalLink from "components/ExternalLink/ExternalLink";
// import SearchInput from "components/SearchInput/SearchInput";
import { VerticalScrollFadeContainer } from "components/TableScrollFade/VerticalScrollFade";
import TokenIcon from "components/TokenIcon/TokenIcon";
import TooltipWithPortal from "components/Tooltip/TooltipWithPortal";

import BellIcon from "img/ic_bell.svg?react";
import ChevronLeftIcon from "img/ic_chevron_left.svg?react";
import CopyIcon from "img/ic_copy.svg?react";
import DownloadIcon from "img/ic_download2.svg?react";
import ExplorerIcon from "img/ic_explorer.svg?react";
import PnlAnalysisIcon from "img/ic_pnl_analysis.svg?react";
import SettingsIcon from "img/ic_settings.svg?react";
import DisconnectIcon from "img/ic_sign_out_20.svg?react";
import SpinnerIcon from "img/ic_spinner.svg?react";
import SwapIcon from "img/swap.svg?react";

import { SyntheticsInfoRow } from "../SyntheticsInfoRow";

import "./MainView.scss";
import {
  useAvailableToTradeAssetMultichain,
  useAvailableToTradeAssetSettlementChain,
  useAvailableToTradeAssetSymbolsMultichain,
  useAvailableToTradeAssetSymbolsSettlementChain,
} from "./hooks";
import { FUNDING_OPERATIONS_LABELS } from "./keys";

function UsdValueWithSkeleton({ usd }: { usd: bigint | undefined }) {
  return (
    <span className="numbers">
      {usd !== undefined ? (
        formatUsd(usd)
      ) : (
        <Skeleton baseColor="#B4BBFF1A" highlightColor="#B4BBFF1A" width={54} className="leading-base" inline={true} />
      )}
    </span>
  );
}

const TokenIcons = ({ tokens }: { tokens: string[] }) => {
  const displayTokens = tokens.slice(0, 3);

  return (
    <div className="flex items-center">
      {displayTokens.map((token, index) => (
        <div
          key={token}
          className={cx(
            "-ml-6 flex size-14 items-center justify-center rounded-full border border-slate-600 first-of-type:-ml-0"
          )}
          // Safety: its small
          // eslint-disable-next-line react-perf/jsx-no-new-object-as-prop
          style={{
            zIndex: tokens.length - index,
          }}
        >
          <TokenIcon symbol={token} displaySize={18} />
        </div>
      ))}
    </div>
  );
};

function tokenFromWalletConfig(config: WalletTokenConfig): Token {
  return {
    name: config.symbol,
    symbol: config.symbol,
    decimals: config.decimals,
    address: config.contract,
    isStable: config.symbol.toUpperCase().includes("USD"),
  };
}

function getTokenBySymbolOptional(chainId: number | undefined, symbol: string): Token | undefined {
  if (!chainId || !symbol) return undefined;

  try {
    return getTokenBySymbol(chainId, symbol);
  } catch {
    return undefined;
  }
}

function parseUsdStringToBigint(value: string | undefined, decimals = 30) {
  if (!value) return 0n;
  try {
    return parseUnits(value, decimals);
  } catch {
    return 0n;
  }
}

function formatTokenAmountText(value: string | undefined) {
  const numeric = Number(value ?? "0");
  if (!Number.isFinite(numeric)) return value ?? "0.00";
  return numeric.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function findPrimaryBalance<T extends { available: string; total: string }>(balances: T[] | undefined) {
  return balances?.find((balance) => Number(balance.total) > 0 || Number(balance.available) > 0) ?? balances?.[0];
}

function getBalanceSymbol(balance: { symbol?: string; token?: string } | undefined, fallback = "USDT") {
  return balance?.symbol || balance?.token || fallback;
}

function findBalanceBySymbol<T extends { symbol?: string; token?: string }>(balances: T[] | undefined, symbol: string) {
  return balances?.find((balance) => getBalanceSymbol(balance).toUpperCase() === symbol.toUpperCase());
}

function toDisplayUsdAmount(value: string | undefined) {
  return parseUsdStringToBigint(value);
}

function FundingHistoryItemLabel({
  step,
  operation,
  isExecutionError,
}: Pick<MultichainFundingHistoryItem, "step" | "operation" | "isExecutionError">) {
  const labels = useLocalizedMap(FUNDING_OPERATIONS_LABELS);

  const isLoading = isMultichainFundingItemLoading({ operation, step, isExecutionError });

  const key = `${operation}${isExecutionError ? "-failed" : ""}`;
  let text = labels[key] ?? `${operation} ${isExecutionError ? " failed" : ""}`;

  if (isLoading) {
    return (
      <div className="text-body-small flex items-center gap-4 text-slate-100">
        <SpinnerIcon className="size-16 animate-spin" />
        {text}
      </div>
    );
  } else if (isExecutionError) {
    return <div className="text-body-small text-red-500">{text}</div>;
  }

  return <div className="text-body-small text-slate-100">{text}</div>;
}

const Toolbar = ({ account }: { account: string }) => {
  const [, setIsVisible] = useTradingAccountModalOpen();
  const { chainId: settlementChainId, srcChainId } = useChainId();
  const product = useTradeProduct();
  const history = useHistory();

  const { isSmallMobile } = useBreakpoints();
  const chainId = product === "spot" ? DEFAULT_SPOT_CHAIN_ID : srcChainId ?? settlementChainId;

  const { openNotifyModal } = useNotifyModalState();
  const { setIsSettingsVisible } = useSettings();
  const { ensName } = useENS(account);
  const [, copyToClipboard] = useCopyToClipboard();
  const handleDisconnect = useDisconnectAndClose();

  const handleCopyAddress = () => {
    if (account) {
      copyToClipboard(account);
      helperToast.success(t`Address copied to your clipboard`);
    }
  };

  const accountUrl = useMemo(() => {
    if (!account || !chainId) return "";
    return `${getExplorerUrl(chainId)}address/${account}`;
  }, [account, chainId]);

  const handleNotificationsClick = () => {
    openNotifyModal();
    setTimeout(() => {
      setIsVisible(false);
    }, 200);
  };

  const handlePnlAnalysisClick = () => {
    if (!account || !chainId) return;
    history.push(buildAccountDashboardUrl(account, chainId, 2));
    setIsVisible(false);
  };

  const handleSettingsClick = () => {
    setIsSettingsVisible(true);
    setTimeout(() => {
      setIsVisible(false);
    }, 200);
  };

  const handleExplorerClick = useCallback(() => {
    if (!accountUrl) return;
    window.open(accountUrl, "_blank", "noopener,noreferrer");
  }, [accountUrl]);

  const showNotify = settlementChainId !== BOTANIX;
  const buttonClassName = isSmallMobile ? cx("size-32 !p-0") : cx("size-40 !p-0");

  return (
    <div className="wallet-toolbar">
      <Button variant="secondary" size="small" className="wallet-address-button" onClick={handleCopyAddress}>
        <div className="max-[500px]:hidden">
          <Avatar size={24} ensName={ensName} address={account} />
        </div>
        <div className="wallet-address-text">
          {shortenAddressOrEns(ensName || account, 17)}
        </div>
        <CopyIcon className="size-20 max-[500px]:hidden" />
      </Button>
      <div className="wallet-toolbar-actions">
        <TooltipWithPortal content={t`PnL Analysis`} position="bottom" tooltipClassName="!min-w-max" variant="none">
          <Button variant="secondary" size="small" className={buttonClassName} onClick={handlePnlAnalysisClick}>
            <PnlAnalysisIcon width={20} height={20} />
          </Button>
        </TooltipWithPortal>
        <TooltipWithPortal
          shouldPreventDefault={false}
          content={t`View in Explorer`}
          position="bottom"
          tooltipClassName="!min-w-max"
          variant="none"
        >
          <Button
            variant="secondary"
            size="small"
            className={buttonClassName}
            onClick={() => {
              // 走 onClick + window.open:与同排 PnL / Logout 按钮共享 Zanbara 按钮边框样式。
              // 直接传 `to={externalUrl}` 会落到 legacy ButtonLink 分支,导致失去青色 L 角框。
              if (typeof window !== "undefined" && accountUrl) window.open(accountUrl, "_blank", "noopener,noreferrer");
            }}
          >
            <ExplorerIcon />
          </Button>
        </TooltipWithPortal>
        {/* {showNotify && (
          <TooltipWithPortal content={t`Notifications`} position="bottom" tooltipClassName="!min-w-max" variant="none">
            <Button variant="secondary" size="small" className={buttonClassName} onClick={handleNotificationsClick}>
              <BellIcon />
            </Button>
          </TooltipWithPortal>
        )} */}

        {!isTradeModeActive() ? (
          <TooltipWithPortal content={t`Settings`} position="bottom" tooltipClassName="!min-w-max" variant="none">
            <Button variant="secondary" size="small" className={buttonClassName} onClick={handleSettingsClick}>
              <SettingsIcon width={20} height={20} />
            </Button>
          </TooltipWithPortal>
        ) : null}
        <TooltipWithPortal content={t`Disconnect`} position="bottom" tooltipClassName="!min-w-max" variant="none">
          <Button variant="secondary" size="small" className={buttonClassName} onClick={handleDisconnect}>
            <DisconnectIcon />
          </Button>
        </TooltipWithPortal>
      </div>
    </div>
  );
};

function TradingAccountBalanceTooltipContent() {
  return (
    <Trans>
      Your Zanbara Account balance, usable for trading from any supported chain. {/* DOCS_LINK_COMMENTED: */}
      {/* <span className="text-blue-300">Read more</span>. */}
    </Trans>
  );
}

function FrozenBalanceTooltipContent() {
  return (
    <Trans>
      Your frozen balance, locked in open orders and unavailable for trading until the orders are closed or cancelled.
    </Trans>
  );
}

function SettlementChainBalance() {
  const { totalUsd, apiTotalAccountUsd, apiFrozenAccountUsd, walletUsd } = useAvailableToTradeAssetSettlementChain();
  const availableToTradeAssetSymbols = useAvailableToTradeAssetSymbolsSettlementChain();
  return (
    <div className="flex flex-col gap-12 rounded-8 bg-fill-surfaceElevated50 p-12">
      <div className="flex flex-col gap-8">
        <div className="text-body-small text-typography-secondary">
          <Trans>Available to Trade</Trans>
        </div>
        <Balance usd={totalUsd} availableToTradeAssetSymbols={availableToTradeAssetSymbols} />
      </div>
      <div className="h-[0.5px] bg-slate-600" />
      <div>
        <SyntheticsInfoRow
          label={<Trans>Wallet</Trans>}
          className="py-4"
          value={<UsdValueWithSkeleton usd={walletUsd} />}
        />
        <SyntheticsInfoRow
          label={
            <TooltipWithPortal content={<TradingAccountBalanceTooltipContent />} variant="iconStroke">
              <Trans>Zanbara Account Balance</Trans>
            </TooltipWithPortal>
          }
          className="py-4"
          value={<UsdValueWithSkeleton usd={apiTotalAccountUsd} />}
        />
        <SyntheticsInfoRow
          label={
            <TooltipWithPortal content={<FrozenBalanceTooltipContent />} variant="iconStroke">
              <Trans>Zanbara Frozen Balance</Trans>
            </TooltipWithPortal>
          }
          className="py-4"
          value={<UsdValueWithSkeleton usd={apiFrozenAccountUsd} />}
        />
      </div>
    </div>
  );
}

function MultichainBalance() {
  const { tradingAccountUsd } = useAvailableToTradeAssetMultichain();
  const availableToTradeAssetSymbols = useAvailableToTradeAssetSymbolsMultichain();

  return (
    <div className="flex flex-col gap-8 rounded-8 bg-fill-surfaceElevated50 p-12">
      <TooltipWithPortal
        handleClassName="text-body-small text-typography-secondary"
        content={<TradingAccountBalanceTooltipContent />}
        variant="iconStroke"
      >
        <Trans>Balance</Trans>
      </TooltipWithPortal>

      <Balance usd={tradingAccountUsd} availableToTradeAssetSymbols={availableToTradeAssetSymbols} />
    </div>
  );
}

function Balance({
  usd,
  availableToTradeAssetSymbols,
}: {
  usd: bigint | undefined;
  availableToTradeAssetSymbols: string[];
}) {
  const [, setIsVisibleOrView] = useTradingAccountModalOpen();

  const handleAvailableToTradeClick = () => {
    setIsVisibleOrView("availableToTradeAssets");
  };

  return (
    <div className="flex min-h-32 flex-wrap items-center justify-between gap-8">
      {usd !== undefined ? (
        <div className="text-h2 normal-nums leading-[30px]">{formatUsd(usd)}</div>
      ) : (
        <Skeleton
          baseColor="#B4BBFF1A"
          highlightColor="#B4BBFF1A"
          width={100}
          height={30}
          className="!block"
          inline={true}
        />
      )}
      {usd !== undefined && usd !== 0n && (
        <button
          className="flex min-h-32 items-center gap-4 rounded-full bg-slate-600 py-6 pl-12 pr-12 text-[13px] font-medium app-hover:bg-slate-600/90"
          onClick={handleAvailableToTradeClick}
        >
          <Trans>All assets</Trans>
          <TokenIcons tokens={availableToTradeAssetSymbols} />
          <ChevronLeftIcon className="size-16 rotate-180 text-typography-secondary" />
        </button>
      )}
      {usd === undefined && (
        <Skeleton
          baseColor="#B4BBFF1A"
          highlightColor="#B4BBFF1A"
          width={134}
          height={32}
          className="!block"
          inline={true}
        />
      )}
    </div>
  );
}

const BalanceSection = () => {
  const { chainId } = useAccount();
  const isTradeMode = isTradeModeActive();

  // In API trading mode, show Wallet and Zanbara Account Balance using SettlementChainBalance.
  // That path reads backend balances through the trading account balance hooks.
  if (isTradeMode) {
    return <SettlementChainBalance />;
  }

  return isSettlementChain(chainId!) ? <SettlementChainBalance /> : <MultichainBalance />;
};

const ActionButtons = () => {
  const [, setIsVisibleOrView] = useTradingAccountModalOpen();

  const handleDepositClick = () => {
    setIsVisibleOrView("deposit");
  };

  const handleWithdrawClick = () => {
    setIsVisibleOrView("withdraw");
  };

  return (
    <div className="flex gap-12">
      <Button
        variant="secondary"
        size="medium"
        className="flex-1 !text-typography-primary"
        onClick={handleDepositClick}
      >
        <Trans>Deposit</Trans>
      </Button>
      <Button
        variant="secondary"
        size="medium"
        className="flex-1 !text-typography-primary"
        onClick={handleWithdrawClick}
      >
        <Trans>Withdraw</Trans>
      </Button>
    </div>
  );
};

type WalletPane = "spot" | "futures";

const WalletOverview = () => {
  const [, setIsVisibleOrView] = useTradingAccountModalOpen();
  const [activeWallet, setActiveWallet] = useState<WalletPane>("spot");
  const [transferAmount, setTransferAmount] = useState("");
  const [isTransferSubmitting, setIsTransferSubmitting] = useState(false);
  const { chainId: connectedChainId } = useAccount();
  const { chainId: settlementChainId } = useChainId();
  const { apiTotalAccountUsd, apiAccountUsd, apiFrozenAccountUsd } = useAvailableToTradeAssetSettlementChain();
  const spotBalancesResult = useZanbaraBalancesForProduct("spot", settlementChainId, { refreshInterval: 10000 });
  const futuresBalancesResult = useZanbaraBalancesForProduct("futures", connectedChainId ?? settlementChainId, {
    refreshInterval: 10000,
  });
  const spotBalances = spotBalancesResult.data?.balances ?? [];
  const futuresBalances = futuresBalancesResult.data?.balances ?? [];
  const activeBalances = activeWallet === "spot" ? spotBalances : futuresBalances;
  const destinationBalances = activeWallet === "spot" ? futuresBalances : spotBalances;
  const activeBalancesResult = activeWallet === "spot" ? spotBalancesResult : futuresBalancesResult;
  const primaryBalance = findPrimaryBalance(activeBalances);
  const activeUsdtBalance = findBalanceBySymbol(activeBalances, "USDT");
  const destinationUsdtBalance = findBalanceBySymbol(destinationBalances, "USDT");
  const balanceSymbol = getBalanceSymbol(primaryBalance);
  const availableText = formatTokenAmountText(primaryBalance?.available);
  const frozenText = formatTokenAmountText(primaryBalance?.frozen);
  const totalText = formatTokenAmountText(primaryBalance?.total);
  const transferSymbol = "USDT";
  const transferAvailableText = formatTokenAmountText(activeUsdtBalance?.available);
  const transferDestinationAvailableText = formatTokenAmountText(destinationUsdtBalance?.available);
  const availableUsd = primaryBalance !== undefined ? toDisplayUsdAmount(primaryBalance.available) : apiAccountUsd;
  const frozenUsd = primaryBalance !== undefined ? toDisplayUsdAmount(primaryBalance.frozen) : apiFrozenAccountUsd;
  const totalUsd = primaryBalance !== undefined ? toDisplayUsdAmount(primaryBalance.total) : apiTotalAccountUsd;
  const availableToTradeAssetSymbols =
    activeBalances.length > 0
      ? activeBalances.map((balance) => getBalanceSymbol(balance)).filter(Boolean)
      : [balanceSymbol];
  const normalizedTransferAmount = transferAmount.trim();
  const transferAmountNumber = Number(normalizedTransferAmount);
  const transferAvailableBalanceNumber = Number(activeUsdtBalance?.available ?? 0);
  const canTransfer =
    Number.isFinite(transferAmountNumber) &&
    transferAmountNumber > 0 &&
    transferAmountNumber <= transferAvailableBalanceNumber &&
    !isTransferSubmitting;

  const openAssets = () => setIsVisibleOrView("availableToTradeAssets");
  const openDeposit = () => setIsVisibleOrView("deposit");
  const openWithdraw = () => setIsVisibleOrView("withdraw");
  const handleTransferAmountChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.value.replace(/,/g, ".");

    if (/^\d*\.?\d*$/.test(nextValue)) {
      setTransferAmount(nextValue);
    }
  };
  const handleTransfer = async () => {
    if (!canTransfer) return;

    try {
      setIsTransferSubmitting(true);
      await spotTransfer(settlementChainId, {
        token: transferSymbol,
        amount: normalizedTransferAmount,
        direction: activeWallet === "spot" ? "spot_to_perp" : "perp_to_spot",
      });
      helperToast.success(t`Transfer submitted`);
      setTransferAmount("");
      await Promise.all([spotBalancesResult.mutate(), futuresBalancesResult.mutate()]);
    } catch (error) {
      helperToast.error(error instanceof Error ? error.message : t`Transfer failed`);
    } finally {
      setIsTransferSubmitting(false);
    }
  };

  return (
    <div className="trading-wallet-layout">
      <section className="wallet-summary-card">
        <div className="wallet-summary-metric wallet-summary-metric--large">
          <div className="wallet-label-row">
            <span>Total Assets (USD)</span>
            <span className="wallet-eye">◉</span>
          </div>
          <UsdValueWithSkeleton usd={totalUsd ?? apiTotalAccountUsd} />
          <div className="wallet-subvalue">≈ {formatTokenAmountText(primaryBalance?.total)} {balanceSymbol}</div>
        </div>
        <div className="wallet-summary-metric">
          <div className="wallet-label-row">Available Balance</div>
          <UsdValueWithSkeleton usd={availableUsd} />
          <div className="wallet-subvalue">{availableText} {balanceSymbol}</div>
        </div>
        <div className="wallet-summary-metric">
          <div className="wallet-label-row">
            <TooltipWithPortal content={<FrozenBalanceTooltipContent />} variant="iconStroke">
              <span>Frozen Balance</span>
            </TooltipWithPortal>
          </div>
          <UsdValueWithSkeleton usd={frozenUsd} />
          <div className="wallet-subvalue">{frozenText} {balanceSymbol}</div>
        </div>
        <div className="wallet-summary-metric">
          <div className="wallet-label-row">Total Balance</div>
          <UsdValueWithSkeleton usd={totalUsd} />
          <div className="wallet-subvalue">{totalText} {balanceSymbol}</div>
        </div>
      </section>

      <div className="wallet-tabs" role="tablist">
        <button
          type="button"
          className={cx("wallet-tab", activeWallet === "spot" && "wallet-tab--active")}
          onClick={() => setActiveWallet("spot")}
        >
          <DownloadIcon className="wallet-tab-icon" />
          Spot Wallet
        </button>
        <button
          type="button"
          className={cx("wallet-tab", activeWallet === "futures" && "wallet-tab--active")}
          onClick={() => setActiveWallet("futures")}
        >
          <PnlAnalysisIcon className="wallet-tab-icon" />
          Futures Wallet
        </button>
      </div>

      <section className="wallet-assets-card">
        <div className="wallet-assets-head">
          <div>
            <div className="wallet-label-row">
              {activeWallet === "spot" ? "Spot Wallet Assets (USD)" : "Futures Wallet Assets (USD)"}
              <span className="wallet-eye">◉</span>
            </div>
            <UsdValueWithSkeleton usd={totalUsd} />
            <div className="wallet-subvalue">≈ {totalText} {balanceSymbol}</div>
          </div>
          <button type="button" className="wallet-all-assets" onClick={openAssets}>
            <span>All assets</span>
            <TokenIcons tokens={availableToTradeAssetSymbols} />
            <ChevronLeftIcon className="size-16 rotate-180 text-typography-secondary" />
          </button>
        </div>
        <div className="wallet-asset-table">
          <div className="wallet-asset-row wallet-asset-row--header">
            <span>Asset</span>
            <span>Available</span>
            <span>Frozen</span>
            <span>Total</span>
          </div>
          {activeBalances.map((balance) => {
            const symbol = getBalanceSymbol(balance, balanceSymbol);

            return (
              <div className="wallet-asset-row" key={`${activeWallet}-${symbol}-${balance.token}`}>
                <div className="wallet-asset-token">
                  <TokenIcon symbol={symbol} displaySize={48} />
                  <div>
                    <div className="wallet-asset-symbol">{symbol}</div>
                    <div className="wallet-subvalue">{symbol === "USDT" ? "Tether" : symbol}</div>
                  </div>
                </div>
                <div>{formatTokenAmountText(balance.available)}<span>{symbol}</span></div>
                <div>{formatTokenAmountText(balance.frozen)}<span>{symbol}</span></div>
                <div>{formatTokenAmountText(balance.total)}<span>{symbol}</span></div>
              </div>
            );
          })}
          {!activeBalancesResult.isLoading && activeBalances.length === 0 && (
            <div className="wallet-asset-empty">No assets</div>
          )}
        </div>
      </section>

      <section className="wallet-transfer-card">
        <div className="wallet-section-title">
          <SwapIcon className="wallet-section-icon" />
          Transfer {transferSymbol}
        </div>
        <div className="wallet-transfer-grid">
          <div className="wallet-transfer-box">
            <span>From</span>
            <strong>{activeWallet === "spot" ? "Spot Wallet" : "Futures Wallet"}</strong>
            <small>{transferAvailableText} {transferSymbol}</small>
          </div>
          <button type="button" className="wallet-swap-button" onClick={() => setActiveWallet(activeWallet === "spot" ? "futures" : "spot")}>
            <SwapIcon />
          </button>
          <div className="wallet-transfer-box">
            <span>To</span>
            <strong>{activeWallet === "spot" ? "Futures Wallet" : "Spot Wallet"}</strong>
            <small>{transferDestinationAvailableText} {transferSymbol}</small>
          </div>
          <div className="wallet-transfer-amount">
            <label>Amount</label>
            <div className="wallet-transfer-input">
              <input
                aria-label={`Transfer ${transferSymbol} amount`}
                disabled={isTransferSubmitting}
                inputMode="decimal"
                onChange={handleTransferAmountChange}
                placeholder="0.00"
                type="text"
                value={transferAmount}
              />
              <strong>{transferSymbol}</strong>
            </div>
            <small>Available: {transferAvailableText} {transferSymbol}</small>
          </div>
          <Button
            variant="primary-action"
            size="small"
            className="wallet-transfer-submit"
            disabled={!canTransfer}
            onClick={handleTransfer}
          >
            {isTransferSubmitting ? "Transferring" : "Transfer"}
          </Button>
        </div>
      </section>

      <div className="wallet-action-grid">
        <Button variant="secondary" size="medium" className="wallet-action-button" onClick={openDeposit}>
          <DownloadIcon className="wallet-section-icon" />
          Deposit
        </Button>
        <Button variant="secondary" size="medium" className="wallet-action-button" onClick={openWithdraw}>
          <DownloadIcon className="wallet-section-icon wallet-section-icon--up" />
          Withdraw
        </Button>
      </div>
    </div>
  );
};

type DisplayFundingHistoryItem = Omit<MultichainFundingHistoryItem, "token"> & {
  token: Token;
};

type TradingDisplayFundingHistoryItem = {
  id: string;
  product: "futures" | "spot";
  type: "deposit" | "withdraw";
  token: Token;
  amount: bigint;
  tx_hash: string | null;
  status: string;
  created_at: number;
  // Additional fields for withdraw
  nonce?: number;
  expiry?: number;
  backend_signature?: string;
};

const FundingHistorySection = () => {
  const [, setIsVisibleOrView] = useTradingAccountModalOpen();
  // const [searchQuery, setSearchQuery] = useState("");
  const [, setSelectedTransferGuid] = useTradingAccountSelectedTransferGuid();
  const { address: account, chainId } = useAccount();
  const { chainId: settlementChainId } = useChainId();
  const product = useTradeProduct();
  const apiChainId = settlementChainId;
  const spotVaultAddress = getSpotVaultAddress(DEFAULT_SPOT_CHAIN_ID);
  const { data: walletTokenConfigs } = useWalletTokensConfig();
  const { walletClient } = useWallet();
  const futuresPublicClient = usePublicClient({ chainId });
  const spotPublicClient = usePublicClient({ chainId: DEFAULT_SPOT_CHAIN_ID });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isTradeMode = isTradeModeActive();
  const { mutate: mutateBalances } = useZanbaraUserBalances({
    refreshInterval: isTradeMode ? 10000 : 0,
  });

  // Use backend funding history in API trading mode, otherwise use regular multichain funding history.
  // The wallet modal shows both Spot and Futures balances, so funding history must merge both ledgers.
  const futuresTradingFundingHistory = useTradingFundingHistory(
    isTradeMode ? apiChainId : undefined,
    undefined,
    "futures"
  );
  const spotTradingFundingHistory = useTradingFundingHistory(isTradeMode ? apiChainId : undefined, undefined, "spot");
  const regularFundingHistory = useTradingAccountFundingHistory({ enabled: !isTradeMode });
  const tradingFundingHistory = useMemo(() => {
    if (!isTradeMode) {
      return {
        fundingHistory: undefined,
        isLoading: false,
        mutate: () => undefined,
      };
    }

    const fundingHistory = [
      ...(futuresTradingFundingHistory.fundingHistory ?? []),
      ...(spotTradingFundingHistory.fundingHistory ?? []),
    ].sort((a, b) => b.created_at - a.created_at);

    return {
      fundingHistory,
      isLoading: futuresTradingFundingHistory.isLoading || spotTradingFundingHistory.isLoading,
      mutate: () => {
        futuresTradingFundingHistory.mutate();
        spotTradingFundingHistory.mutate();
      },
    };
  }, [futuresTradingFundingHistory, isTradeMode, spotTradingFundingHistory]);

  const fundingHistory = isTradeMode ? undefined : regularFundingHistory.fundingHistory;
  const isLoading = isTradeMode ? tradingFundingHistory.isLoading : regularFundingHistory.isLoading;

  // Convert backend funding history to the local display shape used by the modal.
  const tradingDisplayHistory: TradingDisplayFundingHistoryItem[] | undefined = useMemo(() => {
    if (!isTradeMode || !tradingFundingHistory.fundingHistory) {
      return undefined;
    }

    return tradingFundingHistory.fundingHistory
      .map((item): TradingDisplayFundingHistoryItem | undefined => {
        // API returns token as symbol (e.g., "USDT"), not address
        // Use getTokenBySymbol to find token by symbol
        const spotTokenConfig =
          item.product === "spot" ? findWalletTokenConfig(walletTokenConfigs, DEFAULT_SPOT_CHAIN_ID, item.token) : undefined;
        const token = spotTokenConfig ? tokenFromWalletConfig(spotTokenConfig) : getTokenBySymbolOptional(chainId, item.token);
        if (!token) {
          console.warn(`[FundingHistorySection] Token not found for symbol: ${item.token}`);
          return undefined;
        }

        // Parse amount string to bigint
        const amountBigInt = parseUnits(item.amount, token.decimals);

        return {
          id: item.id,
          product: item.product,
          type: item.type,
          token,
          amount: amountBigInt,
          tx_hash: item.tx_hash,
          status: item.status,
          created_at: item.created_at,
          // Additional fields for withdraw
          nonce: item.nonce,
          expiry: item.expiry,
          backend_signature: item.backend_signature,
        };
      })
      .filter((item): item is TradingDisplayFundingHistoryItem => item !== undefined);
  }, [isTradeMode, tradingFundingHistory.fundingHistory, chainId, walletTokenConfigs]);

  // Regular funding history for non-API trading mode.
  const filteredFundingHistory: DisplayFundingHistoryItem[] | undefined = useMemo(() => {
    if (isTradeMode) {
      return undefined;
    }

    return fundingHistory
      ?.map((transfer): DisplayFundingHistoryItem | undefined => {
        const token = getToken(transfer.settlementChainId, transfer.token);

        if (!token) {
          return undefined;
        }

        return { ...transfer, token };
      })
      .filter((transfer): transfer is DisplayFundingHistoryItem => {
        if (!transfer) {
          return false;
        }

        // const matchesSearch = transfer.token.symbol.toLowerCase().includes(searchQuery.toLowerCase());
        // return matchesSearch;
        return true; // Show all items without search filtering
      });
  }, [isTradeMode, fundingHistory]); // Removed searchQuery from dependencies

  // Filter backend funding history by search query.
  const filteredTradingHistory: TradingDisplayFundingHistoryItem[] | undefined = useMemo(() => {
    if (!isTradeMode || !tradingDisplayHistory) {
      return undefined;
    }

    // Search filtering disabled - return all items
    // return tradingDisplayHistory.filter((item) => {
    //   const matchesSearch = item.token.symbol.toLowerCase().includes(searchQuery.toLowerCase());
    //   return matchesSearch;
    // });
    return tradingDisplayHistory;
  }, [isTradeMode, tradingDisplayHistory]); // Removed searchQuery from dependencies

  // Check if a signed withdrawal item is clickable (not expired)
  const isSignedWithdrawalClickable = (item: TradingDisplayFundingHistoryItem): boolean => {
    if (item.status !== "signed" || item.type !== "withdraw" || !item.expiry || !item.backend_signature) {
      return false;
    }
    const now = Math.floor(Date.now() / 1000);
    return item.expiry > now;
  };

  // Handler for continuing signed withdrawal (calling contract with existing signature)
  const handleSignedWithdrawalContinue = async (item: TradingDisplayFundingHistoryItem) => {
    const itemIsSpotProduct = item.product === "spot";
    const itemContractChainId = itemIsSpotProduct ? DEFAULT_SPOT_CHAIN_ID : chainId;
    const publicClient = itemIsSpotProduct ? spotPublicClient : futuresPublicClient;

    if (!itemContractChainId || !apiChainId || !walletClient || !publicClient || !account) {
      helperToast.error(t`Missing required parameters`);
      return;
    }

    if (!item.backend_signature || !item.expiry || item.amount === undefined) {
      helperToast.error(t`Missing signature or expiry data`);
      return;
    }

    // Check if signature has expired
    const now = Math.floor(Date.now() / 1000);
    if (item.expiry <= now) {
      helperToast.error(t`Signature has expired`);
      return;
    }

    setIsSubmitting(true);
    try {
      // Get vault address
      const vaultAddress = itemIsSpotProduct ? spotVaultAddress : getTradingVaultAddress(itemContractChainId);
      if (!vaultAddress) {
        throw new Error("Vault contract not found");
      }

      // The amount is already in bigint format from item.amount
      const amountInWei = item.amount;
      const deadline = item.expiry;
      const signature = item.backend_signature;
      const spotWithdrawArgs = [
        getAddress(item.token.address),
        amountInWei,
        BigInt(deadline),
        signature as `0x${string}`,
      ] as const;
      const futuresWithdrawArgs = [amountInWei, BigInt(deadline), signature as `0x${string}`] as const;

      // Step 1: Simulate contract call
      try {
        if (itemIsSpotProduct) {
          await publicClient.simulateContract({
            address: vaultAddress as `0x${string}`,
            abi: SpotVaultAbi,
            functionName: "withdraw",
            args: spotWithdrawArgs,
            account: getAddress(account),
          });
        } else {
          await publicClient.simulateContract({
            address: vaultAddress as `0x${string}`,
            abi: VaultAbi,
            functionName: "releaseFunds",
            args: futuresWithdrawArgs,
            account: getAddress(account),
          });
        }
      } catch (simulateError: any) {
        console.error("[FundingHistory] Contract simulation failed:", simulateError);
        throw new Error(simulateError?.shortMessage || "Transaction simulation failed");
      }

      // Step 2: Call contract
      const txHash = itemIsSpotProduct
        ? await walletClient.writeContract({
            address: vaultAddress as `0x${string}`,
            abi: SpotVaultAbi,
            functionName: "withdraw",
            args: spotWithdrawArgs,
            account: getAddress(account),
            chain: publicClient.chain,
          })
        : await walletClient.writeContract({
            address: vaultAddress as `0x${string}`,
            abi: VaultAbi,
            functionName: "releaseFunds",
            args: futuresWithdrawArgs,
            account: getAddress(account),
            chain: publicClient.chain,
          });

      helperToast.success(t`Withdraw transaction submitted`);

      // Wait for confirmation
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

      helperToast.success(t`Withdraw completed successfully`);

      // Confirm with backend
      try {
        await confirmWithdraw(apiChainId, item.id, {
          tx_hash: receipt.transactionHash,
        }, item.product);
      } catch (confirmError) {
        console.warn("[FundingHistory] Failed to confirm withdraw:", confirmError);
      }

      // Refresh balances and history
      if (mutateBalances) {
        mutateBalances();
      }
      tradingFundingHistory.mutate();
    } catch (error: any) {
      console.error("[FundingHistory] Failed to continue withdrawal:", error);
      helperToast.error(error?.message || t`Failed to complete withdrawal`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTransferClick = (transfer: DisplayFundingHistoryItem | TradingDisplayFundingHistoryItem) => {
    console.log("[handleTransferClick] Clicked:", transfer);

    // In API trading mode, check if this is a signed withdrawal that can be continued
    if (isTradeMode && "expiry" in transfer) {
      const item = transfer as TradingDisplayFundingHistoryItem;

      console.log("[handleTransferClick] API trading mode, checking if signed withdrawal:", {
        status: item.status,
        type: item.type,
        hasExpiry: !!item.expiry,
        hasSignature: !!item.backend_signature,
      });

      // Check if this is a signed withdrawal that hasn't expired yet
      if (item.status === "signed" && item.type === "withdraw" && item.expiry && item.backend_signature) {
        const now = Math.floor(Date.now() / 1000);

        if (item.expiry > now) {
          // This is a valid signed withdrawal, continue with contract call
          handleSignedWithdrawalContinue(item);
          return;
        } else {
        }
      }

      // For other API funding items, just log for now
      console.log("[handleTransferClick] Not a valid signed withdrawal, just logging");
      return;
    }

    // Regular funding history (non-API trading mode)
    setSelectedTransferGuid(transfer.id);
    setIsVisibleOrView("transferDetails");
  };

  return (
    <div className="flex grow flex-col gap-12 overflow-visible">
      <div className="flex items-center justify-between px-adaptive">
        <div className="text-body-large font-medium">
          <Trans>Funding Activity</Trans>
        </div>
      </div>
      {/* Search input disabled */}
      {/* {Boolean((isTradeMode ? tradingDisplayHistory : fundingHistory)?.length) && (
        <div className="px-adaptive">
          <SearchInput value={searchQuery} setValue={setSearchQuery} size="m" />
        </div>
      )} */}
      <VerticalScrollFadeContainer className="flex grow flex-col">
        {/* Render backend funding history */}
        {isTradeMode &&
          filteredTradingHistory?.map((item) => {
            const isClickable = isSignedWithdrawalClickable(item);
            const isDisabled = isSubmitting;

            return (
              <div
                role="button"
                tabIndex={0}
                key={item.id}
                className={cx("flex w-full items-center justify-between px-adaptive py-8 text-left -outline-offset-4", {
                  "cursor-pointer app-hover:bg-fill-surfaceElevated50": !isClickable && !isDisabled,
                  "cursor-pointer app-hover:bg-blue-500/10": isClickable && !isDisabled,
                  "cursor-not-allowed opacity-50": isDisabled,
                })}
                onClick={() => {
                  if (!isDisabled) {
                    handleTransferClick(item);
                  }
                }}
              >
                <div className="flex items-center gap-16">
                  <TokenIcon symbol={item.token.symbol} displaySize={40} />
                  <div>
                    <div className="text-body-large">{item.token.symbol}</div>
                    <div className="text-body-small text-typography-secondary">
                      {item.type === "deposit" ? <Trans>Deposit</Trans> : <Trans>Withdraw</Trans>} •{" "}
                      {item.status === "confirmed" || item.status === "completed" ? (
                        <Trans>Completed</Trans>
                      ) : item.status === "pending" ? (
                        <Trans>Pending</Trans>
                      ) : item.status === "signed" ? (
                        <Trans>Signed</Trans>
                      ) : item.status === "submitted" ? (
                        <Trans>Submitted</Trans>
                      ) : (
                        <Trans>Failed</Trans>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <Amount
                    className="text-body-large"
                    amount={(item.type === "deposit" ? 1n : -1n) * item.amount}
                    decimals={item.token.decimals}
                    isStable={item.token.isStable}
                    signed
                  />
                  <div
                    className={cx("text-body-small", {
                      "text-red-500": item.status === "signed",
                      "text-slate-100": item.status !== "signed",
                    })}
                  >
                    {item.status === "signed" && item.type === "withdraw" && item.expiry ? (
                      <>
                        {formatDateTime(item.expiry)} <Trans>Expires</Trans>
                      </>
                    ) : (
                      formatRelativeDateWithComma(item.created_at)
                    )}
                  </div>
                </div>
              </div>
            );
          })}

        {/* Render regular funding history outside API trading mode */}
        {!isTradeMode &&
          filteredFundingHistory?.map((transfer) => (
            <div
              role="button"
              tabIndex={0}
              key={transfer.id}
              className="flex w-full cursor-pointer items-center justify-between px-adaptive py-8 text-left -outline-offset-4 app-hover:bg-fill-surfaceElevated50"
              onClick={() => handleTransferClick(transfer)}
            >
              <div className="flex items-center gap-16">
                <TokenIcon symbol={transfer.token.symbol} displaySize={40} />
                <div>
                  <div className="text-body-large">{transfer.token.symbol}</div>
                  <FundingHistoryItemLabel
                    step={transfer.step}
                    operation={transfer.operation}
                    isExecutionError={transfer.isExecutionError}
                  />
                </div>
              </div>
              <div className="text-right">
                <Amount
                  className="text-body-large"
                  amount={(transfer.operation === "deposit" ? 1n : -1n) * transfer.sentAmount}
                  decimals={transfer.token.decimals}
                  isStable={transfer.token.isStable}
                  signed
                />
                <div className="text-body-small text-slate-100">
                  {formatRelativeDateWithComma(transfer.sentTimestamp)}
                </div>
              </div>
            </div>
          ))}

        {!isLoading &&
          (isTradeMode ? tradingDisplayHistory : fundingHistory) &&
          (isTradeMode ? tradingDisplayHistory : fundingHistory)!.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-8 p-adaptive text-slate-100">
              <Trans>No funding activity</Trans>
            </div>
          )}
        {!isLoading &&
          (isTradeMode ? filteredTradingHistory : filteredFundingHistory)?.length === 0 &&
          (isTradeMode ? tradingDisplayHistory : fundingHistory) &&
          (isTradeMode ? tradingDisplayHistory : fundingHistory)!.length > 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-8 p-adaptive text-slate-100">
              <Trans>No funding activity</Trans>
            </div>
          )}
        {isLoading && (
          <div className="flex grow items-center justify-center p-adaptive text-slate-100">
            <SpinnerIcon className="size-24 animate-spin" />
          </div>
        )}
      </VerticalScrollFadeContainer>
    </div>
  );
};

export const MainView = ({ account }: { account: string }) => {
  return (
    <div className="trading-account-modal-main text-body-medium flex grow flex-col gap-[--padding-adaptive] overflow-y-auto">
      <div className="flex flex-col gap-12 px-adaptive pb-12 pt-8">
        <Toolbar account={account} />
        <WalletOverview />
      </div>
      <FundingHistorySection />
    </div>
  );
};
