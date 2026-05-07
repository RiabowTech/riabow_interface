import { t } from "@lingui/macro";
import { useCallback, useState } from "react";
import { useAccount } from "wagmi";

import type { ContractsChainId } from "config/chains";
import { helperToast } from "lib/helperToast";

import { claimReferralReward } from "./client";
import type { ReferralDashboardResponse } from "../types";

export const REFERRAL_OFFCHAIN_MIN_CLAIM_USDT = 10;

type MutateDash = (() => Promise<unknown>) | (() => void);

export function useReferralRebateClaim(
  chainId: ContractsChainId,
  dashboard: ReferralDashboardResponse | undefined,
  mutateDash: MutateDash
) {
  const { address } = useAccount();
  const [isClaiming, setIsClaiming] = useState(false);

  const handleClaim = useCallback(async () => {
    if (!dashboard?.pending_earnings) {
      helperToast.error(t`No pending earnings to claim`);
      return;
    }
    if (!address) {
      helperToast.error(t`Connect wallet to claim`);
      return;
    }

    const pendingAmount = parseFloat(dashboard.pending_earnings);
    if (!Number.isFinite(pendingAmount) || pendingAmount <= 0) {
      helperToast.error(t`No pending earnings to claim`);
      return;
    }
    if (pendingAmount < REFERRAL_OFFCHAIN_MIN_CLAIM_USDT) {
      helperToast.error(t`Minimum claim amount is 10 USDT`);
      return;
    }

    setIsClaiming(true);
    try {
      const res = await claimReferralReward(chainId, { address });
      if (res.success) {
        helperToast.success(t`${res.amount} USDT credited to your balance`);
        await mutateDash();
      } else {
        helperToast.error(t`Claim failed`);
      }
    } catch (error: unknown) {
      const msg =
        error && typeof error === "object" && "message" in error ? String((error as { message?: string }).message) : "";
      helperToast.error(msg || t`Failed to claim rebate`);
    } finally {
      setIsClaiming(false);
    }
  }, [address, chainId, dashboard, mutateDash]);

  return { handleClaim, isClaiming };
}
