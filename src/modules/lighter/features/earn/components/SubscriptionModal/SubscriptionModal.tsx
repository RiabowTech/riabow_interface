import { Trans, t } from "@lingui/macro";
import { useState, useCallback, useMemo, useEffect } from "react";
import { usePublicClient, useWalletClient, useGasPrice } from "wagmi";
import { parseUnits, formatUnits } from "viem";

import { Modal } from "shared/ui";
import Button from "components/Button/Button";
import { helperToast } from "lib/helperToast";
import { prepareEarnSubscribe } from "@/modules/lighter/api/custom/client";
import { getTradingUsdtAddress } from "config/custom/contracts";
import { getExplorerUrl, type ContractsChainId } from "config/chains";
import type { EarnProduct } from "@/modules/lighter/api/types";

import "./SubscriptionModal.css";

// ERC20 ABI for approve and allowance
const ERC20_ABI = [
  {
    name: "approve",
    type: "function",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    name: "allowance",
    type: "function",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    name: "balanceOf",
    type: "function",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
] as const;

// Earn contract ABI for subscribe
const EARN_ABI = [
  {
    name: "subscribe",
    type: "function",
    inputs: [
      { name: "productId", type: "uint256" },
      { name: "amount", type: "uint256" },
      { name: "deadline", type: "uint256" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
  },
  {
    name: "usdtToken",
    type: "function",
    inputs: [],
    outputs: [{ type: "address" }],
    stateMutability: "view",
  },
] as const;

interface SubscriptionModalProps {
  isVisible: boolean;
  onClose: () => void;
  strategy: EarnProduct;
  walletAddress?: string;
  balance: string;
  chainId?: ContractsChainId;
  onSuccess?: () => void;
  earnContractAddress?: string;
}

type ModalStep = "input" | "approving" | "subscribing" | "success" | "failed";

export function SubscriptionModal({
  isVisible,
  onClose,
  strategy,
  walletAddress,
  balance,
  chainId,
  onSuccess,
  earnContractAddress,
}: SubscriptionModalProps) {
  const [step, setStep] = useState<ModalStep>("input");
  const [shares, setShares] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [estimatedGasInEth, setEstimatedGasInEth] = useState<string | null>(null);

  const publicClient = usePublicClient({ chainId });
  const { data: walletClient } = useWalletClient({ chainId });
  const { data: gasPrice } = useGasPrice({ chainId });

  // Convert from smallest unit (6 decimals for USDT) to human-readable
  const USDT_DECIMALS = 6;
  const minAmountRaw = parseFloat(strategy.min_amount?.replace(/,/g, "") || "100000000") / Math.pow(10, USDT_DECIMALS);
  const maxAmountRaw = parseFloat(strategy.max_amount_per_user?.replace(/,/g, "") || "10000000000") / Math.pow(10, USDT_DECIMALS);

  // Share price = min_amount (1 share = min_amount USDT)
  const sharePrice = minAmountRaw;
  const maxShares = Math.floor(maxAmountRaw / sharePrice);

  // Calculate amount from shares
  const sharesNum = useMemo(() => {
    return parseInt(shares.replace(/,/g, ""), 10) || 0;
  }, [shares]);

  const amountNum = useMemo(() => {
    return sharesNum * sharePrice;
  }, [sharesNum, sharePrice]);

  const balanceNum = parseFloat(balance.replace(/,/g, "")) || 0;
  const maxSharesFromBalance = Math.floor(balanceNum / sharePrice);

  // Format maturity date from settle_time
  const maturityDate = useMemo(() => {
    if (!strategy.settle_time) return "N/A";
    const date = new Date(strategy.settle_time);
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    const hours = String(date.getUTCHours()).padStart(2, "0");
    const minutes = String(date.getUTCMinutes()).padStart(2, "0");
    return `${year}.${month}.${day} ${hours}:${minutes}`;
  }, [strategy.settle_time]);

  // Truncate address for display (0xew...kgsa format)
  const truncateAddress = (address: string | undefined) => {
    if (!address) return "N/A";
    if (address.length <= 12) return address;
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  // Estimate gas fee in ETH
  useEffect(() => {
    async function estimateGas() {
      if (!publicClient || !walletAddress || gasPrice === undefined || gasPrice === null) {
        setEstimatedGasInEth(null);
        return;
      }

      try {
        // Estimate gas for a subscribe transaction (approximate)
        // Using a reasonable gas estimate for the subscribe function
        const estimatedGasLimit = 150000n; // Conservative estimate for ERC20 approve + subscribe
        const gasCostWei = estimatedGasLimit * gasPrice;
        const gasCostEth = formatUnits(gasCostWei, 18);
        setEstimatedGasInEth(parseFloat(gasCostEth).toFixed(6));
      } catch (_error) {
        setEstimatedGasInEth(null);
      }
    }

    estimateGas();
  }, [publicClient, walletAddress, gasPrice]);

  const handleMaxClick = useCallback(() => {
    const actualMaxShares = Math.min(maxSharesFromBalance, maxShares);
    setShares(actualMaxShares.toString());
  }, [maxSharesFromBalance, maxShares]);

  const handleSharesChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      // Allow only integers for shares
      if (value === "" || /^\d*$/.test(value)) {
        setShares(value);
      }
    },
    []
  );

  const handleSubscribe = useCallback(async () => {
    if (!chainId || !walletAddress || !walletClient || !publicClient) {
      setErrorMessage(t`Wallet not connected`);
      return;
    }

    if (sharesNum < 1) {
      setErrorMessage(t`Minimum 1 share required`);
      return;
    }

    if (sharesNum > maxShares) {
      setErrorMessage(t`Maximum ${maxShares.toLocaleString()} shares allowed`);
      return;
    }

    if (amountNum > balanceNum) {
      setErrorMessage(t`Insufficient wallet balance on-chain`);
      return;
    }

    const usdtAddress = getTradingUsdtAddress(chainId);

    if (!usdtAddress) {
      setErrorMessage(t`USDT address not configured`);
      return;
    }

    setStep("approving");
    setErrorMessage("");

    try {
      // Step 1: Get signature from backend FIRST to get the actual contract address
      // Backend expects amount in smallest unit (6 decimals for USDT)
      // const amountInSmallestUnit = Math.floor(amountNum * 1_000_000).toString();
      const prepareResponse = await prepareEarnSubscribe(chainId, {
        product_id: strategy.id,
        amount: amountNum.toString(),
      }, walletAddress);

      const earnContractAddress = prepareResponse.contract_address;

      // Debug: Read the contract's expected USDT token address
      const contractUsdtAddress = (await publicClient.readContract({
        address: earnContractAddress as `0x${string}`,
        abi: EARN_ABI,
        functionName: "usdtToken",
      })) as `0x${string}`;


      // Use the contract's expected USDT address for approval
      const actualUsdtAddress = contractUsdtAddress;

      // Use amount from backend response (already in smallest unit) for consistency
      const amountWei = BigInt(prepareResponse.amount);

      // Debug: Check user's USDT balance
      const userBalance = (await publicClient.readContract({
        address: actualUsdtAddress,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [walletAddress as `0x${string}`],
      })) as bigint;


      if (userBalance < amountWei) {
        setErrorMessage(`Insufficient USDT balance. You have ${formatUnits(userBalance, 6)} USDT but need ${formatUnits(amountWei, 6)} USDT`);
        setStep("failed");
        return;
      }

      // Step 2: Check allowance against the ACTUAL contract address from backend
      const currentAllowance = (await publicClient.readContract({
        address: actualUsdtAddress,
        abi: ERC20_ABI,
        functionName: "allowance",
        args: [walletAddress as `0x${string}`, earnContractAddress as `0x${string}`],
      })) as bigint;


      // Step 3: Approve if needed
      if (currentAllowance < amountWei) {
        const approveTxHash = await walletClient.writeContract({
          address: actualUsdtAddress,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [earnContractAddress as `0x${string}`, amountWei],
        });

        // Wait for approval transaction
        await publicClient.waitForTransactionReceipt({ hash: approveTxHash });
        helperToast.success(t`USDT approved`);
      }

      setStep("subscribing");

      // Debug: Log prepare response

      const subscribeArgs = [
        BigInt(prepareResponse.chain_product_id),
        BigInt(prepareResponse.amount),
        BigInt(prepareResponse.deadline),
        prepareResponse.signature as `0x${string}`,
      ] as const;

      // Step 4: Simulate contract call first to get detailed error
      try {
        const { request } = await publicClient.simulateContract({
          address: prepareResponse.contract_address as `0x${string}`,
          abi: EARN_ABI,
          functionName: "subscribe",
          args: subscribeArgs,
          account: walletAddress as `0x${string}`,
        });
      } catch (simulateError: unknown) {
        console.error("[SubscriptionModal] Simulation failed:", simulateError);
        // Log more details about the error
        if (simulateError instanceof Error) {
          console.error("[SubscriptionModal] Error message:", simulateError.message);
          console.error("[SubscriptionModal] Error cause:", (simulateError as any).cause);
          console.error("[SubscriptionModal] Error details:", (simulateError as any).details);
          console.error("[SubscriptionModal] Contract error:", (simulateError as any).contractError);
        }
        // Re-throw to be caught by outer catch
        throw simulateError;
      }

      // Step 5: Call subscribe on contract
      const subscribeTxHash = await walletClient.writeContract({
        address: prepareResponse.contract_address as `0x${string}`,
        abi: EARN_ABI,
        functionName: "subscribe",
        args: subscribeArgs,
      });

      // Wait for subscribe transaction
      await publicClient.waitForTransactionReceipt({ hash: subscribeTxHash });

      setStep("success");
      helperToast.success(t`Subscription successful!`);

      // Call onSuccess callback
      if (onSuccess) {
        onSuccess();
      }
    } catch (error: unknown) {
      console.error("[SubscriptionModal] Error:", error);

      // Handle user rejection
      if (error instanceof Error) {
        if (error.message.includes("rejected") || error.message.includes("denied")) {
          setErrorMessage(t`Transaction rejected by user`);
        } else if (error.message.includes("INSUFFICIENT_QUOTA")) {
          setErrorMessage(t`Insufficient quota available`);
        } else if (error.message.includes("EXCEED_USER_LIMIT")) {
          setErrorMessage(t`Exceeds your personal limit`);
        } else {
          setErrorMessage(error.message);
        }
      } else {
        setErrorMessage(t`Transaction failed`);
      }
      setStep("failed");
    }
  }, [
    chainId,
    walletAddress,
    walletClient,
    publicClient,
    amountNum,
    sharesNum,
    maxShares,
    balanceNum,
    strategy.id,
    onSuccess,
  ]);

  const handleClose = useCallback(() => {
    setStep("input");
    setShares("");
    setErrorMessage("");
    onClose();
  }, [onClose]);

  const handleConfirm = useCallback(() => {
    handleClose();
  }, [handleClose]);

  // Input step
  const renderInputStep = () => (
    <>
      <div className="subscription-modal-content">
        <div className="subscription-field-row">
          <span className="subscription-field-label">
            <Trans>Contract Address:</Trans>
          </span>
          <a
            href={chainId ? `${getExplorerUrl(chainId)}address/${earnContractAddress}` : "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="subscription-field-value underline hover:text-[color:var(--earn-accent)]"
          >
            {truncateAddress(earnContractAddress)}
          </a>
        </div>

        <div className="subscription-field-row">
          <span className="subscription-field-label">
            <Trans>Wallet:</Trans>
          </span>
          <span className="subscription-field-value subscription-address">{walletAddress || "Not connected"}</span>
        </div>

        <div className="subscription-field-row">
          <span className="subscription-field-label">
            <Trans>Available Balance in Wallet:</Trans>
          </span>
          <span className="subscription-field-value">
            {balance} <span className="subscription-hint">USDT</span>
          </span>
        </div>

        <div className="subscription-field-row">
          <span className="subscription-field-label">
            <Trans>Shares:</Trans>
          </span>
          <div className="subscription-input-wrapper">
            <input
              type="text"
              className="subscription-input"
              value={shares}
              onChange={handleSharesChange}
              placeholder={`1-${maxShares.toLocaleString()}`}
            />
            <button className="subscription-max-btn" onClick={handleMaxClick}>
              MAX
            </button>
          </div>
        </div>

        <div className="subscription-field-row">
          <span className="subscription-field-label">
            <Trans>Amount:</Trans>
          </span>
          <span className="subscription-field-value">
            {amountNum.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT
            <span className="subscription-hint"> (1 share = {sharePrice.toFixed(2)} USDT)</span>
          </span>
        </div>

        <div className="subscription-field-row">
          <span className="subscription-field-label">
            <Trans>Maturity Date:</Trans>
          </span>
          <span className="subscription-field-value">{maturityDate}</span>
        </div>

        <div className="subscription-field-row">
          <span className="subscription-field-label">
            <Trans>Network Fee:</Trans>
          </span>
          <span className="subscription-field-value">
            ~{estimatedGasInEth ?? "..."} <span className="subscription-hint">ETH</span>
          </span>
        </div>

        {errorMessage && <div className="subscription-error-message">{errorMessage}</div>}
      </div>

      <div className="subscription-modal-footer">
        <Button variant="secondary" className="subscription-btn" onClick={handleClose}>
          <Trans>Cancel</Trans>
        </Button>
        <Button
          variant="primary-action"
          className="subscription-btn"
          onClick={handleSubscribe}
          disabled={!shares || sharesNum < 1}
        >
          <Trans>APPROVE USDT</Trans>
        </Button>
      </div>
    </>
  );

  // Approving step
  const renderApprovingStep = () => (
    <>
      <div className="subscription-modal-content subscription-status-content">
        <div className="subscription-loading">
          <div className="subscription-spinner" />
          <p className="subscription-status-text">
            <Trans>Approving USDT...</Trans>
          </p>
        </div>
      </div>
    </>
  );

  // Subscribing step
  const renderSubscribingStep = () => (
    <>
      <div className="subscription-modal-content subscription-status-content">
        <div className="subscription-loading">
          <div className="subscription-spinner" />
          <p className="subscription-status-text">
            <Trans>Processing subscription...</Trans>
          </p>
        </div>
      </div>
    </>
  );

  // Success step
  const renderSuccessStep = () => (
    <>
      <div className="subscription-modal-content subscription-status-content">
        <div className="subscription-status-icon subscription-success-icon">✓</div>
        <h4 className="subscription-status-title subscription-success-title">
          <Trans>Subscription Successful</Trans>
        </h4>
      </div>
      <div className="subscription-modal-footer">
        <Button variant="primary-action" className="subscription-btn-full" onClick={handleConfirm}>
          <Trans>CONFIRM</Trans>
        </Button>
      </div>
    </>
  );

  // Failed step
  const renderFailedStep = () => (
    <>
      <div className="subscription-modal-content subscription-status-content">
        <div className="subscription-status-icon subscription-failed-icon">×</div>
        <h4 className="subscription-status-title subscription-failed-title">
          <Trans>Subscription Failed</Trans>
        </h4>
        <p className="subscription-error-detail">{errorMessage}</p>
      </div>
      <div className="subscription-modal-footer">
        <Button variant="primary-action" className="subscription-btn-full" onClick={handleConfirm}>
          <Trans>CONFIRM</Trans>
        </Button>
      </div>
    </>
  );

  const renderContent = () => {
    switch (step) {
      case "input":
        return renderInputStep();
      case "approving":
        return renderApprovingStep();
      case "subscribing":
        return renderSubscribingStep();
      case "success":
        return renderSuccessStep();
      case "failed":
        return renderFailedStep();
      default:
        return renderInputStep();
    }
  };

  return (
    <Modal
      isVisible={isVisible}
      setIsVisible={handleClose}
      label={t`Subscription`}
      className="subscription-modal"
      contentPadding={false}
    >
      {renderContent()}
    </Modal>
  );
}
