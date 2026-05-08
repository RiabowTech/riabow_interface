import { Trans, t } from "@lingui/macro";
import cx from "classnames";
import { useCallback, useMemo, useState } from "react";
import Skeleton from "react-loading-skeleton";
import { useHistory } from "react-router-dom";
import { useCopyToClipboard } from "react-use";
import { parseUnits, getAddress } from "viem";
import { useAccount, usePublicClient } from "wagmi";

import { usePrimitUserBalances } from "@/modules/lighter/api";
import { confirmWithdraw } from "@/modules/lighter/api/custom/client";
import { useTradingFundingHistory } from "@/modules/lighter/api/custom/useTradingFundingHistory";
import {
  useTradingAccountModalOpen,
  useTradingAccountSelectedTransferGuid,
} from "@/modules/lighter/context/TradingAccountContext";
import { useSettings } from "@/modules/lighter/context/SettingsContext";
import { useDisconnectAndClose } from "@/modules/lighter/domain/multichain/useDisconnectAndClose";
import { isTradeModeActive } from "@/modules/lighter/store/TradeStateContext/TradeStateContext";
import { BOTANIX, getExplorerUrl } from "config/chains";
import { getTradingVaultAddress } from "config/custom/contracts";
import VaultAbi from "sdk/abis/Vault";
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
import ExplorerIcon from "img/ic_explorer.svg?react";
import PnlAnalysisIcon from "img/ic_pnl_analysis.svg?react";
import SettingsIcon from "img/ic_settings.svg?react";
import DisconnectIcon from "img/ic_sign_out_20.svg?react";
import SpinnerIcon from "img/ic_spinner.svg?react";

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
  const history = useHistory();

  const { isSmallMobile } = useBreakpoints();
  const chainId = srcChainId ?? settlementChainId;

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
    <div className="flex items-stretch justify-between gap-12 max-smallMobile:flex-wrap">
      <Button variant="secondary" size="small" className="flex flex-1 items-center gap-8" onClick={handleCopyAddress}>
        <div className="max-[500px]:hidden">
          <Avatar size={24} ensName={ensName} address={account} />
        </div>
        <div className="text-body-medium font-medium text-typography-primary">
          {shortenAddressOrEns(ensName || account, 17)}
        </div>
        <CopyIcon className="size-20 max-[500px]:hidden" />
      </Button>
      <div className="flex items-center gap-8">
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
              // 走 onClick + window.open:与同排 PnL / Logout 按钮共享 Primit 按钮边框样式。
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

  // In API trading mode, show Wallet and Primit Account Balance using SettlementChainBalance.
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

type DisplayFundingHistoryItem = Omit<MultichainFundingHistoryItem, "token"> & {
  token: Token;
};

type TradingDisplayFundingHistoryItem = {
  id: string;
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
  const { walletClient } = useWallet();
  const publicClient = usePublicClient({ chainId });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isTradeMode = isTradeModeActive();
  const { mutate: mutateBalances } = usePrimitUserBalances({
    refreshInterval: isTradeMode ? 10000 : 0,
  });

  // Use backend funding history in API trading mode, otherwise use regular multichain funding history.
  const tradingFundingHistory = useTradingFundingHistory(chainId, { enabled: isTradeMode });
  const regularFundingHistory = useTradingAccountFundingHistory({ enabled: !isTradeMode });

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
        const token = getTokenBySymbol(chainId!, item.token);
        if (!token) {
          console.warn(`[FundingHistorySection] Token not found for symbol: ${item.token}`);
          return undefined;
        }

        // Parse amount string to bigint
        const amountBigInt = parseUnits(item.amount, token.decimals);

        return {
          id: item.id,
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
  }, [isTradeMode, tradingFundingHistory.fundingHistory, chainId]);

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
    if (!chainId || !walletClient || !publicClient || !account) {
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
      const vaultAddress = getTradingVaultAddress(chainId);
      if (!vaultAddress) {
        throw new Error("Vault contract not found");
      }

      // Reuse the shared Vault ABI — includes all custom error definitions
      // from ZtdxReserveVault + ZtdxSignatureCodec, so revert reasons surface
      // as readable names (e.g. InvalidSignature, SignatureExpired) instead
      // of raw 4-byte selectors.
      const vaultAbi = VaultAbi;

      // The amount is already in bigint format from item.amount
      const amountInWei = item.amount;
      const deadline = item.expiry;
      const signature = item.backend_signature;

      // Step 1: Simulate contract call
      try {
        await publicClient.simulateContract({
          address: vaultAddress as `0x${string}`,
          abi: vaultAbi,
          functionName: "releaseFunds",
          args: [amountInWei, BigInt(deadline), signature as `0x${string}`],
          account: getAddress(account),
        });
      } catch (simulateError: any) {
        console.error("[FundingHistory] Contract simulation failed:", simulateError);
        throw new Error(simulateError?.shortMessage || "Transaction simulation failed");
      }

      // Step 2: Call contract
      const txHash = await walletClient.writeContract({
        address: vaultAddress as `0x${string}`,
        abi: vaultAbi,
        functionName: "releaseFunds",
        args: [amountInWei, BigInt(deadline), signature as `0x${string}`],
        account: getAddress(account),
        chain: publicClient.chain,
      });

      helperToast.success(t`Withdraw transaction submitted`);

      // Wait for confirmation
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

      helperToast.success(t`Withdraw completed successfully`);

      // Confirm with backend
      try {
        await confirmWithdraw(chainId, item.id, {
          tx_hash: receipt.transactionHash,
        });
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
    <div className="flex grow flex-col gap-12 overflow-y-hidden">
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
    <div className="trading-account-modal-main text-body-medium flex grow flex-col gap-[--padding-adaptive] overflow-y-hidden">
      <div className="flex flex-col gap-12 px-adaptive pb-12 pt-8">
        <Toolbar account={account} />
        <BalanceSection />
        <ActionButtons />
      </div>
      <FundingHistorySection />
    </div>
  );
};
