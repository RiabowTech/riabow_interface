import { Trans, t } from "@lingui/macro";
import cx from "classnames";
import noop from "lodash/noop";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Skeleton from "react-loading-skeleton";
import { useLatest } from "react-use";
import { Address, Hex, decodeErrorResult, erc20Abi, getAddress, zeroAddress } from "viem";
import { useAccount, useChains, usePublicClient } from "wagmi";

import { SettlementChainId, SourceChainId, getChainName, isTestnetChain } from "config/chains";
import { DEFAULT_SPOT_CHAIN_ID, getSpotVaultAddress, getTradingVaultAddress } from "config/custom/contracts";
import { isDevelopment } from "config/env";
import { getChainIcon } from "config/icons";
import {
  CHAIN_ID_PREFERRED_DEPOSIT_TOKEN,
  DEBUG_MULTICHAIN_SAME_CHAIN_DEPOSIT,
  MULTICHAIN_FUNDING_SLIPPAGE_BPS,
  MULTICHAIN_TOKEN_MAPPING,
  MULTICHAIN_TRANSFER_SUPPORTED_TOKENS,
  StargateErrorsAbi,
  getMappedTokenId,
} from "config/multichain";
import {
  useTradingAccountDepositViewChain,
  useTradingAccountDepositViewTokenAddress,
  useTradingAccountDepositViewTokenInputValue,
  useTradingAccountModalOpen,
  useTradingAccountSelectedTransferGuid,
  useTradingAccountSettlementChainId,
} from "@/modules/lighter/context/TradingAccountContext";
import { useSubaccountContext } from "@/modules/lighter/context/SubaccountContext";
import { useMultichainApprovalsActiveListener, useSyntheticsEvents } from "@/modules/lighter/context/SyntheticsEvents";
import { getMultichainTransferSendParams } from "@/modules/lighter/domain/multichain/getSendParams";
import { sendCrossChainDepositTxn } from "@/modules/lighter/domain/multichain/sendCrossChainDepositTxn";
import { sendSameChainDepositTxn } from "@/modules/lighter/domain/multichain/sendSameChainDepositTxn";
import { useTradingAccountFundingHistory } from "@/modules/lighter/domain/multichain/useTradingAccountFundingHistory";
import { useMultichainDepositNetworkComposeGas } from "@/modules/lighter/domain/multichain/useMultichainDepositNetworkComposeGas";
import { useMultichainQuoteFeeUsd } from "@/modules/lighter/domain/multichain/useMultichainQuoteFeeUsd";
import { useNativeTokenBalance } from "@/modules/lighter/domain/multichain/useNativeTokenBalance";
import { useQuoteOft } from "@/modules/lighter/domain/multichain/useQuoteOft";
import { useQuoteOftLimits } from "@/modules/lighter/domain/multichain/useQuoteOftLimits";
import { useQuoteSend } from "@/modules/lighter/domain/multichain/useQuoteSend";
import { getNeedTokenApprove, useTokensAllowanceData, useTokensDataRequest } from "domain/synthetics/tokens";
import { useZanbaraUserBalances } from "@/modules/lighter/api";
import { NativeTokenSupportedAddress, TokenData, approveTokens } from "domain/tokens";
import { useChainId } from "lib/chains";
import { useLeadingDebounce } from "lib/debounce/useLeadingDebounde";
import { helperToast } from "lib/helperToast";
import {
  OrderMetricId,
  initMultichainDepositMetricData,
  sendOrderSimulatedMetric,
  sendOrderSubmittedMetric,
  sendOrderTxnSubmittedMetric,
  sendTxnErrorMetric,
  sendTxnSentMetric,
} from "lib/metrics";
import { USD_DECIMALS, adjustForDecimals, formatAmountFree, formatUsd } from "lib/numbers";
import { EMPTY_ARRAY, EMPTY_OBJECT, getByKey } from "lib/objects";
import { useJsonRpcProvider } from "lib/rpc";
import { TxnCallback, TxnEventName, WalletTxnCtx } from "lib/transactions";
import { useIsNonEoaAccountOnAnyChain } from "lib/wallets/useAccountType";
import { useEthersSigner } from "lib/wallets/useEthersSigner";
import { useIsGeminiWallet } from "lib/wallets/useIsGeminiWallet";
import { convertTokenAddress, getNativeToken, getToken } from "sdk/configs/tokens";
import { bigMath } from "sdk/utils/bigmath";
import { convertToTokenAmount, convertToUsd, getMidPrice } from "sdk/utils/tokens";
import { parseValue } from "sdk/utils/numbers";
import { applySlippageToMinOut } from "sdk/utils/trade";
import type { SendParamStruct } from "typechain-types-stargate/IStargate";

import { AlertInfoCard } from "components/AlertInfo/AlertInfoCard";
import { Amount } from "components/Amount/Amount";
import { AmountWithUsdBalance } from "components/AmountWithUsd/AmountWithUsd";
import Button from "components/Button/Button";
import { getTxnErrorToast } from "components/Errors/errorToasts";
import NumberInput from "components/NumberInput/NumberInput";
import { SyntheticsInfoRow } from "components/SyntheticsInfoRow";
import TokenIcon from "components/TokenIcon/TokenIcon";
import { ValueTransition } from "components/ValueTransition/ValueTransition";

import ChevronRightIcon from "img/ic_chevron_right.svg?react";
import SpinnerIcon from "img/ic_spinner.svg?react";

import { useAvailableToTradeAssetMultichain, useMultichainTokensRequest } from "./hooks";
import { wrapChainAction } from "./wrapChainAction";
import { isTradeModeActive, useTradeProduct } from "@/modules/lighter/store/TradeStateContext/TradeStateContext";
import { getTokenBySymbol } from "sdk/configs/tokens";
import type { TokenChainData } from "@/modules/lighter/domain/multichain/types";
import { useTokenRecentPricesRequest } from "domain/synthetics/tokens";
import { findWalletTokenConfig, useWalletTokensConfig } from "@/modules/lighter/api/custom/walletTokens";
import SpotVaultAbi from "sdk/abis/SpotVault";
import useWallet from "lib/wallets/useWallet";
import { getRainbowKitConfig } from "lib/wallets/rainbowKitConfig";

const useIsFirstDeposit = () => {
  const [enabled, setEnabled] = useState(true);
  const [isFirstDeposit, setIsFirstDeposit] = useState(false);
  const { fundingHistory, isLoading } = useTradingAccountFundingHistory({ enabled });

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (fundingHistory === undefined || fundingHistory.length !== 0) {
      return;
    }

    setEnabled(false);
    const hasDeposit = fundingHistory.some((funding) => funding.operation === "deposit");
    if (!hasDeposit) {
      setIsFirstDeposit(true);
    }
  }, [fundingHistory, isLoading]);

  return isFirstDeposit;
};

function getFundingChainName(chainId: number) {
  return chainId === DEFAULT_SPOT_CHAIN_ID ? "BNB Testnet" : getChainName(chainId);
}

type RequestProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

