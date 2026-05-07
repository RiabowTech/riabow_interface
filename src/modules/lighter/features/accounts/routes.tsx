import { lazy, Suspense } from "react";
import { Redirect, Route } from "react-router-dom";
import type { Address } from "viem";

import { useChainId } from "lib/chains";
import { buildAccountDashboardUrl } from "shared/utils/buildAccountDashboardUrl";

// 命名导出
const AccountDashboard = lazy(() =>
  import("@/modules/lighter/features/accounts/pages/AccountDashboard/AccountDashboard").then((m) => ({
    default: m.AccountDashboard,
  }))
);
const AccountsRouterLazy = lazy(() =>
  import("@/modules/lighter/features/accounts/pages/Actions/ActionsRouter").then((m) => ({
    default: m.AccountsRouter,
  }))
);
// 默认导出
import Loader from "components/Loader/Loader";

const SuspenseWrapper = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader /></div>}>
    {children}
  </Suspense>
);

function AccountRedirectRoute() {
  const { chainId } = useChainId();
  return (
    <Route exact path="/actions/:v/:account">
      {({ match }) => (
        <Redirect
          to={buildAccountDashboardUrl(match?.params.account as Address, chainId, match?.params.v === "v1" ? 1 : 2)}
        />
      )}
    </Route>
  );
}

export function AccountsRoutes() {
  return (
    <>
      <Redirect exact from="/actions/v2" to="/accounts" />
      <Redirect exact from="/actions" to="/accounts" />
      <Redirect exact from="/actions/:account" to="/accounts/:account" />
      <AccountRedirectRoute />
      <Route
        exact
        path="/accounts"
        render={() => (
          <SuspenseWrapper>
            <AccountsRouterLazy />
          </SuspenseWrapper>
        )}
      />
      <Route
        exact
        path="/accounts/:account"
        render={() => (
          <SuspenseWrapper>
            <AccountDashboard />
          </SuspenseWrapper>
        )}
      />
    </>
  );
}
