import { lazy, Suspense, useEffect } from "react";
import { Route, Switch, useLocation } from "react-router-dom";

import { LighterLeaderboardStateProvider } from "@/modules/lighter/features/leaderboard/LighterLeaderboardStateProvider";
import LighterTradePage from "@/modules/lighter/pages/LighterTradePage";
import LighterSpotPage from "@/modules/lighter/pages/LighterSpotPage";
import { LighterTradeRuntimeProviders } from "@/modules/lighter/providers/LighterTradeRuntimeProviders";
import { TradeStateProvider } from "@/modules/lighter/store/TradeStateContext/TradeStateContext";
import { RedirectWithQuery } from "@/shared/components/RedirectWithQuery/RedirectWithQuery";
import { TradingAccountModal } from "@/shared/components/TradingAccountModal/TradingAccountModal";

import Loader from "components/Loader/Loader";

function lazyWithRetry(factory: () => Promise<{ default: React.ComponentType<any> }>) {
  return lazy(() =>
    factory().catch((err) => {
      const key = `chunk_reload_${window.location.pathname}`;
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, "1");
        window.location.reload();
        return new Promise(() => undefined);
      }
      sessionStorage.removeItem(key);
      throw err;
    })
  );
}

const FeeVipPage = lazyWithRetry(() =>
  import("@/modules/lighter/features/feeVip/pages/FeeVipPage/FeeVipPage").then((m) => ({ default: m.FeeVipPage }))
);
const EarnPage = lazyWithRetry(() => import("@/modules/lighter/features/earn/pages/Earn/Earn"));
const ReferralsPage = lazyWithRetry(() => import("@/modules/lighter/features/referrals/pages/Referrals/Referrals"));
const LeaderboardPage = lazyWithRetry(() =>
  import("@/modules/lighter/features/leaderboard/pages/LeaderboardPage/LeaderboardPage").then((m) => ({
    default: m.LeaderboardPage,
  }))
);
const AccountsRoutesPage = lazyWithRetry(() =>
  import("@/modules/lighter/features/accounts/routes").then((m) => ({
    default: m.AccountsRoutes,
  }))
);
const PointsPage = lazyWithRetry(() =>
  import("@/modules/lighter/features/points/pages/PointsPage/PointsPage").then((m) => ({
    default: m.PointsPage,
  }))
);

const SuspenseWrapper = ({ children }: { children: React.ReactNode }) => (
  <Suspense
    fallback={
      <div className="flex h-screen items-center justify-center">
        <Loader />
      </div>
    }
  >
    {children}
  </Suspense>
);

const ACCOUNT_ROUTE_PATHS = [
  "/accounts",
  "/accounts/:account",
  "/actions",
  "/actions/:account",
  "/actions/:v/:account",
];

const LegacyPageProviders = ({ children }: { children: React.ReactNode }) => (
  <LighterTradeRuntimeProviders>
    {children}
    <TradingAccountModal />
  </LighterTradeRuntimeProviders>
);

export function MainRoutes({ openSettings: _openSettings }: { openSettings: () => void }) {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <Switch>
      <Route exact path="/">
        <RedirectWithQuery to="/futures" />
      </Route>

      {/* /trade 旧路径保持兼容，重定向到 /futures */}
      <Route exact path="/trade/:tradeType?">
        <RedirectWithQuery to="/futures" />
      </Route>

      <Route exact path="/futures/:tradeType?">
        <TradeStateProvider product="futures">
          <LighterTradeRuntimeProviders>
            <LighterTradePage />
            <TradingAccountModal />
          </LighterTradeRuntimeProviders>
        </TradeStateProvider>
      </Route>

      <Route exact path="/spot/:tradeType?">
        <TradeStateProvider product="spot">
          <LighterTradeRuntimeProviders>
            <LighterSpotPage />
            <TradingAccountModal />
          </LighterTradeRuntimeProviders>
        </TradeStateProvider>
      </Route>

      <Route exact path="/fee-vip">
        <LegacyPageProviders>
          <SuspenseWrapper>
            <FeeVipPage />
          </SuspenseWrapper>
        </LegacyPageProviders>
      </Route>

      <Route exact path="/earn">
        <LegacyPageProviders>
          <SuspenseWrapper>
            <EarnPage />
          </SuspenseWrapper>
        </LegacyPageProviders>
      </Route>

      <Route exact path="/referrals/:account?">
        <LegacyPageProviders>
          <SuspenseWrapper>
            <ReferralsPage />
          </SuspenseWrapper>
        </LegacyPageProviders>
      </Route>

      <Route path="/leaderboard/">
        <LighterTradeRuntimeProviders>
          <LighterLeaderboardStateProvider>
            <SuspenseWrapper>
              <LeaderboardPage />
            </SuspenseWrapper>
          </LighterLeaderboardStateProvider>
          <TradingAccountModal />
        </LighterTradeRuntimeProviders>
      </Route>

      <Route path={ACCOUNT_ROUTE_PATHS}>
        <LegacyPageProviders>
          <SuspenseWrapper>
            <AccountsRoutesPage />
          </SuspenseWrapper>
        </LegacyPageProviders>
      </Route>

      <Route exact path="/points">
        <LegacyPageProviders>
          <SuspenseWrapper>
            <PointsPage />
          </SuspenseWrapper>
        </LegacyPageProviders>
      </Route>

      <Route>
        <RedirectWithQuery to="/futures" />
      </Route>
    </Switch>
  );
}
