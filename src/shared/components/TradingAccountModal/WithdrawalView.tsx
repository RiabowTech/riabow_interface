import { t, Trans } from "@lingui/macro";
import cx from "classnames";
import { type Provider } from "ethers";
import { useCallback, useEffect, useMemo, useState } from "react";
import Skeleton from "react-loading-skeleton";
import { useHistory } from "react-router-dom";
import { Address, encodeAbiParameters, getAddress, zeroAddress } from "viem";
import { getWalletClient } from "@wagmi/core";
import { useAccount } from "wagmi";

import {
  ContractsChainId,
  DEFAULT_CHAIN_ID,
  getChainName,
  isContractsChain,
  isTestnetChain,
  SettlementChainId,
  SourceChainId,
} from "config/chains";
import { CHAIN_ID_TO_NETWORK_ICON } from "config/icons";
import {
  CHAIN_ID_PREFERRED_DEPOSIT_TOKEN,
  FAKE_INPUT_AMOUNT_MAP,
  getLayerZeroEndpointId,
  getMappedTokenId,
  getMultichainTokenId,
  getStargatePoolAddress,
  isSettlementChain,
  MULTICHAIN_FUNDING_SLIPPAGE_BPS,
  MULTICHAIN_TOKEN_MAPPING,
  MULTICHAIN_TRANSFER_SUPPORTED_TOKENS,
} from "config/multichain";
import {
  useTradingAccountDepositViewTokenAddress,
  useTradingAccountDepositViewTokenInputValue,
  useTradingAccountModalOpen,
  useTradingAccountSettlementChainId,
  useTradingAccountWithdrawalViewChain,
  useTradingAccountWithdrawalViewTokenAddress,
  useTradingAccountWithdrawalViewTokenInputValue,
} from "@/modules/lighter/context/TradingAccountContext";
import { useSettings } from "@/modules/lighter/context/SettingsContext";
import { useSyntheticsEvents } from "@/modules/lighter/context/SyntheticsEvents";
import {
  selectExpressGlobalParams,
  selectGasPaymentToken,
} from "@/modules/lighter/store/SyntheticsStateContext/selectors/expressSelectors";
import { useSelector } from "@/modules/lighter/store/SyntheticsStateContext/utils";
import {
  useArbitraryError,
  useArbitraryRelayParamsAndPayload,
} from "@/modules/lighter/domain/multichain/arbitraryRelayParams";
import { fallbackCustomError } from "@/modules/lighter/domain/multichain/fallbackCustomError";
import { getMultichainTransferSendParams } from "@/modules/lighter/domain/multichain/getSendParams";
import { BridgeOutParams } from "@/modules/lighter/domain/multichain/types";
import { useTradingAccountFundingHistory } from "@/modules/lighter/domain/multichain/useTradingAccountFundingHistory";
import { useMultichainQuoteFeeUsd } from "@/modules/lighter/domain/multichain/useMultichainQuoteFeeUsd";
import { useQuoteOft } from "@/modules/lighter/domain/multichain/useQuoteOft";
import { useQuoteOftLimits } from "@/modules/lighter/domain/multichain/useQuoteOftLimits";
import { useQuoteSend } from "@/modules/lighter/domain/multichain/useQuoteSend";
import { callRelayTransaction } from "domain/synthetics/express/callRelayTransaction";
import { buildAndSignBridgeOutTxn } from "domain/synthetics/express/expressOrderUtils";
import { ExpressTransactionBuilder, RawRelayParamsPayload } from "domain/synthetics/express/types";
import { useTokensDataRequest } from "domain/synthetics/tokens";
import { convertToUsd, TokenData } from "domain/tokens";
import { useChainId } from "lib/chains";
import { useLeadingDebounce } from "lib/debounce/useLeadingDebounde";
import { helperToast } from "lib/helperToast";
import {
  initMultichainWithdrawalMetricData,
  sendOrderSimulatedMetric,
  sendOrderSubmittedMetric,
  sendOrderTxnSubmittedMetric,
  sendTxnErrorMetric,
  sendTxnSentMetric,
  sendTxnValidationErrorMetric,
} from "lib/metrics";
import { bigintToNumber, expandDecimals, formatAmountFree, formatUsd, parseValue, USD_DECIMALS } from "lib/numbers";
import { EMPTY_ARRAY, getByKey } from "lib/objects";
import { useJsonRpcProvider } from "lib/rpc";
import { ExpressTxnData, sendExpressTransaction } from "lib/transactions/sendExpressTransaction";
import { switchNetwork, WalletSigner } from "lib/wallets";
import { getRainbowKitConfig } from "lib/wallets/rainbowKitConfig";
import { getGasPaymentTokens } from "sdk/configs/express";
import { convertTokenAddress, getToken, getWrappedToken } from "sdk/configs/tokens";
import { bigMath } from "sdk/utils/bigmath";
import { convertToTokenAmount, getMidPrice } from "sdk/utils/tokens";
import { applySlippageToMinOut } from "sdk/utils/trade";
import type { SendParamStruct } from "typechain-types-stargate/IStargate";

import { AlertInfoCard } from "components/AlertInfo/AlertInfoCard";
import { Amount } from "components/Amount/Amount";
import { AmountWithUsdBalance } from "components/AmountWithUsd/AmountWithUsd";
import Button from "components/Button/Button";
import { DropdownSelector } from "components/DropdownSelector/DropdownSelector";
import {
  useAvailableToTradeAssetMultichain,
  useTradingAccountWithdrawNetworks,
} from "components/TradingAccountModal/hooks";
import NumberInput from "components/NumberInput/NumberInput";
import TokenIcon from "components/TokenIcon/TokenIcon";
import { ValueTransition } from "components/ValueTransition/ValueTransition";

import SpinnerIcon from "img/ic_spinner.svg?react";

import { SyntheticsInfoRow } from "../SyntheticsInfoRow";
import { InsufficientWntBanner } from "./InsufficientWntBanner";
import { toastCustomOrStargateError } from "./toastCustomOrStargateError";
import { isTradeModeActive, useTradeProduct } from "@/modules/lighter/store/TradeStateContext/TradeStateContext";
import { useZanbaraBalancesForProduct, useZanbaraUserBalances } from "@/modules/lighter/api";
import {
  requestWithdraw,
  confirmWithdraw,
  isAuthenticated,
  getWithdrawById,
  getWithdrawHistory,
} from "@/modules/lighter/api/custom/client";
import type { WithdrawRecord, WithdrawResponse } from "@/modules/lighter/api/types";
import {
  DEFAULT_SPOT_CHAIN_ID,
  getSpotVaultAddress,
  getTradingVaultAddress,
  getTradingUsdtAddress,
} from "config/custom/contracts";
import VaultAbi from "sdk/abis/Vault";
import SpotVaultAbi from "sdk/abis/SpotVault";
import { usePublicClient } from "wagmi";
import useWallet from "lib/wallets/useWallet";
import { parseUnits } from "viem";
import { wrapChainAction } from "./wrapChainAction";
import { findWalletTokenConfig, useWalletTokensConfig } from "@/modules/lighter/api/custom/walletTokens";

const USD_GAS_TOKEN_BUFFER_MAINNET = expandDecimals(4, USD_DECIMALS);
const USD_GAS_TOKEN_WARNING_THRESHOLD_MAINNET = expandDecimals(3, USD_DECIMALS);
const USD_GAS_TOKEN_BUFFER_TESTNET = expandDecimals(10, USD_DECIMALS);
const USD_GAS_TOKEN_WARNING_THRESHOLD_TESTNET = expandDecimals(9, USD_DECIMALS);

function getFundingChainName(chainId: number) {
  return chainId === DEFAULT_SPOT_CHAIN_ID ? "BNB Testnet" : getChainName(chainId);
}

type SpotWithdrawAuthorization = (WithdrawRecord | WithdrawResponse) & {
  signature?: string;
  vault_address?: string;
  deadline?: number;
  withdraw_id?: string;
};

function isReusableSpotWithdrawalStatus(status?: string) {
  return status === "signed" || status === "pending";
}

