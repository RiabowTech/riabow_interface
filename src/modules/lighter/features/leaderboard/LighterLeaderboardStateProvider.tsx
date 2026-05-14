import { ReactNode, useEffect, useMemo } from "react";

import type {
  SyntheticsState,
  SyntheticsPageType,
} from "@/modules/lighter/store/SyntheticsStateContext/SyntheticsStateContextProvider";
import { useLeaderboardState } from "@/modules/lighter/store/SyntheticsStateContext/useLeaderboardState";
import { StateCtx, latestStateRef } from "@/modules/lighter/store/SyntheticsStateContext/utils";
import type { MarketsInfoResult } from "domain/synthetics/markets";
import type { TokensDataResult } from "domain/synthetics/tokens";
import { useChainId } from "lib/chains";
import useWallet from "lib/wallets/useWallet";
import { TradeMode, TradeType } from "sdk/types/trade";

const EMPTY_MARKETS_INFO: MarketsInfoResult = {
  marketsInfoData: undefined,
  error: undefined,
};

const EMPTY_TOKENS_DATA: TokensDataResult = {
  tokensData: undefined,
  pricesUpdatedAt: undefined,
  isAccountBalancesLoaded: false,
  isTradingAccountBalancesLoaded: false,
  isWalletBalancesLoaded: false,
  isBalancesLoaded: false,
  error: undefined,
};

const LEADERBOARD_PAGE_TYPE: SyntheticsPageType = "leaderboard";

/**
 * Leaderboard data comes from the Primit backend (`/api/v1/leaderboard/traders`)
 * via `useLeaderboardData`. The historical GMX wiring (markets, positions,
 * referrals, tokens) is no longer consumed — `fetchPositions` is retired and
 * returns `[]`, so position-level selectors never render rows. Earlier this
 * provider still issued the GMX RPC requests and dropped the result; this
 * removes those calls and supplies empty stubs to the legacy state shape.
 */
export function LighterLeaderboardStateProvider({ children }: { children: ReactNode }) {
  const { chainId, srcChainId } = useChainId();
  const { account, signer } = useWallet();

  const leaderboard = useLeaderboardState(account, true);
  const effectiveChainId = leaderboard.chainId ?? chainId;

  const state = useMemo(
    () =>
      ({
        pageType: LEADERBOARD_PAGE_TYPE,
        globals: {
          chainId: effectiveChainId,
          srcChainId,
          account,
          signer,
          markets: {} as SyntheticsState["globals"]["markets"],
          marketsInfo: EMPTY_MARKETS_INFO,
          positionsInfo: { positionsInfoData: {}, isLoading: false } as SyntheticsState["globals"]["positionsInfo"],
          tokensDataResult: EMPTY_TOKENS_DATA,
          ordersInfo: { ordersInfoData: {}, isLoading: false } as SyntheticsState["globals"]["ordersInfo"],
          positionsConstants: undefined,
          uiFeeFactor: 0n,
          userReferralInfo: undefined,
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
    [account, effectiveChainId, leaderboard, signer, srcChainId]
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
