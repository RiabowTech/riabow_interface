import { ReactNode, useEffect, useMemo } from "react";

import type { SyntheticsState } from "@/modules/lighter/store/SyntheticsStateContext/SyntheticsStateContextProvider";
import { useLeaderboardState } from "@/modules/lighter/store/SyntheticsStateContext/useLeaderboardState";
import { StateCtx, latestStateRef } from "@/modules/lighter/store/SyntheticsStateContext/utils";
import { useUserReferralInfoRequest } from "domain/referrals";
import { useMarketsInfoRequest } from "domain/synthetics/markets";
import { usePositionsConstantsRequest } from "domain/synthetics/positions";
import { useTokensDataRequest } from "domain/synthetics/tokens";
import { useChainId } from "lib/chains";
import useWallet from "lib/wallets/useWallet";
import { TradeMode, TradeType } from "sdk/types/trade";

export function LighterLeaderboardStateProvider({ children }: { children: ReactNode }) {
  const { chainId, srcChainId } = useChainId();
  const { account, signer } = useWallet();

  const leaderboard = useLeaderboardState(account, true);
  const effectiveChainId = leaderboard.chainId ?? chainId;

  const tokensDataResult = useTokensDataRequest(effectiveChainId, srcChainId);
  const marketsInfo = useMarketsInfoRequest(effectiveChainId, {
    tokensData: tokensDataResult.tokensData,
  });
  const { positionsConstants } = usePositionsConstantsRequest(effectiveChainId);
  const userReferralInfo = useUserReferralInfoRequest(signer, effectiveChainId, account, true);

  const state = useMemo(
    () =>
      ({
        pageType: "leaderboard",
        globals: {
          chainId: effectiveChainId,
          srcChainId,
          account,
          signer,
          markets: {} as SyntheticsState["globals"]["markets"],
          marketsInfo,
          positionsInfo: { positionsInfoData: {}, isLoading: false } as SyntheticsState["globals"]["positionsInfo"],
          tokensDataResult,
          ordersInfo: { ordersInfoData: {}, isLoading: false } as SyntheticsState["globals"]["ordersInfo"],
          positionsConstants,
          uiFeeFactor: 0n,
          userReferralInfo,
          depositMarketTokensData: undefined,
          progressiveDepositMarketTokensData: undefined,
          glvInfo: {} as SyntheticsState["globals"]["glvInfo"],
          botanixStakingAssetsPerShare: undefined,
          closingPositionKey: undefined,
          setClosingPositionKey: () => undefined,
          keepLeverage: true,
          setKeepLeverage: () => undefined,
          missedCoinsModalPlace: undefined,
          setMissedCoinsModalPlace: () => undefined,
          gasLimits: {} as SyntheticsState["globals"]["gasLimits"],
          gasPrice: {} as SyntheticsState["globals"]["gasPrice"],
          lastWeekAccountStats: undefined,
          lastMonthAccountStats: undefined,
          accountStats: undefined,
          isCandlesLoaded: false,
          setIsCandlesLoaded: () => undefined,
          isFirstOrder: false,
          blockTimestampData: undefined,
          oracleSettings: undefined,
        },
        claims: {
          accruedPositionPriceImpactFees: [],
          claimablePositionPriceImpactFees: [],
        },
        leaderboard,
        settings: {} as SyntheticsState["settings"],
        subaccountState: {} as SyntheticsState["subaccountState"],
        tradebox: {
          tradeType: TradeType.Long,
          tradeMode: TradeMode.Market,
        } as SyntheticsState["tradebox"],
        externalSwap: {} as SyntheticsState["externalSwap"],
        tokenPermitsState: {} as SyntheticsState["tokenPermitsState"],
        orderEditor: {} as SyntheticsState["orderEditor"],
        positionSeller: {} as SyntheticsState["positionSeller"],
        positionEditor: {} as SyntheticsState["positionEditor"],
        confirmationBox: {} as SyntheticsState["confirmationBox"],
        features: undefined,
        gasPaymentTokenAllowance: undefined,
        sponsoredCallBalanceData: undefined,
        l1ExpressOrderGasReference: undefined,
      }) satisfies SyntheticsState,
    [
      account,
      effectiveChainId,
      leaderboard,
      marketsInfo,
      positionsConstants,
      signer,
      srcChainId,
      tokensDataResult,
      userReferralInfo,
    ]
  );

  useEffect(() => {
    latestStateRef.current = state;
    return () => {
      if (latestStateRef.current === state) {
        latestStateRef.current = null;
      }
    };
  }, [state]);

  return <StateCtx.Provider value={state}>{children}</StateCtx.Provider>;
}
