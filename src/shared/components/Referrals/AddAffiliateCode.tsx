import { Trans, t } from "@lingui/macro";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import cx from "classnames";
import type { TransactionResponse } from "ethers";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAccount, useSignTypedData } from "wagmi";

import { getChainName } from "config/chains";
import type { ReferralCodeStats } from "domain/referrals/types";
import { useChainId } from "lib/chains";
import { useDebounce } from "lib/debounce/useDebounce";
import { helperToast } from "lib/helperToast";
import { switchNetwork } from "lib/wallets";
import useWallet from "lib/wallets/useWallet";
import { getAddress } from "viem";
import { createReferralCode, getNonce } from "@/modules/lighter/api/custom/client";

import { AlertInfoCard } from "components/AlertInfo/AlertInfoCard";
import Button from "components/Button/Button";
import Modal from "components/Modal/Modal";

import { getCodeError, getReferralCodeTakenStatus, getSampleReferrarStat } from "./referralsHelper";

type AddAffiliateCodeProps = {
  handleCreateReferralCode: (code: string) => Promise<unknown>;
  active: boolean;
  setRecentlyAddedCodes: (code: ReferralCodeStats[]) => void;
  recentlyAddedCodes: ReferralCodeStats[] | undefined;
  initialReferralCode: string | undefined;
};

function AddAffiliateCode({
  handleCreateReferralCode,
  active,
  setRecentlyAddedCodes,
  recentlyAddedCodes,
  initialReferralCode,
}: AddAffiliateCodeProps) {
  const { openConnectModal } = useConnectModal();
  return (
    <div className="referral-card section-center">
      <h2 className="title">
        <Trans>Generate Referral Code</Trans>
      </h2>
      <p className="sub-title">
        <Trans>
          Looks like you don't have a referral code to share. <br /> Create one now and start earning rebates!
        </Trans>
      </p>
      <div className="card-action">
        {active ? (
          <AffiliateCodeForm
            handleCreateReferralCode={handleCreateReferralCode}
            recentlyAddedCodes={recentlyAddedCodes}
            setRecentlyAddedCodes={setRecentlyAddedCodes}
            initialReferralCode={initialReferralCode}
          />
        ) : (
          <Button variant="primary-action" className="mx-auto w-full max-w-[400px]" onClick={openConnectModal}>
            <Trans>Connect Wallet</Trans>
          </Button>
        )}
      </div>
    </div>
  );
}

