import { Trans, t } from "@lingui/macro";
import { useCallback, useMemo } from "react";
import { useCopyToClipboard } from "react-use";

import { ContractsChainId, SourceChainId } from "config/chains";
import { hasReferralsIndexer } from "lib/indexers";
import type { ReferralCodeStats, TotalReferralsStats } from "domain/referrals/types";
import { helperToast } from "lib/helperToast";
import { userAnalytics } from "lib/userAnalytics";
import { ReferralShareEvent } from "lib/userAnalytics/types";

import Button from "components/Button/Button";
import { TrackingLink } from "components/TrackingLink/TrackingLink";

import CopyIcon from "img/ic_copy.svg?react";
import TwitterIcon from "img/ic_x.svg?react";

import { getReferralCodeTradeUrl, getTwitterShareUrl, isRecentReferralCodeNotExpired } from "./referralsHelper";

type Props = {
  chainId: ContractsChainId;
  referralsData?: TotalReferralsStats;
  recentlyAddedCodes?: ReferralCodeStats[];
  handleCreateReferralCode: (code: string) => Promise<unknown>;
  setRecentlyAddedCodes: (codes: ReferralCodeStats[]) => void;
  initialReferralCode?: string;
};

export function AffiliateCodeDisplay({
  chainId,
  referralsData,
  recentlyAddedCodes,
  handleCreateReferralCode,
  setRecentlyAddedCodes,
  initialReferralCode,
}: Props) {
  const [, copyToClipboard] = useCopyToClipboard();
  const { chains } = referralsData || {};
  const { [chainId]: currentReferralsData } = chains || {};
  const { affiliateReferralCodesStats } = currentReferralsData || {};
  const chainHasIndexer = hasReferralsIndexer(chainId);

  // Get all referral codes (from API and recently added)
  const allReferralCodes = useMemo(() => {
    const apiCodes = affiliateReferralCodesStats?.map((c) => c.referralCode.trim()) || [];
    const recentCodes =
      recentlyAddedCodes
        ?.filter((code) => isRecentReferralCodeNotExpired(code, chainHasIndexer))
        .map((c) => c.referralCode.trim()) || [];
    
    // Combine and deduplicate
    const combined = [...new Set([...apiCodes, ...recentCodes])];
    return combined;
  }, [affiliateReferralCodesStats, recentlyAddedCodes, chainHasIndexer]);

  const trackCopyCode = useCallback(() => {
    userAnalytics.pushEvent<ReferralShareEvent>(
      {
        event: "ReferralCodeAction",
        data: {
          action: "CopyCode",
        },
      },
      { instantSend: true }
    );
  }, []);

  const trackShareTwitter = useCallback(() => {
    userAnalytics.pushEvent<ReferralShareEvent>(
      {
        event: "ReferralCodeAction",
        data: {
          action: "ShareTwitter",
        },
      },
      { instantSend: true }
    );
  }, []);

  // Get the first referral code to display
  const displayCode = allReferralCodes[0] || "";

  const handleCopy = useCallback(() => {
    if (!displayCode) return;
    trackCopyCode();
    copyToClipboard(getReferralCodeTradeUrl(displayCode));
    helperToast.success(t`Referral link copied to your clipboard`);
  }, [displayCode, trackCopyCode, copyToClipboard]);

  if (!displayCode) {
    return null;
  }

  return (
    <div className="referral-card section-center">
      <h2 className="title">
        <Trans>Your Referral Code</Trans>
      </h2>
      <p className="sub-title">
        <Trans>Share your referral code and earn rebates from traders you refer.</Trans>
      </p>
      <div className="card-action">
        <div className="flex items-center justify-center gap-12 mb-16">
          <span className="referral-text text-20 font-mono font-medium">{displayCode}</span>
          <div
            onClick={handleCopy}
            className="referral-code-icon size-20 cursor-pointer text-typography-secondary hover:text-typography-primary flex items-center"
          >
            <CopyIcon className="size-20" />
          </div>
          <TrackingLink onClick={trackShareTwitter}>
            <a
              href={getTwitterShareUrl(displayCode)}
              target="_blank"
              rel="noopener noreferrer"
              className="referral-code-icon size-20 text-typography-secondary hover:text-typography-primary flex items-center"
            >
              <TwitterIcon className="size-20" />
            </a>
          </TrackingLink>
        </div>
        <Button variant="primary-action" className="w-full max-w-[400px] mx-auto" onClick={handleCopy}>
          <Trans>Copy Referral Link</Trans>
        </Button>
      </div>
    </div>
  );
}

