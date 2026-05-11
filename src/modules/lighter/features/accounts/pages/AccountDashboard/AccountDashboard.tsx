import { Trans, t } from "@lingui/macro";
import { useCallback } from "react";
import { isAddress } from "viem";

import { SyntheticsStateContextProvider } from "@/modules/lighter/store/SyntheticsStateContext/SyntheticsStateContextProvider";
import { useChainId } from "lib/chains";

import { LighterShell } from "@/modules/lighter/components/LighterShell/LighterShell";
import PageTitle from "components/PageTitle/PageTitle";

import { DailyAndCumulativePnL } from "./DailyAndCumulativePnL";
import { HistoricalLists } from "./HistoricalLists";
import { usePageParams } from "./usePageParams";

import "./AccountDashboard.css";

function AccountWalletIcon() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path
        d="M12.5 17.5h24a5 5 0 0 1 5 5v13a4 4 0 0 1-4 4h-25a6 6 0 0 1-6-6v-20a5 5 0 0 1 5-5h21a4 4 0 0 1 4 4v5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.4"
      />
      <path
        d="M7 17.5h26.5a4 4 0 0 1 4 4v2.5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.4"
      />
      <path
        d="M32 25.5h9.5v7H32a3.5 3.5 0 1 1 0-7Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.4"
      />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path
        d="M7 7.5A2.5 2.5 0 0 1 9.5 5H15a2.5 2.5 0 0 1 2.5 2.5V13a2.5 2.5 0 0 1-2.5 2.5H9.5A2.5 2.5 0 0 1 7 13V7.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M4.5 12.5A2.5 2.5 0 0 1 2.5 10V4.5A2.5 2.5 0 0 1 5 2h5.5a2.5 2.5 0 0 1 2.45 2"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

export function AccountDashboard() {
  const { chainId: initialChainId } = useChainId();

  const { chainId, version, account } = usePageParams(initialChainId);

  // Set the trading-page runtime flag synchronously before rendering the provider.
  // This ensures shouldUseApiOrders() returns true when hooks are called during render.
  if (typeof window !== "undefined") {
    localStorage.setItem("trade_mode", "true");
  }

  if (!isAddress(account!)) {
    return (
      <LighterShell>
        <div className="mx-auto flex w-full max-w-[1512px] grow flex-col gap-1 pb-8 pt-0 max-md:px-1">
          <div className="default-container page-layout">
            <PageTitle title={t`riabow Account`} className="p-12" />
            <div className="text-center text-red-500">
              <Trans>Invalid address. Please make sure you have entered a valid Ethereum address</Trans>
            </div>
          </div>
        </div>
      </LighterShell>
    );
  }

  const handleCopyAddress = useCallback(() => {
    if (account) {
      void navigator.clipboard?.writeText(account);
    }
  }, [account]);

  return (
    <LighterShell>
      <div className="mx-auto flex w-full max-w-[1512px] grow flex-col gap-1 pb-8 pt-0 max-md:px-1">
        <div className="default-container page-layout flex flex-col gap-8">
          <div className="account-dashboard-card">
            <div className="account-hero-card">
              <div className="account-hero-icon">
                <AccountWalletIcon />
              </div>
              <div className="account-hero-copy">
                <div className="account-hero-title-row">
                  <h1>
                    <Trans>Account</Trans>
                  </h1>
                  <button type="button" className="account-address-pill" onClick={handleCopyAddress}>
                    <span>{account}</span>
                    <CopyIcon />
                  </button>
                </div>
                <p>
                  <Trans>View your trading performance and account overview</Trans>
                </p>
              </div>
            </div>

            {version === 2 && (
              <SyntheticsStateContextProvider overrideChainId={chainId} pageType="trade" skipLocalReferralCode={false}>
                <div className="account-trade-content">
                  <div className="flex flex-row flex-wrap">
                    <div className="grow *:size-full">
                      <DailyAndCumulativePnL chainId={chainId} account={account} />
                    </div>
                  </div>
                  <HistoricalLists chainId={chainId} account={account} />
                </div>
              </SyntheticsStateContextProvider>
            )}
          </div>
        </div>
      </div>
    </LighterShell>
  );
}