function isSameDecimalAmount(first?: string, second?: string) {
  const firstNumber = Number(first);
  const secondNumber = Number(second);

  if (Number.isFinite(firstNumber) && Number.isFinite(secondNumber)) {
    return Math.abs(firstNumber - secondNumber) < 1e-12;
  }

  return String(first ?? "").trim() === String(second ?? "").trim();
}

function useUsdGasTokenBuffer(): {
  gasTokenBuffer: bigint;
  gasTokenBufferWarningThreshold: bigint;
} {
  const { chainId } = useChainId();
  const isMainnet = isContractsChain(chainId, false);

  if (!isMainnet) {
    return {
      gasTokenBuffer: USD_GAS_TOKEN_BUFFER_TESTNET,
      gasTokenBufferWarningThreshold: USD_GAS_TOKEN_WARNING_THRESHOLD_TESTNET,
    };
  }

  return {
    gasTokenBuffer: USD_GAS_TOKEN_BUFFER_MAINNET,
    gasTokenBufferWarningThreshold: USD_GAS_TOKEN_WARNING_THRESHOLD_MAINNET,
  };
}

const useIsFirstWithdrawal = () => {
  const [enabled, setEnabled] = useState(true);
  const [isFirstWithdrawal, setIsFirstWithdrawal] = useState(false);
  const { fundingHistory, isLoading } = useTradingAccountFundingHistory({ enabled });

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (fundingHistory === undefined || fundingHistory.length !== 0) {
      return;
    }

    setEnabled(false);
    const hasWithdrawal = fundingHistory.some((funding) => funding.operation === "withdrawal");
    if (!hasWithdrawal) {
      setIsFirstWithdrawal(true);
    }
  }, [fundingHistory, isLoading]);

  return isFirstWithdrawal;
};

