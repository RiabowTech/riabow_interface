import { Trans, t } from "@lingui/macro";
import { ethers } from "ethers";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useLocalStorage } from "react-use";

import { BOTANIX } from "config/chains";
import { REFERRALS_SELECTED_TAB_KEY } from "config/localStorage";
import { usePendingTxns } from "@/modules/lighter/context/PendingTxnsContext";
import {
  ReferralCodeStats,
  registerReferralCode,
  useAffiliateTier,
  useCodeOwner,
  useReferralsData,
  useReferrerDiscountShare,
  useUserReferralCode,
} from "domain/referrals";
import { useChainId } from "lib/chains";
import { hasReferralsIndexer } from "lib/indexers";
import { getPageTitle, isHashZero } from "lib/legacy";
import { useLocalStorageSerializeKey } from "lib/localStorage";
import { serializeBigIntsInObject } from "lib/numbers";
import useRouteQuery from "lib/useRouteQuery";
import useWallet from "lib/wallets/useWallet";

import { LighterShell } from "@/modules/lighter/components/LighterShell/LighterShell";
import { useDesignSystem } from "shared/context/DesignSystemContext/DesignSystemContext";
import AppPageLayout from "shared/components/AppPageLayout/AppPageLayout";
import { BotanixBanner } from "components/BotanixBanner/BotanixBanner";
import { ChainContentHeader } from "components/ChainContentHeader/ChainContentHeader";
import ExternalLink from "components/ExternalLink/ExternalLink";
import Loader from "components/Loader/Loader";
import AddAffiliateCode, { AffiliateCodeCreateButton } from "components/Referrals/AddAffiliateCode";
import { AffiliateCodeDisplay } from "components/Referrals/AffiliateCodeDisplay";
import { ReferralDashboard } from "components/Referrals/ReferralDashboard";
import AffiliatesStats from "components/Referrals/AffiliatesStats";
import { useReferralDashboard } from "@/modules/lighter/api/custom/useReferralDashboard";
import { BindReferralCodeForm } from "components/Referrals/BindReferralCodeForm";
import {
  CREATE_REFERRAL_CODE_QUERY_PARAM,
  deserializeSampleStats,
  isRecentReferralCodeNotExpired,
} from "components/Referrals/referralsHelper";
import TradersStats from "components/Referrals/TradersStats";
import SEO from "components/Seo/SEO";
import { Tabs } from "shared/ui";

import { ZanbaraReferralsPage } from "../ZanbaraReferralsPage/ZanbaraReferralsPage";

import "./Referrals.css";

const TRADERS = "Traders";
const AFFILIATES = "Affiliates";
const TAB_OPTIONS = [TRADERS, AFFILIATES];
const TAB_OPTION_LABELS: Record<string, string> = { [TRADERS]: "Traders", [AFFILIATES]: "Affiliates" };

