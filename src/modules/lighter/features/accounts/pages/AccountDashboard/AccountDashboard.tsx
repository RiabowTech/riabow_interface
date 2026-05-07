import { Trans, t } from "@lingui/macro";
import { useState } from "react";
import { useMedia } from "react-use";
import { isAddress } from "viem";

import { SyntheticsStateContextProvider } from "@/modules/lighter/store/SyntheticsStateContext/SyntheticsStateContextProvider";
import { useChainId } from "lib/chains";

import AddressView from "components/AddressView/AddressView";
import { LighterShell } from "@/modules/lighter/components/LighterShell/LighterShell";
import PageTitle from "components/PageTitle/PageTitle";
import { Tabs } from "shared/ui";

import { DailyAndCumulativePnL } from "./DailyAndCumulativePnL";
import { GeneralPerformanceDetails } from "./GeneralPerformanceDetails";
import { HistoricalLists } from "./HistoricalLists";
import { usePageParams } from "./usePageParams";
import { EarnContent } from "./EarnContent";

import "./AccountDashboard.css";

const TABS = {
  TRADE: "trade",
  EARN: "earn",
} as const;

type TabValue = (typeof TABS)[keyof typeof TABS];

export function AccountDashboard() {
  const { chainId: initialChainId } = useChainId();
  const isMobile = useMedia("(max-width: 600px)");
  const [activeTab, setActiveTab] = useState<TabValue>(TABS.TRADE);

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
            <PageTitle title={t`Primit Account`} className="p-12" />
            <div className="text-center text-red-500">
              <Trans>Invalid address. Please make sure you have entered a valid Ethereum address</Trans>
            </div>
          </div>
        </div>
      </LighterShell>
    );
  }

  const tabOptions = [
    { value: TABS.TRADE, label: t`Trade` },
    { value: TABS.EARN, label: t`Earn` },
  ];

  return (
    <LighterShell>
      <div className="mx-auto flex w-full max-w-[1512px] grow flex-col gap-1 pb-8 pt-0 max-md:px-1">
        <div className="default-container page-layout flex flex-col gap-8">
          <div className="account-dashboard-card">
            <PageTitle
              title={t`Primit Account`}
              subtitle={
                <div className="text-body-medium mb-20 flex flex-wrap items-center gap-4 font-medium">
                  <Trans>Primit information for account</Trans>
                  <AddressView noLink address={account} size={20} breakpoint={isMobile ? "XL" : undefined} />
                </div>
              }
            />

            {/* Tab Navigation */}
            <div className="account-tabs">
              <Tabs
                options={tabOptions}
                selectedValue={activeTab}
                onChange={setActiveTab}
                type="block"
                qa="portfolio-tabs"
              />
            </div>

            {/* Tab Content */}
            {version === 2 && (
              <SyntheticsStateContextProvider overrideChainId={chainId} pageType="trade" skipLocalReferralCode={false}>
                {activeTab === TABS.TRADE ? (
                  <div className="flex flex-col gap-8">
                    <div className="flex flex-row flex-wrap gap-8">
                      {/* <div className="max-w-full grow-[2] *:size-full">
                      <GeneralPerformanceDetails chainId={chainId} account={account} />
                    </div> */}
                      <div className="grow *:size-full">
                        <DailyAndCumulativePnL chainId={chainId} account={account} />
                      </div>
                    </div>
                    <HistoricalLists chainId={chainId} account={account} />
                  </div>
                ) : (
                  <div className="flex max-w-full flex-col gap-8 overflow-hidden">
                    <EarnContent chainId={chainId} account={account} />
                  </div>
                )}
              </SyntheticsStateContextProvider>
            )}
          </div>
        </div>
      </div>
    </LighterShell>
  );
}
