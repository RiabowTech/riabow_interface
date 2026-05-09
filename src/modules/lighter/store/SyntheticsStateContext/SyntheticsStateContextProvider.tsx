import { ethers } from "ethers";
import { ReactNode, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";

import type { ContractsChainId, SourceChainId } from "config/chains";
import { getKeepLeverageKey } from "config/localStorage";
import { SettingsContextType, useSettings } from "@/modules/lighter/context/SettingsContext/SettingsContextProvider";
import {
  SubaccountState,
  useSubaccountContext,
} from "@/modules/lighter/context/SubaccountContext/SubaccountContextProvider";
import {
  TokenPermitsState,
  useTokenPermitsContext,
} from "@/modules/lighter/context/TokenPermitsContext/TokenPermitsContextProvider";
import { UserReferralInfo, useUserReferralInfoRequest } from "domain/referrals";
import {
  AccountStats,
  PeriodAccountStats,
  useAccountStats,
  usePeriodAccountStats,
} from "domain/synthetics/accountStats";
import { OracleSettingsData, useOracleSettingsData } from "domain/synthetics/common/useOracleSettingsData";
import { SponsoredCallBalanceData, useIsSponsoredCallBalanceAvailable } from "domain/synthetics/express";
import { useL1ExpressOrderGasReference } from "domain/synthetics/express/useL1ExpressGasReference";
import { ExternalSwapState } from "domain/synthetics/externalSwaps/types";
import { useBotanixStakingAssetsPerShare } from "domain/synthetics/externalSwaps/useBotanixStakingAssetsPerShare";
import { useInitExternalSwapState } from "domain/synthetics/externalSwaps/useInitExternalSwapState";
import { FeaturesSettings, useEnabledFeaturesRequest } from "domain/synthetics/features/useDisabledFeatures";
import { L1ExpressOrderGasReference, useGasLimits, useGasPrice } from "domain/synthetics/fees";
import { RebateInfoItem, useRebatesInfoRequest } from "domain/synthetics/fees/useRebatesInfo";
import useUiFeeFactorRequest from "domain/synthetics/fees/utils/useUiFeeFactor";
import {
  MarketsInfoResult,
  MarketsResult,
  useMarkets,
  useMarketsInfoRequest,
  useMarketTokensDataRequest,
} from "domain/synthetics/markets";
import { isGlvEnabled } from "domain/synthetics/markets/glv";
import { useGlvMarketsInfo } from "domain/synthetics/markets/useGlvMarkets";
import { OrderEditorState, useOrderEditorState } from "domain/synthetics/orders/useOrderEditorState";
import { AggregatedOrdersDataResult, useOrdersInfoRequest } from "domain/synthetics/orders/useOrdersInfo";
import {
  PositionsConstantsResult,
  PositionsInfoResult,
  usePositions,
  usePositionsConstantsRequest,
  usePositionsInfoRequest,
} from "domain/synthetics/positions";
import {
  TokenAllowanceResult,
  TokensData,
  TokensDataResult,
  useTokensAllowanceData,
  useTokensDataRequest,
} from "domain/synthetics/tokens";
import { ConfirmationBoxState, useConfirmationBoxState } from "domain/synthetics/trade/useConfirmationBoxState";
import { PositionEditorState, usePositionEditorState } from "domain/synthetics/trade/usePositionEditorState";
import { PositionSellerState, usePositionSellerState } from "domain/synthetics/trade/usePositionSellerState";
import { TradeboxState, useTradeboxState } from "domain/synthetics/trade/useTradeboxState";
import useIsFirstOrder from "domain/synthetics/tradeHistory/useIsFirstOrder";
import { MissedCoinsPlace } from "domain/synthetics/userFeedback";
import { ProgressiveTokensData } from "domain/tokens";
import { useChainId } from "lib/chains";
import { getTimePeriodsInSeconds } from "lib/dates";
import { useLocalStorageSerializeKey } from "lib/localStorage";
import { BlockTimestampData, useBlockTimestampRequest } from "lib/useBlockTimestampRequest";
import { WalletSigner } from "lib/wallets";
import useWallet from "lib/wallets/useWallet";
import { getContract } from "sdk/configs/contracts";
import { convertTokenAddress } from "sdk/configs/tokens";

import { useCollectSyntheticsMetrics } from "./useCollectSyntheticsMetrics";
import { LeaderboardState, useLeaderboardState } from "./useLeaderboardState";
import { latestStateRef, StateCtx } from "./utils";

// Zanbara API Layer - Feature Flag controlled data sources
import { shouldUseApiPositions, useApiPositions, shouldUseApiOrders, useApiOrders } from "@/modules/lighter/api";
import { useTradingMarketsWithTickers } from "@/modules/lighter/api/custom/useTradingMarkets";
import { MarketInfo, MarketsInfoData } from "domain/synthetics/markets";
import { TokenData } from "domain/synthetics/tokens";
import { USD_DECIMALS } from "config/factors";
import { getTokenBySymbol } from "sdk/configs/tokens";
import { expandDecimals } from "lib/numbers";

export type SyntheticsPageType =
  | "accounts"
  | "trade"
  | "pools"
  | "leaderboard"
  | "competitions"
  | "stats"
  | "earn"
  | "buy"
  | "home"
  | "tradingAccount"
  | "referrals";

export type SyntheticsState = {
  pageType: SyntheticsPageType;
  globals: {
    chainId: ContractsChainId;
    srcChainId: SourceChainId | undefined;
    markets: MarketsResult;
    marketsInfo: MarketsInfoResult;
    positionsInfo: PositionsInfoResult;
    tokensDataResult: TokensDataResult;
    account: string | undefined;
    signer: WalletSigner | undefined;
    ordersInfo: AggregatedOrdersDataResult;
    positionsConstants: PositionsConstantsResult["positionsConstants"];
    uiFeeFactor: bigint;
    userReferralInfo: UserReferralInfo | undefined;
    depositMarketTokensData: TokensData | undefined;
    progressiveDepositMarketTokensData: ProgressiveTokensData | undefined;

    glvInfo: ReturnType<typeof useGlvMarketsInfo>;
    botanixStakingAssetsPerShare: bigint | undefined;

    closingPositionKey: string | undefined;
    setClosingPositionKey: (key: string | undefined) => void;

    keepLeverage: boolean | undefined;
    setKeepLeverage: (value: boolean) => void;

    missedCoinsModalPlace: MissedCoinsPlace | undefined;
    setMissedCoinsModalPlace: (place: MissedCoinsPlace | undefined) => void;

    gasLimits: ReturnType<typeof useGasLimits>;
    gasPrice: ReturnType<typeof useGasPrice>;

    lastWeekAccountStats?: PeriodAccountStats;
    lastMonthAccountStats?: PeriodAccountStats;
    accountStats?: AccountStats;
    isCandlesLoaded: boolean;
    setIsCandlesLoaded: (isLoaded: boolean) => void;
    isFirstOrder: boolean;
    blockTimestampData: BlockTimestampData | undefined;

    oracleSettings: OracleSettingsData | undefined;
  };
  claims: {
    accruedPositionPriceImpactFees: RebateInfoItem[];
    claimablePositionPriceImpactFees: RebateInfoItem[];
  };
  leaderboard: LeaderboardState;
  settings: SettingsContextType;
  subaccountState: SubaccountState;
  tradebox: TradeboxState;
  externalSwap: ExternalSwapState;
  tokenPermitsState: TokenPermitsState;
  orderEditor: OrderEditorState;
  positionSeller: PositionSellerState;
  positionEditor: PositionEditorState;
  confirmationBox: ConfirmationBoxState;
  features: FeaturesSettings | undefined;
  gasPaymentTokenAllowance: TokenAllowanceResult | undefined;
  sponsoredCallBalanceData: SponsoredCallBalanceData | undefined;
  l1ExpressOrderGasReference: L1ExpressOrderGasReference | undefined;
};

export function SyntheticsStateContextProvider({
  children,
  skipLocalReferralCode,
  pageType,
  overrideChainId,
}: {
  children: ReactNode;
  skipLocalReferralCode: boolean;
  pageType: SyntheticsPageType;
  overrideChainId?: ContractsChainId;
}) {
  const { chainId: selectedChainId, srcChainId } = useChainId();

  const { account: walletAccount, signer } = useWallet();

  const { account: paramsAccount } = useParams<{ account?: string }>();

  let checkSummedAccount: string | undefined;

  if (paramsAccount && ethers.isAddress(paramsAccount)) {
    checkSummedAccount = ethers.getAddress(paramsAccount);
  }

  const isLeaderboardPage = pageType === "competitions" || pageType === "leaderboard";
  const isTradePage = pageType === "trade";
  const isAccountPage = pageType === "accounts";

  const account = isAccountPage ? checkSummedAccount : walletAccount;
  const leaderboard = useLeaderboardState(account, isLeaderboardPage);
  const chainId = isLeaderboardPage ? leaderboard.chainId : overrideChainId ?? selectedChainId;

  const markets = useMarkets(chainId);
  const tokensDataResult = useTokensDataRequest(chainId, srcChainId);

  // Enable the API trading mode flag on the trading page type.
  useEffect(() => {
    if (pageType === "trade") {
      if (typeof window !== "undefined") {
        localStorage.setItem("trade_mode", "true");
      }
    }
    return () => {
      // Clean up on unmount or page type change (optional, keep flag persistent)
      // localStorage.removeItem("trade_mode");
    };
  }, [pageType]);

  // Feature flag: switch between backend API data and multicall data.
  const useApiDataSource = shouldUseApiPositions();

  // Original multicall data source.
  const multicallPositionsResult = usePositions(chainId, {
    account,
    marketsData: markets.marketsData,
    tokensData: tokensDataResult.tokensData,
  });

  // Backend API data source.
  const apiPositionsResult = useApiPositions(chainId, account);

  // Select the active data source based on the feature flag.
  const positionsResult = useApiDataSource ? apiPositionsResult : multicallPositionsResult;

  const marketsInfo = useMarketsInfoRequest(chainId, { tokensData: tokensDataResult.tokensData });

  // For API trading mode, fetch backend markets and merge them into marketsInfoData.
  const { markets: tradingMarkets } = useTradingMarketsWithTickers(pageType === "trade" ? chainId : undefined);

  // Create synthetic markets from API data for API trading mode.
  const syntheticMarketsInfoData = useMemo(() => {
    if (pageType !== "trade" || !tradingMarkets.length || !tokensDataResult.tokensData) {
      return {};
    }

    const syntheticMarkets: MarketsInfoData = {};

    // Get USDT token for collateral
    let usdtToken: TokenData | undefined;
    try {
      const usdtTokenConfig = getTokenBySymbol(chainId, "USDT");
      if (usdtTokenConfig && tokensDataResult.tokensData) {
        usdtToken =
          tokensDataResult.tokensData[usdtTokenConfig.address] ||
          tokensDataResult.tokensData[usdtTokenConfig.address.toLowerCase()] ||
          ({
            ...usdtTokenConfig,
            prices: { minPrice: 0n, maxPrice: 0n },
            balance: 0n,
            totalSupply: 0n,
          } as TokenData);
      }
    } catch (e) {
      return {};
    }

    if (!usdtToken) return {};

    // Create synthetic markets from API data
    for (const apiMarket of tradingMarkets) {
      const baseAsset = apiMarket.base_asset.toUpperCase();
      const lastPrice = apiMarket.lastPrice || apiMarket.last_price || "0";
      const priceFloat = parseFloat(lastPrice) || 0;
      const priceBigInt =
        priceFloat > 0 ? BigInt(Math.floor(priceFloat * 1e18)) * BigInt(10 ** (USD_DECIMALS - 18)) : 0n;

      // Create synthetic token address
      const syntheticTokenAddress = `synth-${baseAsset}`.toLowerCase();
      const syntheticMarketTokenAddress = `synth-${baseAsset}-USD`;

      // Create synthetic indexToken
      const indexToken: TokenData = {
        address: syntheticTokenAddress,
        symbol: baseAsset,
        name: baseAsset,
        decimals: 18,
        isSynthetic: true,
        prices: {
          minPrice: priceBigInt,
          maxPrice: priceBigInt,
        },
        balance: 0n,
        totalSupply: 0n,
      } as TokenData;

      // Create synthetic MarketInfo
      const syntheticMarket: MarketInfo = {
        marketTokenAddress: syntheticMarketTokenAddress,
        indexTokenAddress: syntheticTokenAddress,
        longTokenAddress: usdtToken.address,
        shortTokenAddress: usdtToken.address,
        indexToken,
        longToken: usdtToken,
        shortToken: usdtToken,
        isDisabled: false,
        // Initialize all required fields with minimal values
        longPoolAmount: 0n,
        shortPoolAmount: 0n,
        maxLongPoolAmount: 0n,
        maxShortPoolAmount: 0n,
        maxLongPoolUsdForDeposit: 0n,
        maxShortPoolUsdForDeposit: 0n,
        poolValueMax: 0n,
        poolValueMin: 0n,
        reserveFactorLong: 0n,
        reserveFactorShort: 0n,
        openInterestReserveFactorLong: 0n,
        openInterestReserveFactorShort: 0n,
        maxOpenInterestLong: 0n,
        maxOpenInterestShort: 0n,
        borrowingFactorLong: 0n,
        borrowingFactorShort: 0n,
        borrowingExponentFactorLong: 0n,
        borrowingExponentFactorShort: 0n,
        fundingFactor: 0n,
        fundingExponentFactor: 0n,
        fundingIncreaseFactorPerSecond: 0n,
        fundingDecreaseFactorPerSecond: 0n,
        thresholdForStableFunding: 0n,
        thresholdForDecreaseFunding: 0n,
        minFundingFactorPerSecond: 0n,
        maxFundingFactorPerSecond: 0n,
        totalBorrowingFees: 0n,
        positionImpactPoolAmount: 0n,
        minPositionImpactPoolAmount: 0n,
        positionImpactPoolDistributionRate: 0n,
        minCollateralFactor: 0n,
        minCollateralFactorForLiquidation: 0n,
        minCollateralFactorForOpenInterestLong: 0n,
        minCollateralFactorForOpenInterestShort: 0n,
        swapImpactPoolAmountLong: 0n,
        swapImpactPoolAmountShort: 0n,
        maxPnlFactorForTradersLong: 0n,
        maxPnlFactorForTradersShort: 0n,
        longInterestUsd: 0n,
        shortInterestUsd: 0n,
        longInterestInTokens: 0n,
        shortInterestInTokens: 0n,
        positionFeeFactorForBalanceWasImproved: 0n,
        positionFeeFactorForBalanceWasNotImproved: 0n,
        positionImpactFactorPositive: expandDecimals(2, 23), // Use default values from mock
        positionImpactFactorNegative: expandDecimals(1, 23),
        maxPositionImpactFactorPositive: expandDecimals(2, 23),
        maxPositionImpactFactorNegative: expandDecimals(1, 23),
        positionImpactExponentFactor: expandDecimals(2, 30), // Required for price impact calculation
        swapFeeFactorForBalanceWasImproved: expandDecimals(2, 27),
        swapFeeFactorForBalanceWasNotImproved: expandDecimals(2, 27),
        atomicSwapFeeFactor: expandDecimals(2, 27),
        swapImpactFactorPositive: expandDecimals(2, 23),
        swapImpactFactorNegative: expandDecimals(1, 23),
        swapImpactExponentFactor: expandDecimals(2, 30),
        borrowingFactorPerSecondForLongs: 0n,
        borrowingFactorPerSecondForShorts: 0n,
        fundingFactorPerSecond: 0n,
        longsPayShorts: false,
        virtualPoolAmountForLongToken: 0n,
        virtualPoolAmountForShortToken: 0n,
        virtualInventoryForPositions: 0n,
        virtualMarketId: "",
        virtualLongTokenId: "",
        virtualShortTokenId: "",
        maxPositionImpactFactorForLiquidations: expandDecimals(1, 23),
        maxLendableImpactFactor: expandDecimals(1, 23),
        maxLendableImpactFactorForWithdrawals: expandDecimals(1, 23),
        maxLendableImpactUsd: expandDecimals(1, 23),
        lentPositionImpactPoolAmount: expandDecimals(1, 23),
      } as MarketInfo;

      syntheticMarkets[syntheticMarketTokenAddress] = syntheticMarket;
    }

    return syntheticMarkets;
  }, [pageType, tradingMarkets, chainId, tokensDataResult.tokensData]);

  // Merge synthetic markets into marketsInfoData for API trading mode.
  const mergedMarketsInfo = useMemo(() => {
    if (pageType === "trade" && Object.keys(syntheticMarketsInfoData).length > 0) {
      return {
        ...marketsInfo.marketsInfoData,
        ...syntheticMarketsInfoData,
      };
    }
    return marketsInfo.marketsInfoData;
  }, [pageType, marketsInfo.marketsInfoData, syntheticMarketsInfoData]);

  const { isFirstOrder } = useIsFirstOrder(chainId, { account });

  const shouldFetchGlvMarkets =
    isGlvEnabled(chainId) && (pageType === "pools" || pageType === "buy" || pageType === "earn");

  const glvInfo = useGlvMarketsInfo(shouldFetchGlvMarkets, {
    marketsInfoData: mergedMarketsInfo,
    tokensData: tokensDataResult.tokensData,
    chainId: chainId,
    account: account,
  });

  const { marketTokensData: depositMarketTokensData, progressiveMarketTokensData: progressiveDepositMarketTokensData } =
    useMarketTokensDataRequest(chainId, srcChainId, {
      isDeposit: true,
      account,
      glvData: glvInfo.glvData,
      withGlv: shouldFetchGlvMarkets,
    });

  const { positionsConstants } = usePositionsConstantsRequest(chainId);
  const { uiFeeFactor } = useUiFeeFactorRequest(chainId);
  const userReferralInfo = useUserReferralInfoRequest(signer, chainId, account, skipLocalReferralCode);
  const [closingPositionKey, setClosingPositionKey] = useState<string>();
  const [isCandlesLoaded, setIsCandlesLoaded] = useState(false);
  const { accruedPositionPriceImpactFees, claimablePositionPriceImpactFees } = useRebatesInfoRequest(chainId, {
    enabled: isTradePage,
    positionsConstants,
  });

  const oracleSettings = useOracleSettingsData({ enabled: pageType !== "x10000trade" });

  const [missedCoinsModalPlace, setMissedCoinsModalPlace] = useState<MissedCoinsPlace>();

  const settings = useSettings();
  const subaccountState = useSubaccountContext();
  const { features } = useEnabledFeaturesRequest(chainId);

  const {
    isLoading,
    positionsInfoData,
    error: positionsInfoError,
  } = usePositionsInfoRequest(chainId, {
    account,
    showPnlInLeverage: settings.isPnlInLeverage,
    marketsInfoData: mergedMarketsInfo,
    positionsData: positionsResult.positionsData,
    positionsError: positionsResult.error,
    marketsData: markets.marketsData,
    skipLocalReferralCode,
    tokensData: tokensDataResult.tokensData,
  });

  const ordersInfo = useOrdersInfoRequest(chainId, {
    enabled: pageType !== "x10000trade" || !shouldUseApiOrders(),
    account,
    marketsInfoData: mergedMarketsInfo,
    tokensData: tokensDataResult.tokensData,
  });

  // Single tradebox state, enabled when the outer pageType is the trading page.
  const tradeboxState = useTradeboxState(chainId, pageType === "trade", {
    marketsInfoData: mergedMarketsInfo,
    marketsData: markets.marketsData,
    tokensData: tokensDataResult.tokensData,
    positionsInfoData,
    ordersInfoData: ordersInfo.ordersInfoData,
    srcChainId,
  });

  const orderEditor = useOrderEditorState(ordersInfo.ordersInfoData);

  const timePerios = useMemo(() => getTimePeriodsInSeconds(), []);

  const { data: lastWeekAccountStats } = usePeriodAccountStats(chainId, {
    account,
    from: timePerios.week[0],
    to: timePerios.week[1],
    enabled: pageType === "trade",
  });

  const { data: lastMonthAccountStats } = usePeriodAccountStats(chainId, {
    account,
    from: timePerios.month[0],
    to: timePerios.month[1],
    enabled: pageType === "trade",
  });

  const { data: accountStats } = useAccountStats(chainId, {
    account,
    enabled: pageType === "trade",
  });

  const { blockTimestampData } = useBlockTimestampRequest(chainId, { skip: !["trade", "pools"].includes(pageType) });

  // TODO move closingPositionKey to positionSellerState
  const positionSellerState = usePositionSellerState(chainId, positionsInfoData?.[closingPositionKey ?? ""]);
  const positionEditorState = usePositionEditorState(chainId, srcChainId);
  const confirmationBoxState = useConfirmationBoxState();

  const gasLimits = useGasLimits(chainId);
  const gasPrice = useGasPrice(chainId);
  const l1ExpressOrderGasReference = useL1ExpressOrderGasReference();

  const [keepLeverage, setKeepLeverage] = useLocalStorageSerializeKey(getKeepLeverageKey(chainId), true);

  useCollectSyntheticsMetrics({
    tokensDataResult,
    marketsInfo,
    isPositionsInfoLoading: isLoading,
    positionsInfoData,
    positionsInfoError,
    isCandlesLoaded,
    pageType,
  });

  const externalSwapState = useInitExternalSwapState();
  const tokenPermitsState = useTokenPermitsContext();
  const sponsoredCallBalanceData = useIsSponsoredCallBalanceAvailable(chainId, {
    tokensData: tokensDataResult.tokensData,
  });

  const gasPaymentTokenAllowance = useTokensAllowanceData(chainId, {
    spenderAddress: getContract(chainId, "SyntheticsRouter"),
    tokenAddresses: [convertTokenAddress(chainId, settings.gasPaymentTokenAddress, "wrapped")],
  });

  const botanixStakingAssetsPerShare = useBotanixStakingAssetsPerShare({ chainId });

  const state = useMemo(() => {
    // Create merged marketsInfo with synthetic markets for API trading mode.
    const finalMarketsInfo: MarketsInfoResult = {
      ...marketsInfo,
      marketsInfoData: mergedMarketsInfo,
    };

    const s: SyntheticsState = {
      pageType,
      globals: {
        chainId,
        srcChainId,
        account,
        signer,
        markets,
        marketsInfo: finalMarketsInfo,
        ordersInfo,
        positionsConstants,
        glvInfo,
        botanixStakingAssetsPerShare,
        positionsInfo: {
          isLoading,
          positionsInfoData,
        },
        tokensDataResult,
        uiFeeFactor,
        userReferralInfo,
        depositMarketTokensData,
        progressiveDepositMarketTokensData,

        closingPositionKey,
        setClosingPositionKey,

        missedCoinsModalPlace,
        setMissedCoinsModalPlace,

        gasLimits,
        gasPrice,

        keepLeverage,
        setKeepLeverage,
        lastWeekAccountStats,
        lastMonthAccountStats,
        accountStats,
        isCandlesLoaded,
        setIsCandlesLoaded,
        isFirstOrder,
        blockTimestampData,

        oracleSettings,
      },
      claims: { accruedPositionPriceImpactFees, claimablePositionPriceImpactFees },
      leaderboard,
      settings,
      subaccountState,
      tradebox: tradeboxState,
      externalSwap: externalSwapState,
      tokenPermitsState,
      orderEditor,
      positionSeller: positionSellerState,
      positionEditor: positionEditorState,
      confirmationBox: confirmationBoxState,
      features,
      sponsoredCallBalanceData,
      gasPaymentTokenAllowance,
      l1ExpressOrderGasReference,
    };

    return s;
  }, [
    account,
    accountStats,
    accruedPositionPriceImpactFees,
    blockTimestampData,
    botanixStakingAssetsPerShare,
    chainId,
    claimablePositionPriceImpactFees,
    closingPositionKey,
    confirmationBoxState,
    depositMarketTokensData,
    externalSwapState,
    features,
    gasLimits,
    gasPaymentTokenAllowance,
    gasPrice,
    glvInfo,
    isCandlesLoaded,
    isFirstOrder,
    isLoading,
    keepLeverage,
    l1ExpressOrderGasReference,
    lastMonthAccountStats,
    lastWeekAccountStats,
    leaderboard,
    markets,
    marketsInfo,
    missedCoinsModalPlace,
    oracleSettings,
    orderEditor,
    ordersInfo,
    pageType,
    positionEditorState,
    positionSellerState,
    positionsConstants,
    positionsInfoData,
    progressiveDepositMarketTokensData,
    setKeepLeverage,
    settings,
    signer,
    sponsoredCallBalanceData,
    srcChainId,
    subaccountState,
    tokenPermitsState,
    tokensDataResult,
    tradeboxState,
    uiFeeFactor,
    userReferralInfo,
  ]);

  latestStateRef.current = state;

  return <StateCtx.Provider value={state}>{children}</StateCtx.Provider>;
}
