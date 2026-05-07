import { Trans, t } from "@lingui/macro";
import { useEffect, useMemo } from "react";
import { useHistory } from "react-router-dom";

import { LighterShell } from "@/modules/lighter/components/LighterShell/LighterShell";
import { CHAIN_NAMES_MAP } from "config/chains";
import { getIsV1Supported } from "config/features";
import { useChainId } from "lib/chains";
import useWallet from "lib/wallets/useWallet";
import { buildAccountDashboardUrl } from "shared/utils/buildAccountDashboardUrl";

import PageTitle from "components/PageTitle/PageTitle";

import { ConnectWalletPrompt } from "./ConnectWalletPrompt";
import { usePageParams } from "../AccountDashboard/usePageParams";
import { VersionNetworkSwitcherRow } from "../AccountDashboard/VersionNetworkSwitcherRow";

export function AccountsRouter() {
  const history = useHistory();
  const { chainId: initialChainId } = useChainId();
  const { chainId, version } = usePageParams(initialChainId);
  const { active, account } = useWallet();

  const isV1Supported = useMemo(() => chainId !== undefined && getIsV1Supported(chainId), [chainId]);

  // Redirect to connected wallet's account page when wallet is connected
  useEffect(() => {
    if (active && account && chainId) {
      const accountUrl = buildAccountDashboardUrl(account, chainId, version);
      history.replace(accountUrl);
    }
  }, [active, account, chainId, version, history]);

  // Show connect wallet prompt if wallet is not connected
  if (!active || !account) {
    return (
      <LighterShell>
        <div className="default-container page-layout">
          <ConnectWalletPrompt />
        </div>
      </LighterShell>
    );
  }

  // This should not be reached due to the redirect above, but keeping it as fallback
  if (version === 1 && !isV1Supported) {
    const chainName = CHAIN_NAMES_MAP[chainId!];

    return (
      <LighterShell>
        <div className="default-container page-layout">
          <PageTitle
            isTop
            title={t`Legacy Actions`}
            subtitle={<VersionNetworkSwitcherRow chainId={chainId} version={1} />}
          />
          <div className="text-center text-yellow-300">
            <Trans>V1 is not supported on {chainName}. Please switch to Arbitrum to use V1.</Trans>
          </div>
        </div>
      </LighterShell>
    );
  }

  // Fallback: Should not reach here due to redirect
  return null;
}