async function ensureConnectorChain(connector: ReturnType<typeof useWallet>["connector"], targetChainId: number) {
  const provider = (await connector?.getProvider?.()) as Partial<RequestProvider> | undefined;
  if (typeof provider?.request !== "function") {
    throw new Error("No wallet provider found. Please reconnect your wallet.");
  }

  const chainIdHex = `0x${targetChainId.toString(16)}`;
  const currentChainIdHex = (await provider.request({ method: "eth_chainId" })) as string;
  if (parseInt(currentChainIdHex, 16) === targetChainId) {
    return;
  }

  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: chainIdHex }],
    });
  } catch (switchError: any) {
    if (switchError?.code === 4001) {
      throw new Error("User rejected the chain switch");
    }

    if (switchError?.code !== 4902 && switchError?.code !== -32603) {
      throw switchError;
    }

    const targetChain = getRainbowKitConfig().chains.find((chain) => chain.id === targetChainId);
    if (!targetChain) {
      throw new Error(`Unsupported wallet network ${targetChainId}`);
    }

    await provider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: chainIdHex,
          chainName: targetChain.name,
          nativeCurrency: targetChain.nativeCurrency,
          rpcUrls: targetChain.rpcUrls.default.http,
          blockExplorerUrls: targetChain.blockExplorers?.default?.url ? [targetChain.blockExplorers.default.url] : [],
        },
      ],
    });

    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: chainIdHex }],
    });
  }
}

async function requireSpotVaultTokenRegistered(params: {
  publicClient: NonNullable<ReturnType<typeof usePublicClient>>;
  vaultAddress: string;
  tokenAddress: string;
}) {
  const isRegistered = await params.publicClient.readContract({
    address: getAddress(params.vaultAddress),
    abi: SpotVaultAbi,
    functionName: "registeredTokens",
    args: [getAddress(params.tokenAddress)],
  });

  if (!isRegistered) {
    throw new Error("This token is not enabled for spot deposits. Contact support.");
  }
}

