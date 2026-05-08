import { Trans, t } from "@lingui/macro";
import { useState, useCallback, useMemo, useEffect } from "react";
import { usePublicClient, useWalletClient, useGasPrice } from "wagmi";
import { formatUnits } from "viem";

import { Modal } from "shared/ui";
import Button from "components/Button/Button";
import { helperToast } from "lib/helperToast";
import type { ContractsChainId } from "config/chains";
import type { EarnSubscription } from "@/modules/lighter/api/types";
import { getEarnContractAddress } from "config/custom/contracts";

import "./ClaimModal.css";

// USDT decimals
const USDT_DECIMALS = 6;

// Format USDT amount from smallest unit to human-readable
function formatUsdtAmount(amount: string | number): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return "0.00";
  const converted = num / Math.pow(10, USDT_DECIMALS);
  // Use more decimal places for very small amounts (e.g. short-term interest)
  const maxDecimals = converted !== 0 && Math.abs(converted) < 0.01 ? 6 : 2;
  return converted.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: maxDecimals });
}

// Earn contract ABI for redeem functions
const EARN_CLAIM_ABI = [
  {
    name: "redeemPlan",
    type: "function",
    inputs: [{ name: "planId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    name: "getPlanPosition",
    type: "function",
    inputs: [
      { name: "planId", type: "uint256" },
      { name: "user", type: "address" },
    ],
    outputs: [
      { name: "amount", type: "uint256" },
      { name: "expectedReturn", type: "uint256" },
      { name: "actualReturn", type: "uint256" },
      { name: "subscribedAt", type: "uint256" },
      { name: "claimed", type: "bool" },
    ],
    stateMutability: "view",
  },
] as const;

interface ClaimModalProps {
  isVisible: boolean;
  onClose: () => void;
  subscription: EarnSubscription;
  walletAddress?: string;
  chainId?: ContractsChainId;
  onSuccess?: () => void;
}

type ModalStep = "confirm" | "claiming" | "success" | "failed";

export function ClaimModal({
  isVisible,
  onClose,
  subscription,
  walletAddress,
  chainId,
  onSuccess,
}: ClaimModalProps) {
  const [currentStep, setCurrentStep] = useState<ModalStep>("confirm");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [estimatedGasInEth, setEstimatedGasInEth] = useState<string | null>(null);

  const publicClient = usePublicClient({ chainId });
  const { data: walletClient } = useWalletClient({ chainId });
  const { data: gasPrice } = useGasPrice({ chainId });

  // Get earn contract address
  const earnContractAddress = chainId ? getEarnContractAddress(chainId) : undefined;

  // Use actual_return (from on-chain settlement) if available, fallback to expected_return
  const interestReturn = subscription.actual_return || subscription.expected_return || "0";

  // Calculate total claim amount (in smallest unit, then format for display)
  const totalClaimAmountRaw = useMemo(() => {
    const amount = parseFloat(subscription.amount || "0");
    const interest = parseFloat(interestReturn);
    return amount + interest;
  }, [subscription.amount, interestReturn]);

  // Estimate gas fee in ETH
  useEffect(() => {
    async function estimateGas() {
      if (!publicClient || !walletAddress || gasPrice === undefined || gasPrice === null) {
        setEstimatedGasInEth(null);
        return;
      }

      try {
        const estimatedGasLimit = 100000n; // Conservative estimate for claim
        const gasCostWei = estimatedGasLimit * gasPrice;
        const gasCostEth = formatUnits(gasCostWei, 18);
        setEstimatedGasInEth(parseFloat(gasCostEth).toFixed(6));
      } catch (_error) {
        setEstimatedGasInEth(null);
      }
    }

    estimateGas();
  }, [publicClient, walletAddress, gasPrice]);

  const handleClaim = useCallback(async () => {
    if (!walletClient || !publicClient || !walletAddress || !earnContractAddress) {
      setErrorMessage(t`Wallet not connected`);
      return;
    }

    if (!subscription.chain_product_id) {
      setErrorMessage(t`Invalid product ID`);
      return;
    }

    try {
      setCurrentStep("claiming");
      setErrorMessage("");

      // Check if user has plan position and hasn't redeemed yet
      const subscriptionData = await publicClient.readContract({
        address: earnContractAddress as `0x${string}`,
        abi: EARN_CLAIM_ABI,
        functionName: "getPlanPosition",
        args: [BigInt(subscription.chain_product_id), walletAddress as `0x${string}`],
      });

      const [amount, , , , claimed] = subscriptionData as [bigint, bigint, bigint, bigint, boolean];

      if (amount === 0n) {
        setErrorMessage(t`No subscription found for this product`);
        setCurrentStep("failed");
        return;
      }

      if (claimed) {
        setErrorMessage(t`You have already claimed this product`);
        setCurrentStep("failed");
        return;
      }

      // Simulate first to get clear error message
      try {
        await publicClient.simulateContract({
          address: earnContractAddress as `0x${string}`,
          abi: EARN_CLAIM_ABI,
          functionName: "redeemPlan",
          args: [BigInt(subscription.chain_product_id)],
          account: walletAddress as `0x${string}`,
        });
      } catch (simError: unknown) {
        console.error("[ClaimModal] Simulation failed:", simError);
        const simMsg = simError instanceof Error ? simError.message : String(simError);
        // Extract revert reason
        const reasonMatch = simMsg.match(/reason:\s*(.+?)(?:\n|$)/);
        const reason = reasonMatch?.[1] || simMsg;
        if (reason.includes("Not settled") || reason.includes("ProductNotSettled")) {
          setErrorMessage(t`Product has not been settled yet` + "。" + t`Please wait for settlement to complete.`);
        } else if (reason.includes("allowance") || reason.includes("ERC20")) {
          setErrorMessage(t`Contract USDT insufficient or not approved. Please contact admin.`);
        } else {
          setErrorMessage(reason);
        }
        setCurrentStep("failed");
        return;
      }

      // Execute redeem transaction
      const txHash = await walletClient.writeContract({
        address: earnContractAddress as `0x${string}`,
        abi: EARN_CLAIM_ABI,
        functionName: "redeemPlan",
        args: [BigInt(subscription.chain_product_id)],
      });

      helperToast.success(t`Claim submitted! Waiting for confirmation...`);

      // Wait for transaction confirmation
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

      if (receipt.status === "success") {
        setCurrentStep("success");
        helperToast.success(t`Claim successful!`);

        // Trigger success callback after short delay
        setTimeout(() => {
          onSuccess?.();
          onClose();
          setCurrentStep("confirm");
        }, 2000);
      } else {
        setErrorMessage(t`Transaction failed`);
        setCurrentStep("failed");
      }
    } catch (error: unknown) {
      console.error("[ClaimModal] Claim error:", error);
      setCurrentStep("failed");

      // Handle specific errors
      if (error instanceof Error) {
        if (error.message.includes("User rejected") || error.message.includes("user rejected")) {
          setErrorMessage(t`Transaction cancelled by user`);
        } else if (error.message.includes("AlreadyClaimed")) {
          setErrorMessage(t`You have already claimed this product`);
        } else if (error.message.includes("ProductNotSettled")) {
          setErrorMessage(t`Product has not been settled yet`);
        } else if (error.message.includes("NoSubscription")) {
          setErrorMessage(t`No subscription found for this product`);
        } else {
          setErrorMessage(error.message);
        }
      } else {
        setErrorMessage(t`Claim failed. Please try again.`);
      }
    }
  }, [walletClient, publicClient, walletAddress, earnContractAddress, subscription.chain_product_id, onSuccess, onClose]);

  const handleClose = useCallback(() => {
    if (currentStep === "claiming") return;
    onClose();
    setTimeout(() => {
      setCurrentStep("confirm");
      setErrorMessage("");
    }, 300);
  }, [currentStep, onClose]);

  const renderConfirmStep = () => (
    <>
      <div className="claim-modal-content">
        <div className="claim-field-row">
          <span className="claim-field-label">
            <Trans>Subscription Amount:</Trans>
          </span>
          <span className="claim-field-value">{formatUsdtAmount(subscription.amount)} USDT</span>
        </div>

        <div className="claim-field-row">
          <span className="claim-field-label">
            <Trans>Interest:</Trans>
          </span>
          <span className="claim-field-value">
            {formatUsdtAmount(interestReturn)} USDT (APR {subscription.annual_rate})
          </span>
        </div>

        <div className="claim-field-row claim-total-row">
          <span className="claim-field-label">
            <Trans>Total Claim Amount:</Trans>
          </span>
          <span className="claim-total-amount">{formatUsdtAmount(totalClaimAmountRaw)} USDT</span>
        </div>

        <div className="claim-field-row">
          <span className="claim-field-label">
            <Trans>Wallet:</Trans>
          </span>
          <span className="claim-field-value claim-address">{walletAddress}</span>
        </div>

        <div className="claim-field-row">
          <span className="claim-field-label">
            <Trans>Network:</Trans>
          </span>
          <span className="claim-field-value">Arbitrum</span>
        </div>

        <div className="claim-field-row">
          <span className="claim-field-label">
            <Trans>Network Fee:</Trans>
          </span>
          <span className="claim-field-value">
            ~{estimatedGasInEth ?? "..."} ETH
          </span>
        </div>
      </div>

      <div className="claim-modal-footer">
        <Button variant="secondary" className="claim-btn" onClick={handleClose}>
          <Trans>Cancel</Trans>
        </Button>
        <Button variant="primary-action" className="claim-btn" onClick={handleClaim}>
          <Trans>CLAIM</Trans>
        </Button>
      </div>
    </>
  );

  const renderClaimingStep = () => (
    <div className="claim-status-content">
      <div className="claim-loading">
        <div className="claim-spinner" />
        <p className="claim-status-text">
          <Trans>Processing claim...</Trans>
        </p>
      </div>
    </div>
  );

  const renderSuccessStep = () => (
    <div className="claim-status-content">
      <div className="claim-status-icon claim-success-icon">✓</div>
      <p className="claim-status-title claim-success-title">
        <Trans>Claim Successful!</Trans>
      </p>
      <p className="claim-status-text">
        <Trans>Your rewards have been claimed successfully.</Trans>
      </p>
    </div>
  );

  const renderFailedStep = () => (
    <div className="claim-status-content">
      <div className="claim-status-icon claim-failed-icon">✕</div>
      <p className="claim-status-title claim-failed-title">
        <Trans>Claim Failed</Trans>
      </p>
      {errorMessage && <p className="claim-error-detail">{errorMessage}</p>}
      <Button variant="primary-action" className="claim-btn-full" onClick={handleClose}>
        <Trans>Close</Trans>
      </Button>
    </div>
  );

  return (
    <Modal
      className="claim-modal"
      isVisible={isVisible}
      setIsVisible={handleClose}
      label={t`Claim`}
    >
      <div className="claim-modal-wrapper">
        {currentStep === "confirm" && renderConfirmStep()}
        {currentStep === "claiming" && renderClaimingStep()}
        {currentStep === "success" && renderSuccessStep()}
        {currentStep === "failed" && renderFailedStep()}
      </div>
    </Modal>
  );
}