export const WithdrawalView = () => {
  const history = useHistory();
  const { chainId } = useChainId();
  const [, setSettlementChainId] = useTradingAccountSettlementChainId();
  const [withdrawalViewChain, setWithdrawalViewChain] = useTradingAccountWithdrawalViewChain();
  const { address: account } = useAccount();
  const [, setDepositViewTokenAddress] = useTradingAccountDepositViewTokenAddress();
  const [, setDepositViewTokenInputValue] = useTradingAccountDepositViewTokenInputValue();
  const [isVisibleOrView, setIsVisibleOrView] = useTradingAccountModalOpen();
  const [inputValue, setInputValue] = useTradingAccountWithdrawalViewTokenInputValue();
  const [selectedTokenAddress, setSelectedTokenAddress] = useTradingAccountWithdrawalViewTokenAddress();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isFirstWithdrawal = useIsFirstWithdrawal();
  const { setIsSettingsVisible } = useSettings();
  const { setMultichainSubmittedWithdrawal, setMultichainWithdrawalSentTxnHash, setMultichainWithdrawalSentError } =
    useSyntheticsEvents();

  // API trading mode check - keep this above dependent effects.
  const isTradeMode = isTradeModeActive();
  const product = useTradeProduct();
  const isSpotProduct = product === "spot";
  const spotChainId = DEFAULT_SPOT_CHAIN_ID;
  const spotVaultAddress = getSpotVaultAddress(spotChainId);
  const { data: walletTokenConfigs } = useWalletTokensConfig();
  const spotTokenConfig = findWalletTokenConfig(walletTokenConfigs, spotChainId);
  const futuresWithdrawalChainId = isSpotProduct ? DEFAULT_CHAIN_ID : chainId;
  const tradingUsdtAddress = futuresWithdrawalChainId ? getTradingUsdtAddress(futuresWithdrawalChainId) : undefined;
  const selectedTokenAddressLower = selectedTokenAddress?.toLowerCase();
  const spotTokenAddressLower = spotTokenConfig?.contract.toLowerCase();
  const tradingUsdtAddressLower = tradingUsdtAddress?.toLowerCase();
  const isSpotVaultWithdrawal =
    isSpotProduct && !!selectedTokenAddressLower && selectedTokenAddressLower === spotTokenAddressLower;
  const activeWithdrawalProduct = isSpotVaultWithdrawal ? "spot" : "futures";
  const apiChainId = isSpotVaultWithdrawal ? spotChainId : futuresWithdrawalChainId;
  const authChainId = DEFAULT_CHAIN_ID;
  const withdrawContractChainId = isSpotVaultWithdrawal ? spotChainId : futuresWithdrawalChainId;

  // In API trading mode, default the withdrawal token to USDT.
  useEffect(() => {
    if (isTradeMode && !selectedTokenAddress) {
      const defaultTokenAddress = isSpotProduct ? spotTokenConfig?.contract : getTradingUsdtAddress(futuresWithdrawalChainId);
      if (defaultTokenAddress) {
        setSelectedTokenAddress(defaultTokenAddress);
      }
    }
  }, [
    futuresWithdrawalChainId,
    isTradeMode,
    isSpotProduct,
    selectedTokenAddress,
    setSelectedTokenAddress,
    spotTokenConfig?.contract,
  ]);
  useEffect(() => {
    if (!isSpotProduct || isVisibleOrView === false) {
      return;
    }

    if (!selectedTokenAddress && spotTokenConfig) {
      setSelectedTokenAddress(spotTokenConfig.contract);
      return;
    }

    const nextWithdrawalChain = isSpotVaultWithdrawal ? spotChainId : futuresWithdrawalChainId;
    if (nextWithdrawalChain && withdrawalViewChain !== nextWithdrawalChain) {
      setWithdrawalViewChain(nextWithdrawalChain as SourceChainId);
    }
  }, [
    futuresWithdrawalChainId,
    isSpotVaultWithdrawal,
    isSpotProduct,
    isVisibleOrView,
    selectedTokenAddress,
    setSelectedTokenAddress,
    setWithdrawalViewChain,
    spotChainId,
    spotTokenConfig,
    withdrawalViewChain,
  ]);
  const { chainId: walletChainId, walletClient } = useWallet();
  const publicClient = usePublicClient({ chainId: withdrawContractChainId });
  // Only subscribe to API balances in API trading mode to avoid unnecessary state churn.
  const balancesResult = useZanbaraUserBalances(isTradeMode ? { refreshInterval: 10000 } : undefined);
  const futuresBalancesResult = useZanbaraBalancesForProduct("futures", isTradeMode ? futuresWithdrawalChainId : undefined, {
    refreshInterval: 10000,
  });
  const mutateBalances = isTradeMode ? balancesResult.mutate : undefined;

  const { tokensData } = useTokensDataRequest(chainId, withdrawalViewChain);
  const networks = useTradingAccountWithdrawNetworks();
  const globalExpressParams = useSelector(selectExpressGlobalParams);
  const relayerFeeToken = getByKey(tokensData, globalExpressParams?.relayerFeeTokenAddress);
  const { gasTokenBuffer, gasTokenBufferWarningThreshold } = useUsdGasTokenBuffer();

  const { provider } = useJsonRpcProvider(chainId);

  const spotToken = useMemo<TokenData | undefined>(() => {
    if (!isSpotProduct || !spotTokenConfig) {
      return undefined;
    }

    const apiBalance = balancesResult.data?.balances?.find(
      (balance) => balance.symbol?.toLowerCase() === spotTokenConfig.symbol.toLowerCase()
    );
    const tradingAccountBalance = apiBalance ? parseUnits(apiBalance.available || "0", spotTokenConfig.decimals) : 0n;

    return {
      name: spotTokenConfig.symbol,
      symbol: spotTokenConfig.symbol,
      decimals: spotTokenConfig.decimals,
      address: spotTokenConfig.contract,
      isStable: spotTokenConfig.symbol.toUpperCase().includes("USD"),
      prices: { minPrice: 0n, maxPrice: 0n },
      tradingAccountBalance,
      balance: tradingAccountBalance,
      walletBalance: 0n,
    };
  }, [balancesResult.data?.balances, isSpotProduct, spotTokenConfig]);

  const futuresUsdtToken = useMemo<TokenData | undefined>(() => {
    if (!isSpotProduct || !tradingUsdtAddress) {
      return undefined;
    }

    let baseToken: TokenData;
    try {
      baseToken = {
        ...getToken(futuresWithdrawalChainId, tradingUsdtAddress),
        prices: { minPrice: expandDecimals(1, USD_DECIMALS), maxPrice: expandDecimals(1, USD_DECIMALS) },
      };
    } catch {
      baseToken = {
        name: "Tether",
        symbol: "USDT",
        decimals: 6,
        address: tradingUsdtAddress,
        isStable: true,
        prices: { minPrice: expandDecimals(1, USD_DECIMALS), maxPrice: expandDecimals(1, USD_DECIMALS) },
      };
    }

    const apiBalance = futuresBalancesResult.data?.balances?.find((balance) => {
      const symbol = balance.symbol?.toUpperCase();
      const token = balance.token?.toUpperCase();
      return (
        symbol === "USDT" ||
        token === "USDT" ||
        balance.token?.toLowerCase() === tradingUsdtAddress.toLowerCase()
      );
    });
    const tradingAccountBalance = apiBalance ? parseUnits(apiBalance.available || "0", baseToken.decimals) : 0n;

    return {
      ...baseToken,
      tradingAccountBalance,
      balance: tradingAccountBalance,
    };
  }, [futuresBalancesResult.data?.balances, futuresWithdrawalChainId, isSpotProduct, tradingUsdtAddress]);

  const selectedToken = useMemo(() => {
    if (isSpotProduct) {
      if (!selectedTokenAddressLower) {
        return undefined;
      }
      if (selectedTokenAddressLower === spotTokenAddressLower) {
        return spotToken;
      }
      if (selectedTokenAddressLower === tradingUsdtAddressLower) {
        return futuresUsdtToken;
      }
      return undefined;
    }
    return getByKey(tokensData, selectedTokenAddress);
  }, [
    futuresUsdtToken,
    isSpotProduct,
    selectedTokenAddress,
    selectedTokenAddressLower,
    spotToken,
    spotTokenAddressLower,
    tokensData,
    tradingUsdtAddressLower,
  ]);

  const unwrappedSelectedTokenAddress =
    isSpotProduct
      ? selectedTokenAddress
      : selectedTokenAddress !== undefined
        ? convertTokenAddress(chainId, selectedTokenAddress, "native")
        : undefined;
  const unwrappedSelectedTokenSymbol = isSpotProduct
    ? selectedToken?.symbol
    : unwrappedSelectedTokenAddress
      ? getToken(chainId, unwrappedSelectedTokenAddress).symbol
      : undefined;
  const wrappedNativeTokenAddress = getWrappedToken(chainId).address;
  const wrappedNativeToken = getByKey(tokensData, wrappedNativeTokenAddress);

  const selectedTokenSettlementChainTokenId = unwrappedSelectedTokenAddress
    ? isSpotVaultWithdrawal && spotTokenConfig
      ? {
          chainId: spotTokenConfig.chainId,
          address: spotTokenConfig.contract,
          decimals: spotTokenConfig.decimals,
          stargate: "",
          symbol: spotTokenConfig.symbol,
        }
      : getMultichainTokenId(chainId, unwrappedSelectedTokenAddress)
    : undefined;

  const realInputAmount =
    selectedToken && inputValue !== undefined ? parseValue(inputValue, selectedToken.decimals) : undefined;
  const inputAmount = useLeadingDebounce(realInputAmount);
  const inputAmountUsd = selectedToken
    ? convertToUsd(inputAmount, selectedToken.decimals, selectedToken.prices.maxPrice)
    : undefined;

  const filteredNetworks = useMemo(() => {
    if (isSpotProduct) {
      const activeChainId = isSpotVaultWithdrawal ? spotChainId : futuresWithdrawalChainId;
      return activeChainId ? [{ id: activeChainId, name: getFundingChainName(activeChainId) }] : EMPTY_ARRAY;
    }

    if (!unwrappedSelectedTokenAddress) {
      return networks;
    }

    return networks.filter((network) => {
      const mappedTokenId = getMappedTokenId(
        chainId as SettlementChainId,
        unwrappedSelectedTokenAddress,
        network.id as SourceChainId
      );
      return mappedTokenId !== undefined;
    });
  }, [
    unwrappedSelectedTokenAddress,
    networks,
    chainId,
    futuresWithdrawalChainId,
    isSpotProduct,
    isSpotVaultWithdrawal,
    spotChainId,
  ]);

  const options = useMemo((): TokenData[] => {
    if (isSpotProduct) {
      return [spotToken, futuresUsdtToken].filter((token): token is TokenData => Boolean(token));
    }

    if (!isSettlementChain(chainId) || !tokensData) {
      return EMPTY_ARRAY;
    }

    // In API trading mode, only show USDT.
    if (isTradeMode) {
      const usdtAddress = getTradingUsdtAddress(chainId);
      if (!usdtAddress) {
        return EMPTY_ARRAY;
      }
      const usdtToken = tokensData[usdtAddress] as TokenData | undefined;
      if (!usdtToken || usdtToken.address === zeroAddress) {
        return EMPTY_ARRAY;
      }
      return [usdtToken];
    }

    return (
      MULTICHAIN_TRANSFER_SUPPORTED_TOKENS[chainId]
        ?.map((tokenAddress) => tokensData[tokenAddress] as TokenData | undefined)
        .filter((token): token is TokenData => {
          return token !== undefined && token.address !== zeroAddress;
        })
        .sort((a, b) => {
          const aFloat = bigintToNumber(a.tradingAccountBalance ?? 0n, a.decimals);
          const bFloat = bigintToNumber(b.tradingAccountBalance ?? 0n, b.decimals);

          return bFloat - aFloat;
        }) ?? EMPTY_ARRAY
    );
  }, [chainId, tokensData, isTradeMode, isSpotProduct, spotToken, futuresUsdtToken]);

  const { tradingAccountUsd } = useAvailableToTradeAssetMultichain();

  const { nextTradingAccountBalanceUsd } = useMemo(() => {
    if (selectedToken === undefined || inputAmount === undefined || inputAmountUsd === undefined) {
      return { nextTradingAccountBalanceUsd: undefined };
    }

    const nextTradingAccountBalanceUsd = (tradingAccountUsd ?? 0n) - inputAmountUsd;

    return { nextTradingAccountBalanceUsd };
  }, [selectedToken, inputAmount, inputAmountUsd, tradingAccountUsd]);

  const sendParamsWithoutSlippage: SendParamStruct | undefined = useMemo(() => {
    if (isTradeMode) {
      return;
    }

    if (!account || inputAmount === undefined || inputAmount <= 0n || withdrawalViewChain === undefined) {
      return;
    }

    return getMultichainTransferSendParams({
      dstChainId: withdrawalViewChain,
      account,
      amountLD: inputAmount,
      isDeposit: false,
    });
  }, [account, inputAmount, isTradeMode, withdrawalViewChain]);

  const quoteOft = useQuoteOft({
    sendParams: sendParamsWithoutSlippage,
    fromStargateAddress: selectedTokenSettlementChainTokenId?.stargate,
    fromChainProvider: provider,
    fromChainId: chainId,
    toChainId: withdrawalViewChain,
  });

  const { isBelowLimit, lowerLimitFormatted, isAboveLimit, upperLimitFormatted } = useQuoteOftLimits({
    quoteOft,
    amountLD: inputAmount,
    isStable: selectedToken?.isStable,
    decimals: selectedTokenSettlementChainTokenId?.decimals,
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
    fromStargateAddress: selectedTokenSettlementChainTokenId?.stargate,
    fromChainProvider: provider,
    fromChainId: chainId,
    toChainId: withdrawalViewChain,
  });

  const baseSendParams = useMemo(() => {
    if (isTradeMode) {
      return;
    }

    if (!withdrawalViewChain || !account || !unwrappedSelectedTokenSymbol) {
      return;
    }

    const fakeInputAmount = FAKE_INPUT_AMOUNT_MAP[unwrappedSelectedTokenSymbol];

    if (fakeInputAmount === undefined) {
      return;
    }

    return getMultichainTransferSendParams({
      dstChainId: withdrawalViewChain,
      account,
      amountLD: fakeInputAmount,
      isDeposit: false,
      srcChainId: chainId,
    });
  }, [account, chainId, isTradeMode, unwrappedSelectedTokenSymbol, withdrawalViewChain]);
  const isMaxButtonDisabled = useMemo(() => {
    if (!baseSendParams) {
      return true;
    }

    return false;
  }, [baseSendParams]);

  const baseQuoteSend = useQuoteSend({
    sendParams: baseSendParams,
    fromStargateAddress: selectedTokenSettlementChainTokenId?.stargate,
    fromChainProvider: provider,
    fromChainId: chainId,
    toChainId: withdrawalViewChain,
  });

  const {
    networkFeeUsd: bridgeNetworkFeeUsd,
    protocolFeeUsd,
    protocolFeeAmount,
    networkFee: bridgeNetworkFee,
  } = useMultichainQuoteFeeUsd({
    quoteSend,
    quoteOft,
    unwrappedTokenAddress: unwrappedSelectedTokenAddress,
    sourceChainId: chainId,
    targetChainId: withdrawalViewChain,
  });

  const bridgeOutParams: BridgeOutParams | undefined = useMemo(() => {
    if (isTradeMode) {
      return;
    }

    if (
      withdrawalViewChain === undefined ||
      selectedTokenAddress === undefined ||
      unwrappedSelectedTokenAddress === undefined ||
      inputAmount === undefined ||
      inputAmount <= 0n
    ) {
      return;
    }

    const dstEid = getLayerZeroEndpointId(withdrawalViewChain);
    const stargateAddress = getStargatePoolAddress(chainId, unwrappedSelectedTokenAddress);

    if (dstEid === undefined || stargateAddress === undefined) {
      return;
    }

    return {
      token: selectedTokenAddress as Address,
      amount: inputAmount,
      minAmountOut: inputAmount,
      data: encodeAbiParameters(
        [
          {
            type: "uint32",
            name: "dstEid",
          },
        ],
        [dstEid]
      ),
      provider: stargateAddress,
    };
  }, [withdrawalViewChain, selectedTokenAddress, unwrappedSelectedTokenAddress, inputAmount, chainId, isTradeMode]);

  const expressTransactionBuilder: ExpressTransactionBuilder | undefined = useMemo(() => {
    if (
      account === undefined ||
      bridgeOutParams === undefined ||
      provider === undefined ||
      withdrawalViewChain === undefined
    ) {
      return;
    }

    const expressTransactionBuilder: ExpressTransactionBuilder = async ({ gasPaymentParams, relayParams }) => ({
      txnData: await buildAndSignBridgeOutTxn({
        chainId: chainId as SettlementChainId,
        signer: undefined,
        account,
        relayParamsPayload: relayParams as RawRelayParamsPayload,
        params: bridgeOutParams,
        emptySignature: true,
        relayerFeeTokenAddress: gasPaymentParams.relayerFeeTokenAddress,
        relayerFeeAmount: gasPaymentParams.relayerFeeAmount,
        srcChainId: withdrawalViewChain,
      }),
    });

    return expressTransactionBuilder;
  }, [account, bridgeOutParams, chainId, provider, withdrawalViewChain]);

  const expressTxnParamsAsyncResult = useArbitraryRelayParamsAndPayload({
    expressTransactionBuilder,
    isTradingAccount: true,
  });

  const errors = useArbitraryError(expressTxnParamsAsyncResult.error);

  const isOutOfTokenErrorToken = useMemo(() => {
    if (errors?.isOutOfTokenError?.tokenAddress) {
      return getByKey(tokensData, errors?.isOutOfTokenError?.tokenAddress);
    }
  }, [errors, tokensData]);

  const relayFeeAmount = expressTxnParamsAsyncResult?.data?.gasPaymentParams.relayerFeeAmount;
  const gasPaymentParams = expressTxnParamsAsyncResult?.data?.gasPaymentParams;

  const { networkFeeUsd, networkFee } = useMemo(() => {
    if (relayFeeAmount === undefined || relayerFeeToken === undefined) {
      return { networkFeeUsd: undefined, networkFee: undefined };
    }

    const relayFeeUsd = convertToUsd(relayFeeAmount, relayerFeeToken.decimals, getMidPrice(relayerFeeToken.prices));

    if (relayFeeUsd === undefined || bridgeNetworkFeeUsd === undefined || bridgeNetworkFee === undefined) {
      return { networkFeeUsd: undefined, networkFee: undefined };
    }

    return {
      networkFeeUsd: relayFeeUsd + bridgeNetworkFeeUsd,
      networkFee:
        // We assume it is all in WNT
        relayFeeAmount + bridgeNetworkFee,
    };
  }, [bridgeNetworkFee, bridgeNetworkFeeUsd, relayFeeAmount, relayerFeeToken]);

  const [showWntWarning, setShowWntWarning] = useState(false);
  const [lastValidNetworkFees, setLastValidNetworkFees] = useState({
    networkFee: networkFee,
    networkFeeUsd: networkFeeUsd,
  });
  useEffect(() => {
    if (networkFee !== undefined && networkFeeUsd !== undefined) {
      setLastValidNetworkFees({
        networkFee,
        networkFeeUsd,
      });
    }
  }, [networkFee, networkFeeUsd]);
  useEffect(() => {
    if (wrappedNativeTokenAddress === zeroAddress) {
      setShowWntWarning(false);
      return;
    }

    if (!wrappedNativeToken || wrappedNativeToken.tradingAccountBalance === undefined) {
      return;
    }

    if (wrappedNativeToken.tradingAccountBalance === 0n) {
      setShowWntWarning(true);
      return;
    }

    const someNetworkFee = networkFee ?? lastValidNetworkFees.networkFee;
    if (someNetworkFee === undefined) {
      return;
    }

    const value = (unwrappedSelectedTokenAddress === zeroAddress ? inputAmount : 0n) ?? 0n;

    setShowWntWarning(wrappedNativeToken.tradingAccountBalance - value < someNetworkFee);
  }, [
    wrappedNativeToken,
    networkFee,
    unwrappedSelectedTokenAddress,
    inputAmount,
    lastValidNetworkFees.networkFee,
    wrappedNativeTokenAddress,
  ]);

  const handlePickToken = useCallback(
    (tokenAddress: string) => {
      setSelectedTokenAddress(tokenAddress);

      if (isSpotProduct) {
        const isNextSpotToken = spotTokenConfig?.contract.toLowerCase() === tokenAddress.toLowerCase();
        const nextChainId = isNextSpotToken ? spotChainId : futuresWithdrawalChainId;
        if (nextChainId) {
          setWithdrawalViewChain(nextChainId as SourceChainId);
        }
        return;
      }

      if (withdrawalViewChain !== undefined) {
        const unwrappedTokenAddress = convertTokenAddress(chainId, tokenAddress, "native");
        const tokenId = getMappedTokenId(chainId as SettlementChainId, unwrappedTokenAddress, withdrawalViewChain);
        if (tokenId === undefined) {
          for (const someSourceChainId of Object.keys(MULTICHAIN_TOKEN_MAPPING[chainId]).map(
            Number
          ) as SourceChainId[]) {
            if (someSourceChainId === withdrawalViewChain) {
              continue;
            }

            const mappedTokenId = getMappedTokenId(
              chainId as SettlementChainId,
              unwrappedTokenAddress,
              someSourceChainId
            );
            if (mappedTokenId) {
              setWithdrawalViewChain(someSourceChainId);
              return;
            }
          }

          setWithdrawalViewChain(undefined);
        }
      }
    },
    [
      chainId,
      futuresWithdrawalChainId,
      isSpotProduct,
      setSelectedTokenAddress,
      setWithdrawalViewChain,
      spotChainId,
      spotTokenConfig,
      withdrawalViewChain,
    ]
  );

  const handleWithdraw = async () => {
    if (withdrawalViewChain === undefined || selectedToken === undefined || account === undefined) {
      return;
    }

    // In API trading mode, use the backend withdrawal flow with the vault contract call.
    if (isTradeMode) {
      if (
        !withdrawContractChainId ||
        !publicClient ||
        !inputValue ||
        inputAmount === undefined ||
        inputAmount <= 0n
      ) {
        helperToast.error(t`Missing required parameters for withdrawal`);
        return;
      }

      // Check JWT authentication before proceeding
      if (!isAuthenticated(account, authChainId)) {
        helperToast.error(t`Please sign in first to withdraw funds`);
        return;
      }

      setIsSubmitting(true);
      try {
        // Step 1: Request withdraw from backend to get signature
        // According to API documentation, token should be "USDT" (string), not contract address
        // Amount should be the raw input value without precision multiplication
        const withdrawTokenSymbol = isSpotVaultWithdrawal ? spotTokenConfig?.symbol : "USDT";
        if (!withdrawTokenSymbol) {
          throw new Error("Withdraw token not configured");
        }

        const configuredVaultAddress = isSpotVaultWithdrawal
          ? spotVaultAddress
          : getTradingVaultAddress(withdrawContractChainId);

        let expectedSpotNonce: bigint | undefined;
        let withdrawResponse: SpotWithdrawAuthorization | undefined;

        if (isSpotVaultWithdrawal) {
          if (!configuredVaultAddress) {
            throw new Error("Vault contract not found");
          }

          expectedSpotNonce = await publicClient.readContract({
            address: configuredVaultAddress as `0x${string}`,
            abi: SpotVaultAbi,
            functionName: "releaseNonces",
            args: [getAddress(account)],
          });

          const withdrawHistory = await getWithdrawHistory(apiChainId, activeWithdrawalProduct);
          const signedWithdrawals = withdrawHistory.withdrawals.filter((withdrawal) => {
            return (
              withdrawal.nonce !== undefined &&
              isReusableSpotWithdrawalStatus(withdrawal.status)
            );
          });

          const currentNonceWithdrawals = signedWithdrawals.filter(
            (withdrawal) => BigInt(withdrawal.nonce!) === expectedSpotNonce
          );
          const matchingWithdrawal = currentNonceWithdrawals.find(
            (withdrawal) =>
              withdrawal.token?.toUpperCase() === withdrawTokenSymbol.toUpperCase() &&
              isSameDecimalAmount(withdrawal.amount, inputValue)
          );

          if (matchingWithdrawal) {
            withdrawResponse = await getWithdrawById(apiChainId, matchingWithdrawal.id, activeWithdrawalProduct);
          } else if (currentNonceWithdrawals.length > 0) {
            const pendingWithdrawal = currentNonceWithdrawals[0];
            throw new Error(
              `Please complete the pending signed withdrawal first: ${pendingWithdrawal.amount} ${pendingWithdrawal.token}`
            );
          } else {
            const laterWithdrawal = signedWithdrawals
              .filter((withdrawal) => BigInt(withdrawal.nonce!) > expectedSpotNonce)
              .sort((first, second) => Number(first.nonce ?? 0) - Number(second.nonce ?? 0))[0];

            if (laterWithdrawal) {
              throw new Error(
                `Withdrawal nonce mismatch. On-chain nonce is ${expectedSpotNonce.toString()}, but the backend already has a signed withdrawal with nonce ${laterWithdrawal.nonce}. Please complete or cancel the earlier signed withdrawal first.`
              );
            }
          }
        }

        if (!withdrawResponse) {
          withdrawResponse = await requestWithdraw(
            apiChainId,
            {
              token: withdrawTokenSymbol,
              amount: inputValue, // Use raw input value without precision multiplication
            },
            activeWithdrawalProduct
          );
        }

        if (
          isSpotVaultWithdrawal &&
          expectedSpotNonce !== undefined &&
          withdrawResponse.nonce !== undefined &&
          BigInt(withdrawResponse.nonce) !== expectedSpotNonce
        ) {
          throw new Error("Withdrawal nonce mismatch. Please complete the earlier signed withdrawal first.");
        }

        // API returns "backend_signature", fallback to "signature" for backward compatibility
        const signature = withdrawResponse.backend_signature || withdrawResponse.signature;
        if (!signature) {
          throw new Error("Backend did not return signature");
        }

        // Use vault_address from response if available, otherwise fallback to config
        const vaultAddress = withdrawResponse.vault_address || configuredVaultAddress;
        if (!vaultAddress) {
          throw new Error("Vault contract not found");
        }

        const amountInWei =
          isSpotVaultWithdrawal && spotTokenConfig
            ? withdrawResponse.amount_in_wei
              ? BigInt(withdrawResponse.amount_in_wei)
              : parseUnits(withdrawResponse.amount, spotTokenConfig.decimals)
            : BigInt(withdrawResponse.amount);

        // Use expiry from response as deadline parameter
        // Response format: "expiry":1766732708 (Unix timestamp)
        const deadline = withdrawResponse.expiry || withdrawResponse.deadline || 0;

        // Validate parameters before calling contract
        if (amountInWei === 0n) {
          throw new Error("Invalid amount: amount must be greater than 0");
        }
        if (!deadline || deadline === 0) {
          throw new Error("Invalid deadline: deadline must be set");
        }
        if (!signature || signature.length === 0) {
          throw new Error("Invalid signature: signature must be provided");
        }

        // Log parameters for debugging

        const spotWithdrawTokenAddress = withdrawResponse.token_address || spotTokenConfig?.contract || zeroAddress;
        const spotWithdrawArgs = [
          getAddress(spotWithdrawTokenAddress),
          amountInWei,
          BigInt(deadline),
          signature as `0x${string}`,
        ] as const;
        const futuresWithdrawArgs = [amountInWei, BigInt(deadline), signature as `0x${string}`] as const;

        // Step 2: Simulate contract call before executing to check if it will succeed
        try {
          if (isSpotVaultWithdrawal) {
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
          console.error("[WithdrawalView] Contract simulation failed:", simulateError);

          // Extract error information
          const errorMessage = simulateError?.message || "";
          const shortMessage = simulateError?.shortMessage || "";
          const errorData = simulateError?.data;
          const errorCause = simulateError?.cause;

          // Try to extract error signature if available
          let errorSignature = "";
          if (errorCause?.data) {
            errorSignature =
              typeof errorCause.data === "string"
                ? errorCause.data.substring(0, 10)
                : errorCause.data.toString().substring(0, 10);
          } else if (shortMessage.includes("0x")) {
            const match = shortMessage.match(/0x[a-fA-F0-9]{8}/);
            if (match) {
              errorSignature = match[0];
            }
          }

          console.error("[WithdrawalView] Simulation error details:", {
            message: errorMessage,
            shortMessage: shortMessage,
            errorSignature: errorSignature,
            errorData: errorData,
            cause: errorCause,
            name: simulateError?.name,
            stack: simulateError?.stack,
          });

          // Provide user-friendly error message
          let userMessage = "Transaction simulation failed";
          if (errorSignature) {
            userMessage += ` (Error: ${errorSignature})`;
            console.error(
              `[WithdrawalView] Error signature ${errorSignature} - Check contract for specific error definition`
            );
            console.error(
              `[WithdrawalView] Look up error at: https://openchain.xyz/signatures?query=${errorSignature}`
            );
          }
          if (shortMessage) {
            userMessage += `: ${shortMessage}`;
          }

          throw new Error(userMessage);
        }

        // Step 3: Call Vault contract using walletClient (only if simulation succeeds)
        // Contract signature: releaseFunds(uint256 amount, uint256 deadline, bytes calldata signature)
        // Parameters from response: amount, expiry (as deadline), backend_signature
        let activeWalletClient = walletClient;

        if (walletChainId !== withdrawContractChainId) {
          await switchNetwork(withdrawContractChainId, true);
          activeWalletClient = await getWalletClient(getRainbowKitConfig(), {
            chainId: withdrawContractChainId as any,
            account: getAddress(account),
          });
        } else if (!activeWalletClient) {
          activeWalletClient = await getWalletClient(getRainbowKitConfig(), {
            chainId: withdrawContractChainId as any,
            account: getAddress(account),
          });
        }

        if (!activeWalletClient) {
          throw new Error("Wallet not connected");
        }

        const txHash = isSpotVaultWithdrawal
          ? await activeWalletClient.writeContract({
              address: vaultAddress as `0x${string}`,
              abi: SpotVaultAbi,
              functionName: "withdraw",
              args: spotWithdrawArgs,
              account: getAddress(account),
              chain: publicClient.chain,
            })
          : await activeWalletClient.writeContract({
              address: vaultAddress as `0x${string}`,
              abi: VaultAbi,
              functionName: "releaseFunds",
              args: futuresWithdrawArgs,
              account: getAddress(account),
              chain: publicClient.chain,
            });

        helperToast.success(t`Withdraw transaction submitted`);

        // Wait for transaction confirmation
        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

        helperToast.success(t`Withdraw completed successfully`);

        // Step 3: Confirm withdrawal (optional but recommended to speed up status updates)
        const withdrawId = withdrawResponse.withdraw_id || withdrawResponse.id;
        if (withdrawId) {
          try {
            await confirmWithdraw(apiChainId, withdrawId, {
              tx_hash: receipt.transactionHash,
            }, activeWithdrawalProduct);
          } catch (confirmError) {
            // Non-critical error, just log it
            console.warn("[WithdrawalView] Failed to confirm withdraw:", confirmError);
          }
        }

        // Refresh balances after successful withdraw
        if (mutateBalances) {
          mutateBalances();
        }

        // Close modal
        setIsVisibleOrView("main");
      } catch (error: any) {
        console.error("[WithdrawalView] Failed to request withdraw:", error);
        helperToast.error(error?.message || t`Failed to request withdraw`);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // Legacy multichain withdrawal logic for non-API mode.
    const metricData = initMultichainWithdrawalMetricData({
      settlementChain: chainId,
      sourceChain: withdrawalViewChain,
      assetSymbol: unwrappedSelectedTokenSymbol ?? selectedToken.symbol,
      sizeInUsd: inputAmountUsd!,
      isFirstWithdrawal,
    });

    sendOrderSubmittedMetric(metricData.metricId);

    if (
      gasPaymentParams === undefined ||
      bridgeOutParams === undefined ||
      expressTxnParamsAsyncResult.promise === undefined ||
      provider === undefined
    ) {
      helperToast.error(t`Missing required parameters`);
      sendTxnValidationErrorMetric(metricData.metricId);
      return;
    }

    const expressTxnParams = await expressTxnParamsAsyncResult.promise;

    if (expressTxnParams === undefined) {
      helperToast.error("Missing required parameters");
      sendTxnValidationErrorMetric(metricData.metricId);
      return;
    }

    setIsSubmitting(true);
    try {
      const relayParamsPayload = expressTxnParams.relayParamsPayload;

      await wrapChainAction(withdrawalViewChain, setSettlementChainId, async (signer) => {
        await simulateWithdraw({
          chainId: chainId as SettlementChainId,
          relayerFeeTokenAddress: gasPaymentParams.relayerFeeTokenAddress,
          relayerFeeAmount: gasPaymentParams.relayerFeeAmount,
          relayParamsPayload: relayParamsPayload as RawRelayParamsPayload,
          params: bridgeOutParams,
          signer,
          provider,
          srcChainId: withdrawalViewChain,
        });

        sendOrderSimulatedMetric(metricData.metricId);

        const signedTxnData: ExpressTxnData = await buildAndSignBridgeOutTxn({
          chainId: chainId as SettlementChainId,
          signer,
          account,
          relayParamsPayload: relayParamsPayload as RawRelayParamsPayload,
          params: bridgeOutParams,
          relayerFeeAmount: gasPaymentParams.relayerFeeAmount,
          relayerFeeTokenAddress: gasPaymentParams.relayerFeeTokenAddress,
          srcChainId: withdrawalViewChain,
        });

        const mockWithdrawalId = setMultichainSubmittedWithdrawal({
          amount: bridgeOutParams.amount,
          settlementChainId: chainId,
          sourceChainId: withdrawalViewChain,
          tokenAddress: unwrappedSelectedTokenAddress ?? selectedToken.address,
        });

        const receipt = await sendExpressTransaction({
          chainId,
          txnData: signedTxnData,
          isSponsoredCall: expressTxnParams.isSponsoredCall,
        });

        sendOrderTxnSubmittedMetric(metricData.metricId);

        const txResult = await receipt.wait();

        if (txResult.status === "success") {
          sendTxnSentMetric(metricData.metricId);
          if (txResult.transactionHash && mockWithdrawalId) {
            setMultichainWithdrawalSentTxnHash(mockWithdrawalId, txResult.transactionHash);
          }
          setIsVisibleOrView("main");
        } else if (txResult.status === "failed" && mockWithdrawalId) {
          setMultichainWithdrawalSentError(mockWithdrawalId);
        }
      });
    } catch (error) {
      const prettyError = toastCustomOrStargateError(chainId, error);
      sendTxnErrorMetric(metricData.metricId, prettyError, "unknown");
    } finally {
      setIsSubmitting(false);
    }
  };

  const gasPaymentToken = useSelector(selectGasPaymentToken);

  const handleMaxButtonClick = useCallback(async () => {
    if (
      selectedToken === undefined ||
      selectedToken.tradingAccountBalance === undefined ||
      selectedToken.tradingAccountBalance === 0n ||
      withdrawalViewChain === undefined ||
      account === undefined
    ) {
      return;
    }

    const canSelectedTokenBeUsedAsGasPaymentToken =
      !isTradeMode && getGasPaymentTokens(chainId).includes(selectedToken.address);

    let amount = selectedToken.tradingAccountBalance;

    if (!canSelectedTokenBeUsedAsGasPaymentToken || gasPaymentToken?.address !== selectedToken.address) {
      amount = selectedToken.tradingAccountBalance;
    } else {
      const buffer = convertToTokenAmount(
        gasTokenBuffer,
        gasPaymentToken.decimals,
        getMidPrice(gasPaymentToken.prices)
      )!;

      if (selectedToken.tradingAccountBalance > buffer) {
        const maxAmount = bigMath.max(selectedToken.tradingAccountBalance - buffer, 0n);
        amount = maxAmount;
      }
    }

    const nativeFee = bridgeNetworkFee ?? baseQuoteSend?.nativeFee;

    if (unwrappedSelectedTokenAddress === zeroAddress && nativeFee !== undefined) {
      amount = amount - (nativeFee * 11n) / 10n;
    }

    amount = bigMath.max(amount, 0n);

    setInputValue(formatAmountFree(amount, selectedToken.decimals));
  }, [
    account,
    baseQuoteSend?.nativeFee,
    bridgeNetworkFee,
    chainId,
    gasPaymentToken?.address,
    gasPaymentToken?.decimals,
    gasPaymentToken?.prices,
    gasTokenBuffer,
    isTradeMode,
    selectedToken,
    setInputValue,
    unwrappedSelectedTokenAddress,
    withdrawalViewChain,
  ]);

  const shouldShowMinRecommendedAmount = useMemo(() => {
    if (
      selectedToken === undefined ||
      selectedToken.tradingAccountBalance === undefined ||
      selectedToken.tradingAccountBalance === 0n ||
      withdrawalViewChain === undefined ||
      account === undefined ||
      inputAmount === undefined ||
      inputAmount <= 0n
    ) {
      return false;
    }

    const canSelectedTokenBeUsedAsGasPaymentToken =
      !isTradeMode && getGasPaymentTokens(chainId).includes(selectedToken.address);

    if (!canSelectedTokenBeUsedAsGasPaymentToken) {
      return false;
    }

    if (gasPaymentToken?.address !== selectedToken.address) {
      return false;
    }

    const buffer = convertToTokenAmount(
      gasTokenBufferWarningThreshold,
      gasPaymentToken.decimals,
      getMidPrice(gasPaymentToken.prices)
    )!;

    const maxAmount = bigMath.max(selectedToken.tradingAccountBalance - inputAmount - buffer, 0n);

    return maxAmount === 0n;
  }, [
    account,
    chainId,
    gasPaymentToken?.address,
    gasPaymentToken?.decimals,
    gasPaymentToken?.prices,
    gasTokenBufferWarningThreshold,
    inputAmount,
    isTradeMode,
    selectedToken,
    withdrawalViewChain,
  ]);

  const isInputEmpty = inputAmount === undefined || inputAmount <= 0n;
  const isInsufficientBalance =
    selectedToken?.tradingAccountBalance !== undefined &&
    inputAmount !== undefined &&
    inputAmount > selectedToken.tradingAccountBalance;

  let buttonState: {
    text: React.ReactNode;
    disabled?: boolean;
    onClick?: () => void;
  } = {
    text: t`Withdraw`,
    onClick: handleWithdraw,
  };

  if (isSubmitting) {
    buttonState = {
      text: (
        <>
          <Trans>Withdrawing...</Trans>
          <SpinnerIcon className="ml-4 animate-spin" />
        </>
      ),
      disabled: true,
    };
  } else if (withdrawalViewChain === undefined) {
    buttonState = {
      text: t`Select network`,
      disabled: true,
    };
  } else if (isInputEmpty) {
    buttonState = {
      text: t`Enter withdrawal amount`,
      disabled: true,
    };
  } else if (selectedToken?.tradingAccountBalance !== undefined && inputAmount > selectedToken.tradingAccountBalance) {
    buttonState = {
      text: t`Insufficient balance`,
      disabled: true,
    };
  } else if (isTradeMode) {
    // In API trading mode, skip express transaction validation checks.
    // Only check basic input validation
    if (!publicClient) {
      buttonState = {
        text: t`Connecting wallet...`,
        disabled: true,
      };
    } else {
      buttonState = {
        text: t`Withdraw`,
        onClick: handleWithdraw,
      };
    }
  } else if (
    (expressTxnParamsAsyncResult.data?.gasPaymentValidations.isOutGasTokenBalance ||
      errors?.isOutOfTokenError?.isGasPaymentToken) &&
    !expressTxnParamsAsyncResult.isLoading
  ) {
    buttonState = {
      text: t`Insufficient ${gasPaymentParams?.relayFeeToken.symbol} balance to pay for gas`,
      disabled: true,
    };
  } else if (errors?.isOutOfTokenError && !expressTxnParamsAsyncResult.isLoading) {
    buttonState = {
      text: t`Insufficient ${isOutOfTokenErrorToken?.symbol} balance`,
      disabled: true,
    };
  } else if (showWntWarning) {
    buttonState = {
      text: t`Insufficient ${wrappedNativeToken?.symbol} balance`,
      disabled: true,
    };
  } else if (expressTxnParamsAsyncResult.error && !expressTxnParamsAsyncResult.isLoading) {
    buttonState = {
      text: expressTxnParamsAsyncResult.error.name.slice(0, 32) ?? t`Error simulating withdrawal`,
      disabled: true,
    };
  } else if (!expressTxnParamsAsyncResult.data) {
    buttonState = {
      text: (
        <>
          <Trans>Loading</Trans>
          <SpinnerIcon className="ml-4 animate-spin" />
        </>
      ),
      disabled: true,
    };
  }

  const hasSelectedToken = selectedTokenAddress !== undefined;
  useEffect(
    function fallbackWithdrawTokens() {
      if (hasSelectedToken || !withdrawalViewChain || !isSettlementChain(chainId) || isVisibleOrView === false) {
        return;
      }

      const settlementChainWrappedTokenAddresses = MULTICHAIN_TRANSFER_SUPPORTED_TOKENS[chainId];
      if (!settlementChainWrappedTokenAddresses) {
        return;
      }

      const preferredToken = settlementChainWrappedTokenAddresses.find((tokenAddress) => {
        const tokenData = tokensData?.[tokenAddress];
        return (
          tokenData?.address === CHAIN_ID_PREFERRED_DEPOSIT_TOKEN[chainId] &&
          tokenData?.tradingAccountBalance !== undefined &&
          tokenData.tradingAccountBalance > 0n
        );
      });

      if (preferredToken) {
        setSelectedTokenAddress(preferredToken);
        return;
      }

      let maxTradingAccountBalanceUsd = 0n;
      let maxBalanceSettlementChainTokenAddress: string | undefined = undefined;

      for (const tokenAddress of settlementChainWrappedTokenAddresses) {
        const tokenData = tokensData?.[tokenAddress];
        if (tokenData === undefined) {
          continue;
        }

        const prices = tokenData.prices;
        const balance = tokenData.tradingAccountBalance;
        if (prices === undefined || balance === undefined) {
          continue;
        }

        const price = getMidPrice(prices);
        const balanceUsd = convertToUsd(balance, tokenData.decimals, price)!;
        if (balanceUsd > maxTradingAccountBalanceUsd) {
          maxTradingAccountBalanceUsd = balanceUsd;
          maxBalanceSettlementChainTokenAddress = tokenAddress;
        }
      }

      if (maxBalanceSettlementChainTokenAddress) {
        setSelectedTokenAddress(maxBalanceSettlementChainTokenAddress);
      }
    },
    [chainId, hasSelectedToken, isVisibleOrView, setSelectedTokenAddress, tokensData, withdrawalViewChain]
  );

  const isTestnet = isTestnetChain(chainId);

  return (
    <div className="flex grow flex-col overflow-y-auto p-adaptive">
      <div className="flex flex-col gap-[--padding-adaptive]">
        <div className="flex flex-col gap-6">
          <div className="text-body-medium text-typography-secondary">
            <Trans>Asset</Trans>
          </div>
          <DropdownSelector
            value={selectedTokenAddress}
            onChange={handlePickToken}
            placeholder={t`Select token`}
            button={
              selectedTokenAddress && selectedToken ? (
                <div className="flex items-center gap-8">
                  <TokenIcon symbol={selectedToken.symbol} displaySize={20} />
                  <span>{selectedToken.symbol}</span>
                </div>
              ) : undefined
            }
            options={options}
            item={WithdrawAssetItem}
            itemKey={withdrawAssetItemKey}
          />
        </div>

        <div className="flex flex-col gap-6">
          <div className="text-body-medium text-typography-secondary">
            <Trans>To Network</Trans>
          </div>
          <DropdownSelector
            value={withdrawalViewChain}
            onChange={(value) => {
              setWithdrawalViewChain(Number(value) as SourceChainId);
            }}
            placeholder={t`Select network`}
            button={
              <div className="flex items-center gap-8">
                {withdrawalViewChain !== undefined ? (
                  <>
                    <img
                      src={CHAIN_ID_TO_NETWORK_ICON[withdrawalViewChain]}
                      alt={getFundingChainName(withdrawalViewChain)}
                      className="size-20"
                    />
                    <span className="text-16 leading-base">{getFundingChainName(withdrawalViewChain)}</span>
                  </>
                ) : (
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
                )}
              </div>
            }
            options={filteredNetworks}
            item={NetworkItem}
            itemKey={networkItemKey}
          />
        </div>

        <div className="flex flex-col gap-6">
          <div className="text-body-medium flex items-center justify-between text-typography-secondary">
            <Trans>Withdraw</Trans>
            {selectedToken !== undefined &&
              selectedToken.tradingAccountBalance !== undefined &&
              selectedToken !== undefined && (
                <div>
                  <Trans>Available:</Trans>{" "}
                  <Amount
                    className="text-typography-primary"
                    amount={selectedToken.tradingAccountBalance}
                    decimals={selectedToken.decimals}
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
              className="w-full rounded-8 border border-slate-800 bg-slate-800 py-13 pl-14 pr-96 text-16 leading-base
                         focus-within:border-blue-300 hover:bg-fill-surfaceElevatedHover"
              placeholder="0.00"
            />
            <div className="pointer-events-none absolute right-14 top-1/2 flex -translate-y-1/2 items-center gap-8">
              <span className="text-typography-secondary">{selectedToken?.symbol}</span>
              <button
                className="text-body-small pointer-events-auto rounded-full bg-slate-600 px-8 py-2 font-medium disabled:opacity-50
                         hover:not-disabled:bg-slate-500 focus-visible:not-disabled:bg-slate-500 active:not-disabled:bg-slate-500/70"
                disabled={isMaxButtonDisabled}
                onClick={handleMaxButtonClick}
              >
                <Trans>Max</Trans>
              </button>
            </div>
          </div>
          <div className="text-body-medium text-typography-secondary numbers">{formatUsd(inputAmountUsd ?? 0n)}</div>
        </div>
      </div>

      {!isInsufficientBalance && (
        <>
          {isAboveLimit && (
            <AlertInfoCard type="warning" className="my-4">
              <div>
                <Trans>
                  The amount you are trying to withdraw exceeds the limit. Please try an amount smaller than{" "}
                  <span className="numbers">{upperLimitFormatted}</span>.
                </Trans>
              </div>
            </AlertInfoCard>
          )}
          {isBelowLimit && (
            <AlertInfoCard type="warning" className="my-4">
              <div>
                <Trans>
                  The amount you are trying to withdraw is below the limit. Please try an amount larger than{" "}
                  <span className="numbers">{lowerLimitFormatted}</span>.
                </Trans>
              </div>
            </AlertInfoCard>
          )}

          {shouldShowMinRecommendedAmount && (
            <AlertInfoCard type="info" className="my-4">
              <div>
                <Trans>
                  You're withdrawing {selectedToken?.symbol}, your gas token. Gas is required for this withdrawal, so
                  please keep at least{" "}
                  <span className="numbers">{formatUsd(gasTokenBuffer, { displayDecimals: 0 })}</span> in{" "}
                  {selectedToken?.symbol} or switch your gas token in{" "}
                  <span
                    className="text-body-small cursor-pointer text-13 font-medium text-typography-secondary underline underline-offset-2"
                    onClick={() => {
                      setIsSettingsVisible(true);
                      setTimeout(() => {
                        setIsVisibleOrView(false);
                      }, 200);
                    }}
                  >
                    settings
                  </span>
                  .
                </Trans>
              </div>
            </AlertInfoCard>
          )}

          {errors?.isOutOfTokenError &&
            !errors.isOutOfTokenError.isGasPaymentToken &&
            isOutOfTokenErrorToken !== undefined && (
              <AlertInfoCard type="error" className="my-4">
                <div>
                  <Trans>
                    Withdrawing requires{" "}
                    <Amount
                      amount={errors.isOutOfTokenError.requiredAmount ?? 0n}
                      decimals={isOutOfTokenErrorToken.decimals}
                      isStable={isOutOfTokenErrorToken.isStable}
                      symbol={isOutOfTokenErrorToken.symbol}
                    />{" "}
                    while you have{" "}
                    <Amount
                      amount={isOutOfTokenErrorToken.tradingAccountBalance ?? 0n}
                      decimals={isOutOfTokenErrorToken.decimals}
                      isStable={isOutOfTokenErrorToken.isStable}
                      symbol={isOutOfTokenErrorToken.symbol}
                    />
                    . Please{" "}
                    <span
                      className="text-body-small cursor-pointer text-13 font-medium text-typography-secondary underline underline-offset-2"
                      onClick={() => {
                        setIsVisibleOrView(false);
                        // Trade route disabled
                        history.push(`/trade`);
                      }}
                    >
                      swap
                    </span>{" "}
                    or{" "}
                    <span
                      className="text-body-small cursor-pointer text-13 font-medium text-typography-secondary underline underline-offset-2"
                      onClick={() => {
                        setDepositViewTokenAddress(
                          convertTokenAddress(chainId, isOutOfTokenErrorToken.address, "native")
                        );
                        if (errors?.isOutOfTokenError?.requiredAmount !== undefined) {
                          setDepositViewTokenInputValue(
                            formatAmountFree(errors.isOutOfTokenError.requiredAmount, isOutOfTokenErrorToken.decimals)
                          );
                        }
                        setIsVisibleOrView("deposit");
                      }}
                    >
                      deposit
                    </span>{" "}
                    more {isOutOfTokenErrorToken?.symbol} to your trading account.
                  </Trans>
                </div>
              </AlertInfoCard>
            )}

          {showWntWarning && !(errors?.isOutOfTokenError?.tokenAddress === wrappedNativeTokenAddress) && (
            <InsufficientWntBanner
              neededAmount={networkFee ?? lastValidNetworkFees.networkFee}
              neededAmountUsd={networkFeeUsd ?? lastValidNetworkFees.networkFeeUsd}
            />
          )}
        </>
      )}

      <div className="h-32 shrink-0 grow" />

      {selectedTokenAddress && (
        <div className="mb-16 flex flex-col gap-10">
          <SyntheticsInfoRow
            label={<Trans>Estimated Time</Trans>}
            valueClassName="numbers"
            value={
              inputAmount === undefined || inputAmount === 0n ? (
                "..."
              ) : isTestnet ? (
                <Trans>1m 40s</Trans>
              ) : (
                <Trans>20s</Trans>
              )
            }
          />
          <SyntheticsInfoRow
            label={<Trans>Network Fee</Trans>}
            value={
              networkFeeUsd !== undefined && relayerFeeToken ? (
                <AmountWithUsdBalance
                  className="leading-1"
                  amount={networkFee}
                  decimals={relayerFeeToken.decimals}
                  usd={networkFeeUsd}
                  symbol={relayerFeeToken.symbol}
                />
              ) : (
                "..."
              )
            }
          />
          <SyntheticsInfoRow
            label={<Trans>Withdraw Fee</Trans>}
            value={
              protocolFeeUsd !== undefined && selectedTokenSettlementChainTokenId ? (
                <AmountWithUsdBalance
                  className="leading-1"
                  amount={protocolFeeAmount}
                  decimals={selectedTokenSettlementChainTokenId.decimals}
                  usd={protocolFeeUsd}
                  symbol={selectedToken?.symbol}
                />
              ) : (
                "..."
              )
            }
          />
          {!isTradeMode && (
            <SyntheticsInfoRow
              label={<Trans>Trading Account Balance</Trans>}
              value={
                <ValueTransition from={formatUsd(tradingAccountUsd)} to={formatUsd(nextTradingAccountBalanceUsd)} />
              }
            />
          )}
        </div>
      )}

      <Button
        variant="primary-action"
        className="w-full shrink-0"
        onClick={buttonState.onClick}
        disabled={buttonState.disabled}
      >
        {buttonState.text}
      </Button>
    </div>
  );
};

function networkItemKey(option: { id: number; name: string }) {
  return option.id;
}

function NetworkItem({ option }: { option: { id: number; name: string } }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-8">
        <img src={CHAIN_ID_TO_NETWORK_ICON[option.id]} alt={option.name} className="size-20" />
        <span className="text-body-large">{option.name}</span>
      </div>
    </div>
  );
}

function WithdrawAssetItem({ option }: { option: TokenData }) {
  const isZero = option.tradingAccountBalance === 0n || option.tradingAccountBalance === undefined;
  return (
    <div className="flex items-center justify-between gap-8">
      <div className="flex gap-8">
        <TokenIcon symbol={option.symbol} displaySize={20} />
        <span>
          {option.symbol} <span className="text-body-small text-typography-secondary">{option.name}</span>
        </span>
      </div>
      <div className={cx(isZero ? "text-typography-secondary" : "text-typography-primary")}>
        <Amount
          className="text-typography-primary"
          amount={option.tradingAccountBalance}
          decimals={option.decimals}
          isStable={option.isStable}
          showZero
          emptyValue="-"
        />
      </div>
    </div>
  );
}

function withdrawAssetItemKey(option: TokenData) {
  return option.address;
}

async function simulateWithdraw({
  provider,
  signer,
  chainId,
  srcChainId,
  relayParamsPayload,
  relayerFeeTokenAddress,
  relayerFeeAmount,
  params,
}: {
  provider: Provider;
  signer: WalletSigner;
  chainId: SettlementChainId;
  srcChainId: SourceChainId;
  relayerFeeTokenAddress: string;
  relayerFeeAmount: bigint;
  relayParamsPayload: RawRelayParamsPayload;
  params: BridgeOutParams;
}): Promise<void> {
  if (!provider) {
    throw new Error("Provider is required");
  }

  const { callData, feeAmount, feeToken, to } = await buildAndSignBridgeOutTxn({
    signer,
    account: signer.address,
    chainId,
    srcChainId,
    relayParamsPayload,
    params,
    emptySignature: true,
    relayerFeeTokenAddress,
    relayerFeeAmount: relayerFeeAmount,
  });

  await fallbackCustomError(async () => {
    await callRelayTransaction({
      chainId: chainId as ContractsChainId,
      calldata: callData,
      provider,
      gelatoRelayFeeAmount: feeAmount,
      gelatoRelayFeeToken: feeToken,
      relayRouterAddress: to as Address,
    });
  }, "simulation");
}