export const DepositView = () => {
  const { chainId: settlementChainId, srcChainId } = useChainId();
  const { address: account, chainId: walletChainId } = useAccount();
  const product = useTradeProduct();
  const isSpotProduct = product === "spot";
  const spotChainId = DEFAULT_SPOT_CHAIN_ID;
  const spotVaultAddress = getSpotVaultAddress(spotChainId);
  const { data: walletTokenConfigs } = useWalletTokensConfig();
  const spotTokenConfig = findWalletTokenConfig(walletTokenConfigs, spotChainId);
  const { connector, walletClient } = useWallet();
  const spotPublicClient = usePublicClient({ chainId: spotChainId });

  const [, setSettlementChainId] = useTradingAccountSettlementChainId();
  const [depositViewChain, setDepositViewChain] = useTradingAccountDepositViewChain();
  const walletSigner = useEthersSigner({ chainId: depositViewChain ?? srcChainId });
  const { provider: sourceChainProvider } = useJsonRpcProvider(depositViewChain);

  const [isVisibleOrView, setIsVisibleOrView] = useTradingAccountModalOpen();
  const [, setSelectedTransferGuid] = useTradingAccountSelectedTransferGuid();

  const [depositViewTokenAddress, setDepositViewTokenAddress] = useTradingAccountDepositViewTokenAddress();
  const [inputValue, setInputValue] = useTradingAccountDepositViewTokenInputValue();
  const {
    tokenChainDataArray: multichainTokensRaw,
    isPriceDataLoading,
    isBalanceDataLoading,
  } = useMultichainTokensRequest();

  const { pricesData } = useTokenRecentPricesRequest(settlementChainId);

  // In API trading mode, filter the source asset list down to USDT.
  // If no USDT balance entry exists yet, create a synthetic zero-balance item so deposits stay available.
  const multichainTokens = useMemo(() => {
    if (!isTradeModeActive()) {
      return multichainTokensRaw;
    }

    try {
      const usdtToken = getTokenBySymbol(settlementChainId, "USDT");
      console.log("[DepositView] API trading mode - USDT token lookup", {
        settlementChainId,
        usdtToken: usdtToken
          ? {
              symbol: usdtToken.symbol,
              address: usdtToken.address,
              decimals: usdtToken.decimals,
            }
          : null,
        multichainTokensRawCount: multichainTokensRaw.length,
        multichainTokensRaw: multichainTokensRaw.map((t) => ({
          symbol: t.symbol,
          address: t.address,
          sourceChainId: t.sourceChainId,
        })),
      });

      if (!usdtToken) {
        console.warn("[DepositView] USDT token not found in API trading mode, using all tokens");
        return multichainTokensRaw;
      }

      const usdtAddress = usdtToken.address.toLowerCase();
      let filtered = multichainTokensRaw.filter((token) => token.address.toLowerCase() === usdtAddress);

      // If no USDT token exists in the fetched balance list, create a manual zero-balance entry.
      if (filtered.length === 0) {
        console.log("[DepositView] API trading mode - No USDT in multichainTokensRaw, creating manual entry");

        // Find USDT mapping from MULTICHAIN_TOKEN_MAPPING
        const mapping = MULTICHAIN_TOKEN_MAPPING[settlementChainId as SettlementChainId];
        if (mapping) {
          // Find the first source chain that has USDT
          for (const sourceChainIdString in mapping) {
            const sourceChainId = parseInt(sourceChainIdString) as SourceChainId;
            const sourceChainMappings = mapping[sourceChainId];

            if (sourceChainMappings) {
              // Find USDT address in source chain mappings
              for (const sourceChainTokenAddress in sourceChainMappings) {
                const tokenMapping = sourceChainMappings[sourceChainTokenAddress];
                if (tokenMapping && tokenMapping.settlementChainTokenAddress.toLowerCase() === usdtAddress) {
                  // Create TokenChainData entry
                  const tokenChainData: TokenChainData = {
                    ...usdtToken,
                    sourceChainId: sourceChainId,
                    sourceChainDecimals: tokenMapping.sourceChainTokenDecimals,
                    sourceChainPrices: pricesData?.[usdtToken.address] || undefined,
                    sourceChainBalance: 0n, // Allow deposit even with 0 balance
                  };

                  filtered = [tokenChainData];
                  console.log("[DepositView] API trading mode - Created manual USDT entry", {
                    tokenChainData: {
                      symbol: tokenChainData.symbol,
                      address: tokenChainData.address,
                      sourceChainId: tokenChainData.sourceChainId,
                      sourceChainBalance: tokenChainData.sourceChainBalance?.toString() || "0",
                    },
                  });
                  break;
                }
              }
              if (filtered.length > 0) break;
            }
          }
        }
      }

      console.log("[DepositView] API trading mode - Filtered tokens", {
        usdtAddress,
        filteredCount: filtered.length,
        filtered: filtered.map((t) => ({
          symbol: t.symbol,
          address: t.address,
          sourceChainId: t.sourceChainId,
          sourceChainBalance: t.sourceChainBalance?.toString() || "0",
        })),
      });

      return filtered;
    } catch (e) {
      console.error("[DepositView] Error filtering USDT tokens in API trading mode:", e);
      return multichainTokensRaw;
    }
  }, [multichainTokensRaw, settlementChainId, pricesData]);

  const [isApproving, setIsApproving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [shouldSendCrossChainDepositWhenLoaded, setShouldSendCrossChainDepositWhenLoaded] = useState(false);

  const { setMultichainSubmittedDeposit } = useSyntheticsEvents();

  const selectedWalletTokenConfig = useMemo(() => {
    if (depositViewChain === undefined || depositViewTokenAddress === undefined) {
      return undefined;
    }

    return walletTokenConfigs?.find(
      (token) =>
        token.chainId === Number(depositViewChain) &&
        token.contract.toLowerCase() === depositViewTokenAddress.toLowerCase()
    );
  }, [depositViewChain, depositViewTokenAddress, walletTokenConfigs]);

  const spotDepositTokenConfig =
    selectedWalletTokenConfig?.chainId === spotChainId
      ? selectedWalletTokenConfig
      : undefined;
  const isSpotVaultDeposit = spotDepositTokenConfig !== undefined;

  const spotToken = useMemo<TokenData | undefined>(() => {
    if (!isSpotVaultDeposit || !spotDepositTokenConfig) {
      return undefined;
    }

    return {
      name: spotDepositTokenConfig.symbol,
      symbol: spotDepositTokenConfig.symbol,
      decimals: spotDepositTokenConfig.decimals,
      address: spotDepositTokenConfig.contract,
      isStable: spotDepositTokenConfig.symbol.toUpperCase().includes("USD"),
      prices: { minPrice: 0n, maxPrice: 0n },
      walletBalance: 0n,
      balance: 0n,
      tradingAccountBalance: 0n,
    };
  }, [isSpotVaultDeposit, spotDepositTokenConfig]);

  const selectedToken =
    isSpotVaultDeposit && depositViewTokenAddress !== undefined
      ? spotToken
      : depositViewTokenAddress !== undefined
        ? getToken(settlementChainId, depositViewTokenAddress)
        : undefined;

  const { tokensData } = useTokensDataRequest(settlementChainId, depositViewChain);
  const selectedTokenData = isSpotVaultDeposit ? spotToken : getByKey(tokensData, depositViewTokenAddress);

  const selectedTokenSourceChainTokenId =
    isSpotVaultDeposit && spotDepositTokenConfig
      ? {
          chainId: spotDepositTokenConfig.chainId,
          address: spotDepositTokenConfig.contract,
          decimals: spotDepositTokenConfig.decimals,
          stargate: "",
          symbol: spotDepositTokenConfig.symbol,
          isTestnet: true,
        }
      : depositViewTokenAddress !== undefined && depositViewChain !== undefined
      ? getMappedTokenId(settlementChainId as SettlementChainId, depositViewTokenAddress, depositViewChain)
      : undefined;

  const unwrappedSelectedTokenAddress =
    isSpotVaultDeposit
      ? depositViewTokenAddress
      : depositViewTokenAddress !== undefined
      ? convertTokenAddress(settlementChainId, depositViewTokenAddress, "native")
      : undefined;

  const [spotSourceChainBalance, setSpotSourceChainBalance] = useState<bigint | undefined>(undefined);

  useEffect(() => {
    if (!isSpotVaultDeposit || !spotPublicClient || !account || !spotDepositTokenConfig?.contract) {
      setSpotSourceChainBalance(undefined);
      return;
    }

    let cancelled = false;
    spotPublicClient
      .readContract({
        address: getAddress(spotDepositTokenConfig.contract),
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [getAddress(account)],
      })
      .then((balance) => {
        if (!cancelled) {
          setSpotSourceChainBalance(balance);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSpotSourceChainBalance(undefined);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [account, isSpotVaultDeposit, spotDepositTokenConfig?.contract, spotPublicClient]);

  const selectedTokenChainData = useMemo(() => {
    if (selectedToken === undefined) return undefined;
    if (isSpotVaultDeposit && spotDepositTokenConfig) {
      return {
        ...selectedToken,
        sourceChainId: spotDepositTokenConfig.chainId as SourceChainId,
        sourceChainDecimals: spotDepositTokenConfig.decimals,
        sourceChainBalance: spotSourceChainBalance,
        sourceChainPrices: { minPrice: 0n, maxPrice: 0n },
      } as TokenChainData;
    }

    return multichainTokens.find(
      (token) => token.address === selectedToken.address && token.sourceChainId === depositViewChain
    );
  }, [selectedToken, multichainTokens, depositViewChain, isSpotVaultDeposit, spotDepositTokenConfig, spotSourceChainBalance]);

  const selectedTokenSourceChainBalance = selectedTokenChainData?.sourceChainBalance;
  const selectedTokenSourceChainDecimals = selectedTokenChainData?.sourceChainDecimals;

  const viemChains = useChains();
  const depositViewViemChain = useMemo(
    () =>
      depositViewChain !== undefined && viemChains.length > 0
        ? viemChains.find((chain) => chain.id === depositViewChain)
        : undefined,
    [viemChains, depositViewChain]
  );

  const nativeTokenSourceChainBalance = useNativeTokenBalance(depositViewChain, account);

  const realInputAmount = useMemo(() => {
    if (inputValue === undefined || selectedToken?.decimals === undefined) {
      return undefined;
    }

    return parseValue(inputValue, selectedToken.decimals);
  }, [inputValue, selectedToken?.decimals]);

  /**
   * Debounced
   */
  const inputAmount = useLeadingDebounce(realInputAmount);
  const inputAmountUsd = selectedToken
    ? convertToUsd(inputAmount, selectedToken.decimals, selectedTokenChainData?.sourceChainPrices?.maxPrice)
    : undefined;
  const latestInputAmountUsd = useLatest(inputAmountUsd);

  const amountLD =
    inputAmount !== undefined && selectedTokenSourceChainDecimals !== undefined && selectedToken?.decimals !== undefined
      ? (inputAmount * 10n ** BigInt(selectedTokenSourceChainDecimals)) / 10n ** BigInt(selectedToken?.decimals)
      : undefined;

  const handleMaxButtonClick = useCallback(() => {
    if (
      selectedToken === undefined ||
      selectedTokenSourceChainBalance === undefined ||
      selectedTokenSourceChainDecimals === undefined
    ) {
      return;
    }

    const isNative = unwrappedSelectedTokenAddress === zeroAddress;
    if (isNative) {
      const buffer = convertToTokenAmount(
        10n * 10n ** BigInt(USD_DECIMALS),
        selectedToken.decimals,
        getMidPrice(selectedTokenChainData?.sourceChainPrices ?? { minPrice: 0n, maxPrice: 0n })
      )!;

      let amount = selectedTokenSourceChainBalance;

      if (selectedTokenSourceChainBalance > buffer) {
        const maxAmount = bigMath.max(selectedTokenSourceChainBalance - buffer, 0n);
        amount = maxAmount;
      }

      setInputValue(formatAmountFree(amount, selectedToken.decimals));
      return;
    }

    setInputValue(formatAmountFree(selectedTokenSourceChainBalance, selectedTokenSourceChainDecimals));
  }, [
    selectedToken,
    selectedTokenChainData?.sourceChainPrices,
    selectedTokenSourceChainBalance,
    selectedTokenSourceChainDecimals,
    setInputValue,
    unwrappedSelectedTokenAddress,
  ]);

  const { tradingAccountUsd } = useAvailableToTradeAssetMultichain();

  const { nextTradingAccountBalanceUsd } = useMemo((): {
    nextTradingAccountBalanceUsd?: bigint;
    nextTokenTradingAccountBalance?: bigint;
  } => {
    if (inputAmount === undefined || inputAmountUsd === undefined) {
      return EMPTY_OBJECT;
    }

    const nextTradingAccountBalanceUsd = (tradingAccountUsd ?? 0n) + inputAmountUsd;
    const nextTokenTradingAccountBalance = (selectedTokenData?.tradingAccountBalance ?? 0n) + inputAmount;

    return {
      nextTradingAccountBalanceUsd,
      nextTokenTradingAccountBalance,
    };
  }, [tradingAccountUsd, inputAmount, inputAmountUsd, selectedTokenData?.tradingAccountBalance]);

  const spenderAddress = useMemo(() => {
    if (isSpotVaultDeposit) {
      return spotVaultAddress as Address | undefined;
    }

    console.log("[DepositView] 🔍 计算授权地址 (spenderAddress):", {
      depositViewChain,
      settlementChainId,
      isSameChain: Number(depositViewChain) === settlementChainId,
    });

    if (Number(depositViewChain) === settlementChainId) {
      const vaultAddress = getTradingVaultAddress(settlementChainId);
      console.log("[DepositView] ✅ 使用交易 vault 作为授权地址:", {
        vaultAddress,
        chainId: settlementChainId,
      });
      return vaultAddress as Address | undefined;
    }

    // For cross-chain deposits, use Stargate address
    const stargateAddress = selectedTokenSourceChainTokenId?.stargate;
    return stargateAddress;
  }, [depositViewChain, isSpotVaultDeposit, settlementChainId, selectedTokenSourceChainTokenId?.stargate, spotVaultAddress]);

  useMultichainApprovalsActiveListener(depositViewChain, "multichain-deposit-view");

  const tokensAllowanceResult = useTokensAllowanceData(depositViewChain, {
    spenderAddress,
    tokenAddresses: selectedTokenSourceChainTokenId ? [selectedTokenSourceChainTokenId.address] : [],
    skip: isSpotVaultDeposit || depositViewChain === undefined,
  });
  const tokensAllowanceData = depositViewChain !== undefined ? tokensAllowanceResult.tokensAllowanceData : undefined;
  const [spotAllowance, setSpotAllowance] = useState<bigint | undefined>(undefined);

  useEffect(() => {
    if (
      !isSpotVaultDeposit ||
      !spotPublicClient ||
      !account ||
      !spotVaultAddress ||
      !spotDepositTokenConfig?.contract ||
      !depositViewTokenAddress
    ) {
      setSpotAllowance(undefined);
      return;
    }

    let cancelled = false;
    spotPublicClient
      .readContract({
        address: getAddress(spotDepositTokenConfig.contract),
        abi: erc20Abi,
        functionName: "allowance",
        args: [getAddress(account), getAddress(spotVaultAddress)],
      })
      .then((allowance) => {
        if (!cancelled) {
          setSpotAllowance(allowance);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSpotAllowance(undefined);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    account,
    depositViewTokenAddress,
    isSpotVaultDeposit,
    spotPublicClient,
    spotDepositTokenConfig?.contract,
    spotVaultAddress,
  ]);

  const needTokenApprove =
    isSpotVaultDeposit && amountLD !== undefined && amountLD > 0n
      ? spotAllowance === undefined || spotAllowance < amountLD
      : getNeedTokenApprove(
          tokensAllowanceData,
          depositViewTokenAddress === zeroAddress ? zeroAddress : selectedTokenSourceChainTokenId?.address,
          amountLD,
          EMPTY_ARRAY
        );

  const handleApprove = useCallback(async () => {
    console.log("[DepositView] 🔐 开始授权流程:", {
      depositViewTokenAddress,
      amountLD: amountLD?.toString(),
      spenderAddress,
      depositViewChain,
      settlementChainId,
      isTradeMode: isTradeModeActive(),
    });

    if (!depositViewTokenAddress || amountLD === undefined || !spenderAddress || !depositViewChain) {
      console.error("[DepositView] ❌ 授权失败: 缺少必要参数", {
        depositViewTokenAddress,
        amountLD,
        spenderAddress,
        depositViewChain,
      });
      helperToast.error(t`Approval failed`);
      return;
    }

    // Defensive guard: refuse zero-address spender. Most ERC20s revert on
    // approve(address(0), ...) (OpenZeppelin: `ERC20InvalidSpender`), and even
    // when they don't, "approve to zero" silently destroys allowance instead
    // of granting it. Hitting this branch means VITE_ZTDX_VAULT_PROXY (or the
    // cross-chain Stargate pool address) wasn't resolved at build time —
    // contracts.ts falls back to 0x0000…0000 placeholder when the env is
    // missing, which propagates to here. Surface with a readable toast
    // instead of a MetaMask "execution reverted" pop-up.
    if (spenderAddress.toLowerCase() === zeroAddress.toLowerCase()) {
      console.error(
        "[DepositView] ❌ Approve aborted: spender resolved to zero address. Check VITE_ZTDX_VAULT_PROXY / Stargate pool config.",
        {
          depositViewChain,
          settlementChainId,
          isSameChain: Number(depositViewChain) === settlementChainId,
        }
      );
      helperToast.error(t`Deposit contract not configured for this chain. Contact support.`);
      return;
    }

    const isNative = depositViewTokenAddress === zeroAddress;

    if (isNative) {
      helperToast.error(t`Native token cannot be approved`);
      return;
    }

    if (isSpotVaultDeposit) {
      if (!walletClient || !spotPublicClient || !spotDepositTokenConfig?.contract || !spotVaultAddress || !account) {
        helperToast.error(t`Approval failed`);
        return;
      }

      try {
        setIsApproving(true);
        await ensureConnectorChain(connector, spotChainId);
        await requireSpotVaultTokenRegistered({
          publicClient: spotPublicClient,
          vaultAddress: spotVaultAddress,
          tokenAddress: spotDepositTokenConfig.contract,
        });
        const txHash = await walletClient.writeContract({
          address: getAddress(spotDepositTokenConfig.contract),
          abi: erc20Abi,
          functionName: "approve",
          args: [getAddress(spotVaultAddress), amountLD],
          account: getAddress(account),
          chain: spotPublicClient.chain,
        });
        await spotPublicClient.waitForTransactionReceipt({ hash: txHash });
        setSpotAllowance(amountLD);
        helperToast.success(t`Approval submitted`);
      } catch (error: any) {
        helperToast.error(error?.shortMessage || error?.message || t`Approval failed`);
      } finally {
        setIsApproving(false);
      }
      return;
    }

    if (!selectedTokenSourceChainTokenId) {
      helperToast.error(t`Approval failed`);
      return;
    }

    await wrapChainAction(
      depositViewChain,
      setSettlementChainId,
      async (signer) => {
        console.log("[DepositView] ✅ 执行授权交易:", {
          chainId: depositViewChain,
          tokenAddress: selectedTokenSourceChainTokenId.address,
          spender: spenderAddress,
          approveAmount: amountLD.toString(),
          isTradeMode: isTradeModeActive(),
        });

        await approveTokens({
          chainId: depositViewChain,
          tokenAddress: selectedTokenSourceChainTokenId.address,
          signer: signer,
          spender: spenderAddress,
          onApproveSubmitted: () => {
            setIsApproving(true);
          },
          setIsApproving: noop,
          permitParams: undefined,
          // Use exact amount from input instead of MaxUint256
          approveAmount: amountLD,
        });
      },
      {
        // Older OKX Wallet versions can emit a provider network-change error
        // if we switch back immediately after approval submission.
        restorePreviousChain: false,
      }
    );
  }, [
    depositViewTokenAddress,
    amountLD,
    account,
    spenderAddress,
    depositViewChain,
    isSpotVaultDeposit,
    settlementChainId,
    selectedTokenSourceChainTokenId,
    setSettlementChainId,
    connector,
    spotPublicClient,
    spotDepositTokenConfig?.contract,
    spotChainId,
    spotVaultAddress,
    walletClient,
  ]);

  useEffect(() => {
    if (!needTokenApprove && isApproving) {
      setIsApproving(false);
    }
  }, [isApproving, needTokenApprove]);

  const isInputEmpty = inputAmount === undefined || inputAmount <= 0n || amountLD === undefined || amountLD <= 0n;

  const { composeGas } = useMultichainDepositNetworkComposeGas({
    tokenAddress: depositViewTokenAddress,
  });

  const sendParamsWithoutSlippage: SendParamStruct | undefined = useMemo(() => {
    if (
      !account ||
      amountLD === undefined ||
      amountLD <= 0n ||
      depositViewChain === undefined ||
      composeGas === undefined
    ) {
      return;
    }

    return getMultichainTransferSendParams({
      account,
      amountLD,
      srcChainId: depositViewChain,
      composeGas,
      dstChainId: settlementChainId,
      isDeposit: true,
    });
  }, [account, amountLD, depositViewChain, composeGas, settlementChainId]);

  const quoteOft = useQuoteOft({
    sendParams: sendParamsWithoutSlippage,
    fromStargateAddress: selectedTokenSourceChainTokenId?.stargate,
    fromChainProvider: sourceChainProvider,
    fromChainId: depositViewChain,
    toChainId: settlementChainId,
  });

  const { isBelowLimit, lowerLimitFormatted, isAboveLimit, upperLimitFormatted } = useQuoteOftLimits({
    quoteOft,
    amountLD,
    isStable: selectedToken?.isStable,
    decimals: selectedTokenSourceChainTokenId?.decimals,
  });

  const sendParamsWithSlippage: SendParamStruct | undefined = useMemo(() => {
    if (!quoteOft || !sendParamsWithoutSlippage) {
      return undefined;
    }

    const { receipt } = quoteOft;

    const minAmountLD = applySlippageToMinOut(MULTICHAIN_FUNDING_SLIPPAGE_BPS, receipt.amountReceivedLD as bigint);

    const newSendParams: SendParamStruct = {
      ...sendParamsWithoutSlippage,
      minAmountLD,
    };

    return newSendParams;
  }, [sendParamsWithoutSlippage, quoteOft]);

  const quoteSend = useQuoteSend({
    sendParams: sendParamsWithSlippage,
    fromStargateAddress: selectedTokenSourceChainTokenId?.stargate,
    fromChainProvider: sourceChainProvider,
    fromChainId: depositViewChain,
    toChainId: settlementChainId,
    composeGas,
  });

  const { networkFee, networkFeeUsd, protocolFeeAmount, protocolFeeUsd } = useMultichainQuoteFeeUsd({
    quoteSend,
    quoteOft,
    unwrappedTokenAddress: unwrappedSelectedTokenAddress,
    sourceChainId: depositViewChain,
    targetChainId: settlementChainId,
  });

  const isFirstDeposit = useIsFirstDeposit();
  const latestIsFirstDeposit = useLatest(isFirstDeposit);

  const subaccountState = useSubaccountContext();

  const isGeminiWallet = useIsGeminiWallet();
  const isNonEoaAccountOnAnyChain = useIsNonEoaAccountOnAnyChain();
  const isExpressTradingDisabled = isNonEoaAccountOnAnyChain || isGeminiWallet;

  // Get mutate function to refresh balances after deposit
  const { mutate: mutateBalances } = useZanbaraUserBalances();

  const sameChainCallback: TxnCallback<WalletTxnCtx> = useCallback(
    (txnEvent) => {
      if (txnEvent.event === TxnEventName.Sent) {
        helperToast.success("Deposit sent", { toastId: "same-chain-trading-account-deposit" });
        // Refresh balances after deposit transaction is sent
        mutateBalances();
        setIsVisibleOrView("main");
      } else if (txnEvent.event === TxnEventName.Error) {
        const error = txnEvent.data.error;
        console.error("[DepositView] Same-chain deposit error:", error);

        // Try to extract more detailed error information
        let errorMessage = "Deposit failed";

        // Check for parentError (from additionalTxnErrorValidation)
        const parentError = (error as any)?.parentError;
        const errorToCheck = parentError || error;

        if (errorToCheck?.message) {
          errorMessage = errorToCheck.message;
        } else if (errorToCheck?.info?.error?.message) {
          errorMessage = errorToCheck.info.error.message;
        } else if (errorToCheck?.info?.error?.data) {
          // Try to extract revert reason from error data
          errorMessage = `Deposit failed: ${errorToCheck.info.error.data}`;
        }

        // Check for common revert reasons
        if (
          errorMessage.toLowerCase().includes("transfer amount exceeds allowance") ||
          errorMessage.toLowerCase().includes("insufficient allowance")
        ) {
          errorMessage = "Insufficient token allowance. Please approve again.";
        } else if (
          errorMessage.toLowerCase().includes("transfer amount exceeds balance") ||
          errorMessage.toLowerCase().includes("insufficient balance")
        ) {
          errorMessage = "Insufficient token balance.";
        }

        helperToast.error(errorMessage, {
          toastId: "same-chain-trading-account-deposit",
          autoClose: 10000,
        });
      }
    },
    [setIsVisibleOrView, mutateBalances]
  );

  const handleSameChainDeposit = useCallback(async () => {
    console.log("[DepositView] 💰 开始同链充值流程:", {
      account,
      depositViewTokenAddress,
      amountLD: amountLD?.toString(),
      settlementChainId,
      isTradeMode: isTradeModeActive(),
    });

    if (!account || !depositViewTokenAddress || amountLD === undefined || (!walletSigner && !isSpotVaultDeposit)) {
      console.error("[DepositView] ❌ 充值失败: 缺少必要参数", {
        account,
        depositViewTokenAddress,
        amountLD,
        walletSigner: !!walletSigner,
      });
      return;
    }

    if (isSpotVaultDeposit) {
      if (!walletClient || !spotPublicClient || !spotVaultAddress || !spotDepositTokenConfig?.contract) {
        helperToast.error(t`Deposit contract not configured for this chain. Contact support.`);
        return;
      }

      try {
        setIsSubmitting(true);
        await ensureConnectorChain(connector, spotChainId);
        await requireSpotVaultTokenRegistered({
          publicClient: spotPublicClient,
          vaultAddress: spotVaultAddress,
          tokenAddress: spotDepositTokenConfig.contract,
        });
        await spotPublicClient.simulateContract({
          address: getAddress(spotVaultAddress),
          abi: SpotVaultAbi,
          functionName: "deposit",
          args: [getAddress(spotDepositTokenConfig.contract), amountLD],
          account: getAddress(account),
        });
        const txHash = await walletClient.writeContract({
          address: getAddress(spotVaultAddress),
          abi: SpotVaultAbi,
          functionName: "deposit",
          args: [getAddress(spotDepositTokenConfig.contract), amountLD],
          account: getAddress(account),
          chain: spotPublicClient.chain,
        });
        helperToast.success(t`Deposit sent`);
        await spotPublicClient.waitForTransactionReceipt({ hash: txHash });
        mutateBalances();
        setIsVisibleOrView("main");
      } catch (error: any) {
        helperToast.error(error?.shortMessage || error?.message || t`Deposit failed`);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // Double-check approval before deposit (MetaMask may be more strict)
    if (needTokenApprove) {
      console.warn("[DepositView] ⚠️ 需要先授权代币", {
        spenderAddress,
        depositViewTokenAddress,
      });
      helperToast.error("Please approve the token first", {
        toastId: "same-chain-deposit-approval-required",
        autoClose: 5000,
      });
      return;
    }

    const vaultAddress = getTradingVaultAddress(settlementChainId);
    console.log("[DepositView] 💰 使用交易 vault 进行充值:", {
      vaultAddress,
      chainId: settlementChainId,
      tokenAddress: depositViewTokenAddress,
      amount: amountLD.toString(),
    });

    await sendSameChainDepositTxn({
      chainId: settlementChainId as SettlementChainId,
      signer: walletSigner!,
      amount: amountLD,
      account,
      callback: sameChainCallback,
    });
  }, [
    account,
    depositViewTokenAddress,
    amountLD,
    isSpotVaultDeposit,
    needTokenApprove,
    sameChainCallback,
    settlementChainId,
    spenderAddress,
    connector,
    spotPublicClient,
    spotDepositTokenConfig?.contract,
    spotChainId,
    spotVaultAddress,
    walletClient,
    walletSigner,
    mutateBalances,
    setIsVisibleOrView,
  ]);

  const makeCrossChainCallback = useCallback(
    (params: {
      depositViewChain: SourceChainId;
      metricId: OrderMetricId;
      sendParams: SendParamStruct;
      tokenAddress: string;
    }): TxnCallback<WalletTxnCtx> =>
      (txnEvent) => {
        if (txnEvent.event === TxnEventName.Error) {
          setIsSubmitting(false);
          let prettyError = txnEvent.data.error;
          const data = txnEvent.data.error.info?.error?.data as Hex | undefined;

          if (data) {
            const error = decodeErrorResult({
              abi: StargateErrorsAbi,
              data,
            });

            prettyError = new Error(JSON.stringify(error, null, 2));
            prettyError.name = error.errorName;

            const toastParams = getTxnErrorToast(
              params.depositViewChain,
              {
                errorMessage: JSON.stringify(error, null, 2),
              },
              { defaultMessage: t`Deposit failed` }
            );

            helperToast.error(toastParams.errorContent, {
              autoClose: toastParams.autoCloseToast,
              toastId: "trading-account-deposit",
            });
          } else {
            const toastParams = getTxnErrorToast(params.depositViewChain, txnEvent.data.error, {
              defaultMessage: t`Deposit failed`,
            });

            helperToast.error(toastParams.errorContent, {
              autoClose: toastParams.autoCloseToast,
              toastId: "trading-account-deposit",
            });
          }

          sendTxnErrorMetric(params.metricId, prettyError, "unknown");
        } else if (txnEvent.event === TxnEventName.Sent) {
          setIsSubmitting(false);

          sendTxnSentMetric(params.metricId);

          // Refresh balances after deposit transaction is sent
          mutateBalances();

          let submittedDepositGuid: string | undefined;

          if (txnEvent.data.type === "wallet") {
            const settlementChainDecimals = getToken(settlementChainId, params.tokenAddress)?.decimals;
            const sourceChainDecimals = getMappedTokenId(
              settlementChainId as SettlementChainId,
              params.tokenAddress,
              params.depositViewChain
            )?.decimals;

            if (settlementChainDecimals !== undefined && sourceChainDecimals !== undefined) {
              const amount = adjustForDecimals(
                params.sendParams.amountLD as bigint,
                sourceChainDecimals,
                settlementChainDecimals
              );

              submittedDepositGuid = setMultichainSubmittedDeposit({
                amount,
                settlementChainId,
                sourceChainId: params.depositViewChain,
                tokenAddress: params.tokenAddress,
                sentTxn: txnEvent.data.transactionHash,
              });
            }
          }

          if (submittedDepositGuid) {
            setSelectedTransferGuid(submittedDepositGuid);
            if (!subaccountState.subaccount && !isExpressTradingDisabled) {
              setIsVisibleOrView("depositStatus");
            }
          }
        } else if (txnEvent.event === TxnEventName.Simulated) {
          sendOrderSimulatedMetric(params.metricId);
        } else if (txnEvent.event === TxnEventName.Sending) {
          sendOrderTxnSubmittedMetric(params.metricId);
        }
      },
    [
      setIsVisibleOrView,
      setMultichainSubmittedDeposit,
      setSelectedTransferGuid,
      settlementChainId,
      subaccountState.subaccount,
      isExpressTradingDisabled,
      mutateBalances,
    ]
  );

  const canSendCrossChainDeposit =
    depositViewTokenAddress &&
    account &&
    amountLD !== undefined &&
    amountLD > 0n &&
    depositViewChain &&
    quoteSend &&
    sendParamsWithSlippage &&
    selectedTokenSourceChainTokenId;

  const handleCrossChainDeposit = useCallback(async (): Promise<boolean> => {
    if (!canSendCrossChainDeposit) {
      helperToast.error(t`Deposit failed`);
      return false;
    }

    setIsSubmitting(true);

    const metricData = initMultichainDepositMetricData({
      assetSymbol: selectedToken!.symbol,
      sizeInUsd: latestInputAmountUsd.current!,
      isFirstDeposit: latestIsFirstDeposit.current,
      settlementChain: settlementChainId,
      sourceChain: depositViewChain,
    });

    sendOrderSubmittedMetric(metricData.metricId);
    await wrapChainAction(depositViewChain, setSettlementChainId, async (signer) => {
      await sendCrossChainDepositTxn({
        chainId: depositViewChain,
        signer,
        tokenAddress: selectedTokenSourceChainTokenId.address,
        stargateAddress: selectedTokenSourceChainTokenId.stargate,
        amount: amountLD,
        quoteSend,
        sendParams: sendParamsWithSlippage,
        account,
        callback: makeCrossChainCallback({
          depositViewChain,
          metricId: metricData.metricId,
          sendParams: sendParamsWithSlippage,
          tokenAddress: depositViewTokenAddress,
        }),
      });
    });

    return true;
  }, [
    account,
    amountLD,
    canSendCrossChainDeposit,
    depositViewChain,
    depositViewTokenAddress,
    latestInputAmountUsd,
    latestIsFirstDeposit,
    makeCrossChainCallback,
    quoteSend,
    selectedToken,
    selectedTokenSourceChainTokenId?.address,
    selectedTokenSourceChainTokenId?.stargate,
    sendParamsWithSlippage,
    setSettlementChainId,
    settlementChainId,
  ]);

  const handleDeposit = useCallback(async () => {
    if (isSpotVaultDeposit) {
      await handleSameChainDeposit();
      return;
    }

    // In development mode or when DEBUG_MULTICHAIN_SAME_CHAIN_DEPOSIT is enabled,
    // use same chain deposit if wallet chain equals settlement chain
    const shouldUseSameChainDeposit =
      (DEBUG_MULTICHAIN_SAME_CHAIN_DEPOSIT || isDevelopment()) &&
      (walletChainId as SettlementChainId) === settlementChainId &&
      Number(depositViewChain) === settlementChainId;

    console.log("[DepositView] 🚀 处理充值请求:", {
      shouldUseSameChainDeposit,
      walletChainId,
      settlementChainId,
      depositViewChain,
      isDevelopment: isDevelopment(),
      DEBUG_MULTICHAIN_SAME_CHAIN_DEPOSIT,
      spenderAddress,
      isTradeMode: isTradeModeActive(),
    });

    if (shouldUseSameChainDeposit) {
      await handleSameChainDeposit();
    } else {
      setIsSubmitting(true);
      setShouldSendCrossChainDepositWhenLoaded(true);
    }
  }, [depositViewChain, handleSameChainDeposit, isSpotVaultDeposit, settlementChainId, walletChainId]);

  const isCrossChainDepositLoading = useRef(false);
  useEffect(() => {
    if (!shouldSendCrossChainDepositWhenLoaded || isCrossChainDepositLoading.current) {
      return;
    }

    if (!canSendCrossChainDeposit) {
      return;
    }

    setShouldSendCrossChainDepositWhenLoaded(false);
    isCrossChainDepositLoading.current = true;
    handleCrossChainDeposit().finally(() => {
      isCrossChainDepositLoading.current = false;
    });
  }, [canSendCrossChainDeposit, handleCrossChainDeposit, shouldSendCrossChainDepositWhenLoaded]);

  useEffect(
    function fallbackDepositViewChain() {
      if (depositViewChain !== undefined || isVisibleOrView === false) {
        return;
      }

      if (isSpotProduct) {
        setDepositViewChain(spotChainId as unknown as SourceChainId);
        return;
      }

      if (srcChainId !== undefined) {
        setDepositViewChain(srcChainId);
      }
    },
    [depositViewChain, isSpotProduct, isVisibleOrView, setDepositViewChain, spotChainId, srcChainId, walletChainId]
  );

  useEffect(() => {
    if (!isSpotProduct || isVisibleOrView === false || !spotTokenConfig) {
      return;
    }

    if (!depositViewTokenAddress) {
      if (depositViewChain !== spotChainId) {
        setDepositViewChain(spotChainId as unknown as SourceChainId);
      }
      setDepositViewTokenAddress(spotTokenConfig.contract);
      return;
    }

    if (selectedWalletTokenConfig) {
      if (depositViewChain !== selectedWalletTokenConfig.chainId) {
        setDepositViewChain(selectedWalletTokenConfig.chainId as unknown as SourceChainId);
      }
      return;
    }

    if (!walletTokenConfigs) {
      return;
    }

    if (depositViewChain !== spotChainId) {
      setDepositViewChain(spotChainId as unknown as SourceChainId);
    }
    if (depositViewTokenAddress?.toLowerCase() !== spotTokenConfig.contract.toLowerCase()) {
      setDepositViewTokenAddress(spotTokenConfig.contract);
    }
  }, [
    depositViewChain,
    depositViewTokenAddress,
    isSpotProduct,
    isVisibleOrView,
    selectedWalletTokenConfig,
    setDepositViewChain,
    setDepositViewTokenAddress,
    spotChainId,
    spotTokenConfig,
    walletTokenConfigs,
  ]);

  useEffect(
    function fallbackTokenOnSourceChain() {
      if (isVisibleOrView === false) {
        return;
      }

      if (isSpotProduct || isSpotVaultDeposit) {
        return;
      }

      const isInvalidTokenAddress =
        depositViewTokenAddress === undefined ||
        !MULTICHAIN_TRANSFER_SUPPORTED_TOKENS[settlementChainId as SettlementChainId]
          ?.map((token) => convertTokenAddress(settlementChainId, token, "native"))
          .includes(depositViewTokenAddress as NativeTokenSupportedAddress);

      if (
        !isPriceDataLoading &&
        multichainTokens.length > 0 &&
        depositViewChain !== undefined &&
        isInvalidTokenAddress
      ) {
        const preferredToken = multichainTokens.find(
          (sourceChainToken) =>
            sourceChainToken.sourceChainId === depositViewChain &&
            sourceChainToken.address === CHAIN_ID_PREFERRED_DEPOSIT_TOKEN[settlementChainId]
        );

        if (
          preferredToken &&
          preferredToken.sourceChainBalance !== undefined &&
          preferredToken.sourceChainBalance >= 0n
        ) {
          setDepositViewTokenAddress(preferredToken.address);
          return;
        }

        let maxBalanceTokenAddress: string | undefined = undefined;
        let maxSourceChainBalanceUsd: bigint | undefined = undefined;

        for (const token of multichainTokens) {
          if (token.sourceChainId !== depositViewChain) {
            continue;
          }

          const balanceUsd = token.sourceChainPrices
            ? convertToUsd(token.sourceChainBalance, token.sourceChainDecimals, getMidPrice(token.sourceChainPrices))
            : 0n;
          if (
            maxBalanceTokenAddress === undefined ||
            maxSourceChainBalanceUsd === undefined ||
            (balanceUsd !== undefined && balanceUsd > maxSourceChainBalanceUsd)
          ) {
            maxBalanceTokenAddress = token.address;
            maxSourceChainBalanceUsd = balanceUsd;
          }
        }

        if (maxBalanceTokenAddress !== undefined) {
          setDepositViewTokenAddress(maxBalanceTokenAddress);
          return;
        }

        if (preferredToken) {
          setDepositViewTokenAddress(preferredToken.address);
        }
      }
    },
    [
      depositViewTokenAddress,
      isSpotVaultDeposit,
      isPriceDataLoading,
      multichainTokens,
      setDepositViewTokenAddress,
      settlementChainId,
      depositViewChain,
      isVisibleOrView,
    ]
  );

  const tokenSelectorDisabled = isSpotProduct
    ? !spotTokenConfig
    : isSpotVaultDeposit
      ? false
      : !isBalanceDataLoading && multichainTokens.length === 0;

  let buttonState: {
    text: React.ReactNode;
    disabled?: boolean;
    onClick?: () => void;
  } = {
    text: t`Deposit`,
    onClick: handleDeposit,
  };

  if (isApproving) {
    buttonState = {
      text: (
        <>
          <Trans>Approving</Trans>
          <SpinnerIcon className="ml-4 animate-spin" />
        </>
      ),
      disabled: true,
    };
  } else if (tokenSelectorDisabled) {
    buttonState = {
      text:
        depositViewChain !== undefined
          ? t`No eligible tokens available on ${getFundingChainName(depositViewChain)} for deposit`
          : t`No eligible tokens available for deposit`,
      disabled: true,
    };
  } else if (needTokenApprove) {
    buttonState = {
      text: t`Allow ${selectedToken?.symbol} to be spent`,
      onClick: handleApprove,
    };
  } else if (isSubmitting) {
    buttonState = {
      text: (
        <>
          <Trans>Depositing</Trans>
          <SpinnerIcon className="ml-4 animate-spin" />
        </>
      ),
      disabled: true,
    };
  } else if (isInputEmpty) {
    buttonState = {
      text: t`Enter deposit amount`,
      disabled: true,
    };
  } else if (selectedTokenSourceChainBalance !== undefined && amountLD > selectedTokenSourceChainBalance) {
    buttonState = {
      text: t`Insufficient balance`,
      disabled: true,
    };
  } else if (nativeTokenSourceChainBalance !== undefined && quoteSend !== undefined) {
    const isNative = unwrappedSelectedTokenAddress === zeroAddress;
    const value = isNative ? amountLD : 0n;

    if (quoteSend.nativeFee + value > nativeTokenSourceChainBalance) {
      const nativeTokenSymbol = getNativeToken(settlementChainId)?.symbol;
      buttonState = {
        text: t`Insufficient ${nativeTokenSymbol} balance`,
        disabled: true,
      };
    }
  }

  const onClick = buttonState.onClick;
  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      onClick?.();
    },
    [onClick]
  );

  const isTestnet = isTestnetChain(settlementChainId);

  return (
    <form className="flex grow flex-col overflow-y-auto px-adaptive pb-adaptive pt-adaptive" onSubmit={handleSubmit}>
      <div className="flex flex-col gap-[--padding-adaptive]">
        <div className="flex flex-col gap-6">
          <div className="text-body-medium text-typography-secondary">
            <Trans>Asset</Trans>
          </div>
          {!tokenSelectorDisabled ? (
            <div
              tabIndex={0}
              role="button"
              onClick={() => {
                setIsVisibleOrView("selectAssetToDeposit");
              }}
              className="flex items-center justify-between rounded-8 border border-slate-800 bg-slate-800 px-14 py-13 app-hover:bg-fill-surfaceElevatedHover"
            >
              <div className="flex items-center gap-8">
                {selectedToken ? (
                  <>
                    <TokenIcon symbol={selectedToken.symbol} displaySize={20} />
                    <span className="text-16 leading-base">{selectedToken.symbol}</span>
                  </>
                ) : depositViewChain !== undefined ? (
                  <>
                    <Skeleton
                      baseColor="#B4BBFF1A"
                      highlightColor="#B4BBFF1A"
                      width={20}
                      height={20}
                      borderRadius={10}
                    />
                    <Skeleton baseColor="#B4BBFF1A" highlightColor="#B4BBFF1A" width={40} height={16} />
                  </>
                ) : (
                  <span className="text-typography-secondary">
                    <Trans>Pick an asset to deposit</Trans>
                  </span>
                )}
              </div>
              <ChevronRightIcon className="size-14 text-typography-secondary" />
            </div>
          ) : (
            <div className="rounded-8 border border-slate-800 bg-slate-800 px-14 py-13 text-typography-secondary">
              <span className="flex min-h-20 items-center">
                {depositViewChain !== undefined ? (
                  <Trans>No eligible tokens available on {getFundingChainName(depositViewChain)} for deposit</Trans>
                ) : (
                  <Trans>No eligible tokens available for deposit</Trans>
                )}
              </span>
            </div>
          )}
        </div>
        {depositViewChain !== undefined && (
          <div className="flex flex-col gap-6">
            <div className="text-body-medium text-typography-secondary">
              <Trans>From Network</Trans>
            </div>
            <div className="flex items-center gap-8 rounded-8 border border-slate-600 px-14 py-13">
              <img src={getChainIcon(depositViewChain)} alt={getFundingChainName(depositViewChain)} className="size-20" />
              <span className="text-16 leading-base text-typography-secondary">{getFundingChainName(depositViewChain)}</span>
            </div>
          </div>
        )}

        <div className={cx("flex flex-col gap-6", { invisible: depositViewTokenAddress === undefined })}>
          <div className="text-body-medium flex items-center justify-between gap-6 text-typography-secondary">
            <Trans>Deposit</Trans>
            {selectedTokenSourceChainBalance !== undefined &&
              selectedToken !== undefined &&
              selectedTokenSourceChainDecimals !== undefined && (
                <div>
                  <Trans>Available:</Trans>{" "}
                  <Amount
                    className="text-typography-primary"
                    amount={selectedTokenSourceChainBalance}
                    decimals={selectedTokenSourceChainDecimals}
                    isStable={selectedToken.isStable}
                    symbol={selectedToken.symbol}
                  />
                </div>
              )}
          </div>
          <div className="relative text-16 leading-base">
            <NumberInput
              value={inputValue}
              onValueChange={(e) => setInputValue(e.target.value)}
              className="w-full rounded-8 border border-slate-800 bg-slate-800 py-13 pl-12 pr-96 text-16 leading-base
                         focus-within:border-blue-300 hover:bg-fill-surfaceElevatedHover"
              placeholder="0.00"
            />
            <div className="pointer-events-none absolute right-14 top-1/2 flex -translate-y-1/2 items-center gap-8">
              <span className="text-typography-secondary">{selectedToken?.symbol}</span>
              <button
                className="text-body-small pointer-events-auto rounded-full bg-slate-600 px-8 py-2 font-medium
                           hover:bg-slate-500 focus-visible:bg-slate-500 active:bg-slate-500/70"
                type="button"
                onClick={handleMaxButtonClick}
              >
                <Trans>Max</Trans>
              </button>
            </div>
          </div>
          <div className="text-body-medium text-typography-secondary numbers">{formatUsd(inputAmountUsd ?? 0n)}</div>
        </div>
      </div>

      {isAboveLimit && (
        <AlertInfoCard type="warning" className="mt-8">
          <div>
            <Trans>
              The amount you are trying to deposit exceeds the limit. Please try an amount smaller than{" "}
              <span className="numbers">{upperLimitFormatted}</span>.
            </Trans>
          </div>
        </AlertInfoCard>
      )}
      {isBelowLimit && (
        <AlertInfoCard type="warning" className="mt-8">
          <div>
            <Trans>
              The amount you are trying to deposit is below the limit. Please try an amount larger than{" "}
              <span className="numbers">{lowerLimitFormatted}</span>.
            </Trans>
          </div>
        </AlertInfoCard>
      )}
      <div className="h-32 shrink-0 grow" />

      {depositViewTokenAddress && (
        <div className="mb-16 flex flex-col gap-10">
          <SyntheticsInfoRow
            label={<Trans>Estimated Time</Trans>}
            value={
              inputAmount === undefined || inputAmount === 0n ? (
                "..."
              ) : isTestnet ? (
                <Trans>1m 40s</Trans>
              ) : (
                <Trans>30s</Trans>
              )
            }
          />
          <SyntheticsInfoRow
            label={<Trans>Network Fee</Trans>}
            value={
              networkFee !== undefined && depositViewViemChain ? (
                <AmountWithUsdBalance
                  className="leading-1"
                  amount={networkFee}
                  decimals={depositViewViemChain.nativeCurrency.decimals}
                  usd={networkFeeUsd}
                  symbol={depositViewViemChain.nativeCurrency.symbol}
                />
              ) : (
                "..."
              )
            }
          />
          <SyntheticsInfoRow
            label={<Trans>Deposit Fee</Trans>}
            value={
              protocolFeeAmount !== undefined && selectedTokenSourceChainDecimals !== undefined ? (
                <AmountWithUsdBalance
                  className="leading-1"
                  amount={protocolFeeAmount}
                  decimals={selectedTokenSourceChainDecimals}
                  usd={protocolFeeUsd}
                  symbol={selectedToken?.symbol}
                />
              ) : (
                "..."
              )
            }
          />
          {/* <SyntheticsInfoRow
            label={<Trans>Trading Account Balance</Trans>}
            value={<ValueTransition from={formatUsd(tradingAccountUsd)} to={formatUsd(nextTradingAccountBalanceUsd)} />}
          /> */}
        </div>
      )}

      <Button variant="primary-action" className="w-full shrink-0" type="submit" disabled={buttonState.disabled}>
        {buttonState.text}
      </Button>
    </form>
  );
};
