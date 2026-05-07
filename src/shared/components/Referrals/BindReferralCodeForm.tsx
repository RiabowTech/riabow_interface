/**
 * Bind Referral Code Form Component
 *
 * 使用新的 API 绑定推荐码，不需要前端验证邀请码是否存在
 * 支持：
 * 1. 从 localStorage 自动填入邀请码（通过 URL 访问时自动存储）
 * 2. 粘贴 URL 时自动提取邀请码
 * 3. 已绑定邀请码时显示绑定状态
 */
import { Trans, t } from "@lingui/macro";
import { useState, useRef, useEffect } from "react";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { Hash } from "viem";

import { useBindReferralCode } from "@/modules/lighter/api/custom/useReferralCode";
import { BoundReferral } from "@/modules/lighter/api/types";
import { REFERRAL_CODE_KEY } from "config/localStorage";
import { decodeReferralCode } from "sdk/utils/referrals";

import Button from "components/Button/Button";

interface BindReferralCodeFormProps {
  active: boolean;
  onSuccess?: () => void;
  boundReferral?: BoundReferral | null;
}

/**
 * 从输入值中提取邀请码
 * 支持：
 * - 完整 URL: https://primit.io/trade/?ref=AB6B91C1
 * - 纯邀请码: AB6B91C1
 */
function extractReferralCode(input: string): string {
  const trimmedInput = input.trim();
  const lowerInput = trimmedInput.toLowerCase();

  // 检查是否是 URL 格式（大小写不敏感）
  if (lowerInput.includes("ref=")) {
    // 使用正则提取（大小写不敏感）
    const match = trimmedInput.match(/[?&]ref=([^&\s]+)/i);
    if (match && match[1]) {
      return match[1].toUpperCase();
    }
  }

  // 返回原始输入（转大写）
  return trimmedInput.toUpperCase();
}

/**
 * 从 localStorage 读取并解码邀请码
 */
function getStoredReferralCode(): string {
  try {
    const storedCode = localStorage.getItem(REFERRAL_CODE_KEY);
    if (storedCode && storedCode.length > 0 && storedCode !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
      const decoded = decodeReferralCode(storedCode as Hash);
      return decoded || "";
    }
  } catch {
    // Ignore errors
  }
  return "";
}

export function BindReferralCodeForm({ active, onSuccess, boundReferral }: BindReferralCodeFormProps) {
  const { openConnectModal } = useConnectModal();
  const { bind, loading, error } = useBindReferralCode();
  const [referralCode, setReferralCode] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const hasInitialized = useRef(false);

  // 判断是否已绑定
  const isBound = Boolean(boundReferral?.code);

  // 初始化时从 localStorage 读取邀请码（仅当未绑定时）
  useEffect(() => {
    if (!hasInitialized.current && !isBound) {
      hasInitialized.current = true;
      const storedCode = getStoredReferralCode();
      if (storedCode) {
        setReferralCode(storedCode);
      }
    }
  }, [isBound]);

  useEffect(() => {
    if (!isBound) {
      inputRef.current?.focus();
    }
  }, [isBound]);

  const trimmedCode = referralCode.trim();
  const isValid = trimmedCode.length > 0;

  const handleInputChange = (value: string) => {
    // 提取邀请码（支持 URL 粘贴）
    const extractedCode = extractReferralCode(value);
    setReferralCode(extractedCode);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isValid || loading || isBound) return;

    const result = await bind(referralCode);
    if (result && onSuccess) {
      onSuccess();
      setReferralCode("");
    }
  };

  if (!active) {
    return (
      <div className="referral-card section-center">
        <h2 className="title text-h2">
          <Trans>Enter referral code</Trans>
        </h2>
        <p className="sub-title">
          <Trans>Please input a referral code to benefit from fee discounts.</Trans>
        </p>
        <div className="card-action">
          <Button variant="primary-action" className="w-full max-w-[400px] mx-auto" type="submit" onClick={openConnectModal}>
            <Trans>Connect Wallet</Trans>
          </Button>
        </div>
      </div>
    );
  }

  // 已绑定状态
  if (isBound) {
    return (
      <div className="referral-card section-center">
        <h2 className="title text-h2">
          <Trans>Referral Code Bound</Trans>
        </h2>
        <p className="sub-title">
          <Trans>You have already bound a referral code.</Trans>
        </p>
        <div className="card-action">
          <div className="flex flex-col gap-15 max-w-[400px] mx-auto">
            <input
              disabled
              type="text"
              className="text-input w-full"
              value={boundReferral?.code || ""}
            />
            <Button
              variant="primary-action"
              type="button"
              className="App-cta Exchange-swap-button w-full max-w-[400px] mx-auto"
              disabled
            >
              <Trans>Already Bound</Trans>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="referral-card section-center">
      <h2 className="title text-h2">
        <Trans>Enter referral code</Trans>
      </h2>
      <p className="sub-title">
        <Trans>Please input a referral code to benefit from fee discounts.</Trans>
      </p>
      <div className="card-action">
        <form onSubmit={handleSubmit} className="flex flex-col gap-15 max-w-[400px] mx-auto">
          <input
            ref={inputRef}
            disabled={loading}
            type="text"
            placeholder={t`Enter referral code`}
            className="text-input w-full"
            value={referralCode}
            onChange={({ target }) => handleInputChange(target.value)}
          />
          {error && (
            <p className="text-red-500 text-14">{error}</p>
          )}
          <Button
            variant="primary-action"
            type="submit"
            className="App-cta Exchange-swap-button w-full max-w-[400px] mx-auto"
            disabled={!isValid || loading}
          >
            {loading ? <Trans>Binding...</Trans> : <Trans>Submit</Trans>}
          </Button>
        </form>
      </div>
    </div>
  );
}