function Referrals() {
  const { isZanbara } = useDesignSystem();
  const { active, account: walletAccount, signer } = useWallet();
  const { account: queryAccount } = useParams<{ account?: string }>();
  let account;
  if (queryAccount && ethers.isAddress(queryAccount)) {
    account = ethers.getAddress(queryAccount);
  } else {
    account = walletAccount;
  }
  const { chainId, srcChainId } = useChainId();
  const [activeTab, setActiveTab] = useLocalStorage(REFERRALS_SELECTED_TAB_KEY, TRADERS);
  const [recentlyAddedCodes, setRecentlyAddedCodes] = useLocalStorageSerializeKey<ReferralCodeStats[]>(
    [chainId, "REFERRAL", account],
    [],
    {
      raw: false,
      deserializer: deserializeSampleStats as any,
      serializer: (value) => {
        return JSON.stringify(serializeBigIntsInObject(value));
      },
    }
  );
  const { data: referralsData, loading } = useReferralsData(account);
  const [refreshKey, setRefreshKey] = useState(0);
  const { userReferralCode, userReferralCodeString } = useUserReferralCode(signer, chainId, account);
  const { codeOwner } = useCodeOwner(signer, chainId, account, userReferralCode);
  const { affiliateTier: traderTier } = useAffiliateTier(signer, chainId, codeOwner);
  const { discountShare } = useReferrerDiscountShare(signer, chainId, codeOwner);
  const { pendingTxns } = usePendingTxns();
  const routeQuery = useRouteQuery();

  const createReferralCodePrefill = routeQuery.get(CREATE_REFERRAL_CODE_QUERY_PARAM) ?? undefined;
  const isBotanix = chainId === BOTANIX;
  const isZanbaraReferralsRoute = isZanbara && !isBotanix;
  const shouldFetchTopLevelDashboard = Boolean(account && active) && !isZanbaraReferralsRoute;

  // Fetch referral dashboard data at component level (hooks must be at top level)
  const {
    dashboard: apiDashboard,
    isLoading: isLoadingDashboard,
    error: dashboardError,
    mutate: mutateDashboard,
  } = useReferralDashboard(chainId, {
    enabled: shouldFetchTopLevelDashboard, // Zanbara route fetches inside ZanbaraReferralsPage
  });

  function handleCreateReferralCode(referralCode: string) {
    return registerReferralCode(chainId, referralCode, signer, {
      sentMsg: "Referral code submitted.",
      failMsg: "Referral code creation failed.",
      pendingTxns,
    });
  }

  if (isZanbara && !isBotanix) {
    return (
      <LighterShell>
        <div className="mx-auto flex w-full max-w-[1512px] grow flex-col gap-1 pb-8 pt-0 max-md:px-1">
          <SEO title={getPageTitle(t`Referrals`)}>
            <ZanbaraReferralsPage
              chainId={chainId}
              account={account}
              active={active}
              loadingLegacy={loading}
              referralsData={referralsData}
              recentlyAddedCodes={recentlyAddedCodes ?? []}
            />
          </SEO>
        </div>
      </LighterShell>
    );
  }

  function renderAffiliatesTab() {
    // Check if user has referral code from API (primary check)
    // apiDashboard is already fetched at component level
    const hasApiReferralCode = Boolean(apiDashboard?.code && apiDashboard.code !== null);

    // Also check legacy data sources (for backward compatibility)
    const ownsSomeChainCode = Boolean(referralsData?.chains?.[chainId]?.codes?.length);
    const chainHasIndexer = hasReferralsIndexer(chainId);
    const hasRecentCode = recentlyAddedCodes?.some((code) => isRecentReferralCodeNotExpired(code, chainHasIndexer));
    const isSomeReferralCodeAvailable = ownsSomeChainCode || hasRecentCode;

    // Show loading state
    if (loading || (account && active && isLoadingDashboard)) {
      return (
        <div className="flex items-center justify-center p-40">
          <Loader />
        </div>
      );
    }

    // If wallet not connected, show connect wallet UI
    if (!account || !active) {
      return (
        <AddAffiliateCode
          handleCreateReferralCode={handleCreateReferralCode}
          active={active}
          recentlyAddedCodes={recentlyAddedCodes}
          setRecentlyAddedCodes={setRecentlyAddedCodes}
          initialReferralCode={createReferralCodePrefill}
        />
      );
    }

    // If user has referral code from API (primary check), show Dashboard
    if (hasApiReferralCode) {
      return <ReferralDashboard chainId={chainId} />;
    }

    // If dashboard API returned but no code (and not loading), user doesn't have a code yet
    // Check if there's an error (e.g., not authenticated)
    if (dashboardError && !isLoadingDashboard) {
      // If error is authentication-related, still allow creating code
      // The API will handle the case if code already exists
      console.warn("[Referrals] Dashboard API error:", dashboardError);
    }

    // If user has referral code from legacy sources, show Dashboard
    if (isSomeReferralCodeAvailable) {
      return <ReferralDashboard chainId={chainId} />;
    }

    // No referral code found - show button to create
    // The API will return an error if code already exists, which we'll handle
    return (
      <AffiliateCodeCreateButton
        onSuccess={() => {
          // Refresh dashboard data after creating code
          if (mutateDashboard) {
            mutateDashboard();
          }
          // Also reload page after a short delay to show the new dashboard
          setTimeout(() => {
            if (mutateDashboard) {
              mutateDashboard();
            } else {
              window.location.reload();
            }
          }, 1500);
        }}
      />
    );
  }

  const tabsOptions = useMemo(() => {
    return TAB_OPTIONS.map((option) => ({
      value: option,
      label: option === TRADERS ? t`Traders` : t`Affiliates`,
    }));
  }, []);

  useEffect(() => {
    if (createReferralCodePrefill && activeTab !== AFFILIATES) {
      setActiveTab(AFFILIATES);
    }
  }, [createReferralCodePrefill, activeTab, setActiveTab]);

  function renderTradersTab() {
    if (loading || isLoadingDashboard) {
      return (
        <div className="flex items-center justify-center p-40">
          <Loader />
        </div>
      );
    }

    // 显示绑定邀请码表单（根据 API 返回的 bound_referral 判断是否已绑定）
    return (
      <BindReferralCodeForm
        active={active}
        boundReferral={apiDashboard?.bound_referral}
        onSuccess={() => {
          // Refresh dashboard data after successful binding
          mutateDashboard();
        }}
      />
    );
  }

  return (
    <AppPageLayout header={<ChainContentHeader title={t`Referrals`} />}>
      <SEO title={getPageTitle(t`Referrals`)}>
        <div className="default-container page-layout flex min-h-0 w-full min-w-0 flex-1 flex-col gap-4">
          {isBotanix ? (
            <BotanixBanner />
          ) : (
            <div className="referrals-page">
              <Tabs
                type="block"
                options={tabsOptions}
                selectedValue={activeTab}
                onChange={setActiveTab}
                qa="referrals-tabs"
                className="w-full min-w-0 shrink-0"
              />

              <div className="referrals-tab-content" style={{ minHeight: "350px" }}>
                {activeTab === AFFILIATES ? renderAffiliatesTab() : renderTradersTab()}
              </div>
            </div>
          )}
        </div>
      </SEO>
    </AppPageLayout>
  );
}

export default Referrals;