export function AffiliateCodeForm({
  handleCreateReferralCode,
  recentlyAddedCodes,
  setRecentlyAddedCodes,
  callAfterSuccess,
  initialReferralCode = "",
}: {
  handleCreateReferralCode: (code: string) => Promise<unknown>;
  recentlyAddedCodes: ReferralCodeStats[] | undefined;
  setRecentlyAddedCodes: (code: ReferralCodeStats[]) => void;
  callAfterSuccess?: () => void;
  initialReferralCode?: string;
}) {
  const { chainId, srcChainId } = useChainId();
  const { address: account, isConnected } = useAccount();

  // Generate a referral code based on wallet address
  const generateReferralCodeFromAddress = (address: string | undefined): string => {
    if (!address) return "";
    // Use the last 8 characters of the address to create a readable code
    return `USER${address.slice(-8).toUpperCase()}`;
  };

  // Check localStorage for existing code for this wallet
  const getStoredReferralCode = (): string => {
    if (!account) return "";
    const stored = localStorage.getItem(`referral_code_${account.toLowerCase()}`);
    if (stored) return stored;
    // If no stored code, generate and store one
    const generated = generateReferralCodeFromAddress(account);
    if (generated) {
      localStorage.setItem(`referral_code_${account.toLowerCase()}`, generated);
    }
    return generated;
  };

  const [referralCode, setReferralCode] = useState(initialReferralCode?.trim() || getStoredReferralCode());
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [referralCodeCheckStatus, setReferralCodeCheckStatus] = useState("ok");
  const debouncedReferralCode = useDebounce(referralCode, 300);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Update referral code when account changes
  useEffect(() => {
    if (!initialReferralCode && account) {
      const storedCode = getStoredReferralCode();
      if (storedCode && storedCode !== referralCode) {
        setReferralCode(storedCode);
        setError(getCodeError(storedCode));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account]);

  useEffect(() => {
    const sanitizedCode = initialReferralCode?.trim() ?? "";
    setReferralCode(sanitizedCode);
    setError(getCodeError(sanitizedCode));
  }, [initialReferralCode]);

  useEffect(() => {
    let cancelled = false;
    const checkCodeTakenStatus = async () => {
      if (error) {
        setReferralCodeCheckStatus("ok");
        return;
      }
      const { takenStatus: takenStatus } = await getReferralCodeTakenStatus(account, debouncedReferralCode, chainId);
      // ignore the result if the referral code to check has changed
      if (cancelled) {
        return;
      }
      if (takenStatus === "none") {
        setReferralCodeCheckStatus("ok");
      } else {
        setReferralCodeCheckStatus("taken");
      }
    };
    setReferralCodeCheckStatus("checking");
    checkCodeTakenStatus();
    return () => {
      cancelled = true;
    };
  }, [account, debouncedReferralCode, error, chainId]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsProcessing(true);

    const trimmedCode = referralCode.trim();
    const { takenStatus, info: takenInfo } = await getReferralCodeTakenStatus(account, trimmedCode, chainId);
    if (["all", "current", "other"].includes(takenStatus)) {
      setIsProcessing(false);
    }

    if (takenStatus === "none" || takenStatus === "other") {
      try {
        const tx = (await handleCreateReferralCode(trimmedCode)) as TransactionResponse;

        if (callAfterSuccess) {
          callAfterSuccess();
        }

        const receipt = await tx.wait();

        if (receipt?.status === 1) {
          // Save the referral code to localStorage for this wallet
          if (account) {
            localStorage.setItem(`referral_code_${account.toLowerCase()}`, trimmedCode);
          }

          if (recentlyAddedCodes) {
            recentlyAddedCodes.push(getSampleReferrarStat({ code: trimmedCode, takenInfo, account }));
            setRecentlyAddedCodes(recentlyAddedCodes);
          }
          helperToast.success(t`Referral code created.`);
          setReferralCode("");
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(err);
      } finally {
        setIsProcessing(false);
      }
    }
  }

  let buttonState: {
    text: string;
    disabled?: boolean;
    onSubmit?: (event: React.FormEvent) => void;
  } = {
    text: "",
    disabled: false,
    onSubmit: undefined,
  };

  if (srcChainId !== undefined) {
    buttonState = {
      text: t`Switch to ${getChainName(chainId)}`,
      disabled: false,
      onSubmit: (event: React.FormEvent) => {
        event.preventDefault();
        switchNetwork(chainId, isConnected);
      },
    };
  } else if (!debouncedReferralCode) {
    buttonState = {
      text: t`Enter a code`,
      disabled: true,
    };
  } else if (referralCodeCheckStatus === "taken") {
    buttonState = {
      text: t`Code already taken`,
      disabled: true,
    };
  } else if (referralCodeCheckStatus === "checking") {
    buttonState = {
      text: t`Checking code`,
      disabled: true,
    };
  } else if (isProcessing) {
    buttonState = {
      text: t`Creating`,
      disabled: true,
    };
  } else {
    buttonState = {
      text: t`Create`,
      disabled: false,
      onSubmit: handleSubmit,
    };
  }

  return (
    <form onSubmit={buttonState.onSubmit}>
      <input
        type="text"
        ref={inputRef}
        value={referralCode}
        disabled={isProcessing}
        className={cx("text-input", { "mb-15": !error })}
        placeholder={t`Enter a code`}
        onChange={({ target }) => {
          const { value } = target;
          setReferralCode(value);
          setError(getCodeError(value));
        }}
      />
      {error && <p className="AffiliateCode-error">{error}</p>}
      {srcChainId && (
        <AlertInfoCard className="mb-15 text-left">
          <Trans>
            Please switch to {getChainName(chainId)} to create your referral code. It will work across all other
            networks.
          </Trans>
        </AlertInfoCard>
      )}
      <Button variant="primary-action" className="w-full" type="submit" disabled={buttonState.disabled}>
        {buttonState.text}
      </Button>
    </form>
  );
}

/**
 * 构建 EIP-712 CreateReferralCode 签名数据
 * 格式必须与后端 eip712.rs 中的 CreateReferralMessage 一致
 */
function buildCreateReferralTypedData(
  domain: { name: string; version: string; chainId: number; verifyingContract: string },
  wallet: string,
  timestamp: number
): Record<string, unknown> {
  return {
    types: {
      EIP712Domain: [
        { name: "name", type: "string" },
        { name: "version", type: "string" },
        { name: "chainId", type: "uint256" },
        { name: "verifyingContract", type: "address" },
      ],
      CreateReferralCode: [
        { name: "wallet", type: "address" },
        { name: "timestamp", type: "uint256" },
      ],
    },
    primaryType: "CreateReferralCode",
    domain: {
      name: domain.name,
      version: domain.version,
      chainId: domain.chainId,
      verifyingContract: domain.verifyingContract,
    },
    message: {
      wallet: wallet,
      timestamp: timestamp.toString(),
    },
  };
}

// New component: Simple button to create referral code
export function AffiliateCodeCreateButton({
  handleCreateReferralCode: _handleCreateReferralCode,
  setRecentlyAddedCodes: _setRecentlyAddedCodes,
  recentlyAddedCodes: _recentlyAddedCodes,
  initialReferralCode: _initialReferralCode,
  onSuccess,
  /** 为 true 时增加内嵌布局用 class（如 Primit 推荐页） */
  embedded,
}: {
  handleCreateReferralCode?: (code: string) => Promise<unknown>;
  setRecentlyAddedCodes?: (code: ReferralCodeStats[]) => void;
  recentlyAddedCodes?: ReferralCodeStats[] | undefined;
  initialReferralCode?: string | undefined;
  onSuccess?: () => void;
  embedded?: boolean;
}) {
  const { address } = useAccount();
  const { chainId } = useChainId();
  const { signTypedDataAsync } = useSignTypedData();
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = useCallback(async () => {
    if (!address || !chainId) {
      helperToast.error(t`Please connect your wallet`);
      return;
    }

    setIsCreating(true);
    try {
      // Step 1: Get domain configuration from backend (via nonce endpoint)
      // This ensures we use the same EIP-712 domain as the backend
      const nonceResponse = await getNonce(chainId, address);

      if (!nonceResponse.typed_data?.domain) {
        throw new Error("Failed to get EIP-712 domain configuration");
      }

      const domain = nonceResponse.typed_data.domain;
      const checksumAddress = getAddress(address);
      const timestamp = Math.floor(Date.now() / 1000);

      // Step 2: Build typed data for CreateReferralCode
      const typedData = buildCreateReferralTypedData(domain, checksumAddress, timestamp);

      // Step 3: Sign via wagmi(走 connector 路由,走 window.ethereum 直接请求会在
      // 多钱包/Rainbow/WalletConnect 下报 "must provide an Ethereum address")。
      const signature = await signTypedDataAsync({
        account: checksumAddress as `0x${string}`,
        domain: typedData.domain as any,
        types: typedData.types as any,
        primaryType: typedData.primaryType as any,
        message: typedData.message as any,
      });


      // Step 5: Call API to create referral code
      try {
        const response = await createReferralCode(chainId, {
          timestamp,
          signature,
        });

        if (response.success && response.code) {
          helperToast.success(t`Referral code created: ${response.code}`);

          // Call onSuccess callback to refresh data
          if (onSuccess) {
            onSuccess();
          }
        } else {
          throw new Error("Failed to create referral code");
        }
      } catch (apiError: any) {
        // Handle the case where code already exists
        if (
          apiError?.error === "CODE_ALREADY_EXISTS" ||
          apiError?.message?.includes("CODE_ALREADY_EXISTS") ||
          apiError?.message?.includes("已经有推荐码")
        ) {
          // Extract the existing code from error message if available
          const codeMatch = apiError?.message?.match(/推荐码:\s*([A-Z0-9]+)/);
          const existingCode = codeMatch ? codeMatch[1] : null;

          if (existingCode) {
            helperToast.success(t`You already have a referral code: ${existingCode}`);
          } else {
            helperToast.success(t`You already have a referral code`);
          }

          // Refresh dashboard to show existing code
          if (onSuccess) {
            onSuccess();
          }
          return; // Don't throw error, just refresh
        }
        // Re-throw other errors
        throw apiError;
      }
    } catch (error: any) {
      console.error("[ReferralCode] Failed to create referral code:", error);
      // Handle user rejection
      if (error?.code === 4001 || error?.message?.includes("rejected")) {
        helperToast.error(t`Signature request was rejected`);
      } else {
        helperToast.error(error?.message || t`Failed to create referral code`);
      }
    } finally {
      setIsCreating(false);
    }
  }, [address, chainId, onSuccess, signTypedDataAsync]);

  return (
    <div className={cx("referral-create-btn-only", embedded && "referral-create-btn-only--embedded")}>
      <Button
        variant="primary-action"
        className="referral-create-btn-only__btn mx-auto w-full max-w-[400px]"
        onClick={handleCreate}
        disabled={isCreating}
      >
        {isCreating ? <Trans>Creating...</Trans> : <Trans>Create Referral Code</Trans>}
      </Button>
    </div>
  );
}

export default AddAffiliateCode;
