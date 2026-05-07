import { t } from "@lingui/macro";
/**
 * Referral Code Hooks
 *
 * 用于管理推荐码的创建、绑定和查询
 * 使用 EIP-712 类型化数据签名
 */
import { useState, useCallback } from "react";
import { useAccount, useSignTypedData } from "wagmi";

import { helperToast } from "lib/helperToast";

import {
  createReferralCode,
  bindReferralCode,
  claimReferralReward,
  getOnChainReferralDashboard,
  getClaimableReferralAmount,
  getNonce,
  isAuthenticated,
} from "./client";
import type {
  CreateReferralCodeResponse,
  BindReferralCodeResponse,
  ClaimReferralResponse,
  OnChainDashboardResponse,
  ClaimableResponse,
} from "../types";

interface EIP712Domain {
  name: string;
  version: string;
  chainId: number;
  verifyingContract: string;
}

function normalizeBindReferralErrorMessage(err: unknown): string {
  const rawMessage = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  const normalizedMessage = rawMessage.toLowerCase();

  if (
    rawMessage.includes("不能使用自己的推荐码") ||
    rawMessage.includes("不能使用自己的邀请码") ||
    normalizedMessage.includes("your own referral code") ||
    normalizedMessage.includes("your own invite code")
  ) {
    return t`You cannot use your own referral code.`;
  }

  if (
    rawMessage.includes("已绑定推荐码") ||
    rawMessage.includes("已经绑定推荐码") ||
    normalizedMessage.includes("already bound a referral code")
  ) {
    return t`You have already bound a referral code.`;
  }

  return rawMessage || t`Failed to bind referral code`;
}

/**
 * 构建创建推荐码的 EIP-712 类型化数据
 */
function buildCreateReferralTypedData(
  domain: EIP712Domain,
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

/**
 * 构建绑定推荐码的 EIP-712 类型化数据
 */
function buildBindReferralTypedData(
  domain: EIP712Domain,
  wallet: string,
  code: string,
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
      BindReferralCode: [
        { name: "wallet", type: "address" },
        { name: "code", type: "string" },
        { name: "timestamp", type: "uint256" },
      ],
    },
    primaryType: "BindReferralCode",
    domain: {
      name: domain.name,
      version: domain.version,
      chainId: domain.chainId,
      verifyingContract: domain.verifyingContract,
    },
    message: {
      wallet: wallet,
      code: code,
      timestamp: timestamp.toString(),
    },
  };
}

/**
 * 创建推荐码 Hook
 * 使用 EIP-712 类型化数据签名
 */
export function useCreateReferralCode() {
  const { address, chainId } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = useCallback(async (): Promise<CreateReferralCodeResponse | null> => {
    if (!address || !chainId) {
      setError("Wallet not connected");
      return null;
    }

    // Check JWT authentication before proceeding
    if (!isAuthenticated(address, chainId)) {
      setError("Please sign in first to create a referral code");
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. 获取 nonce 数据以获取 domain 配置
      const nonceData = await getNonce(chainId, address);
      if (!nonceData.typed_data?.domain) {
        throw new Error("Failed to get EIP-712 domain configuration");
      }

      // 2. 构建 EIP-712 类型化数据
      const timestamp = Math.floor(Date.now() / 1000);
      const domain = nonceData.typed_data.domain;
      const typedData = buildCreateReferralTypedData(domain, address, timestamp);

      // 3. 使用 wagmi signTypedDataAsync 签名
      const signature = await signTypedDataAsync({
        domain: typedData.domain as any,
        types: typedData.types as any,
        primaryType: typedData.primaryType as any,
        message: typedData.message as any,
      });

      // 4. 调用创建推荐码 API
      const response = await createReferralCode(chainId, {
        signature,
        timestamp,
      });

      helperToast.success(t`Referral code created successfully!`);
      return response;
    } catch (err: any) {
      const errorMessage = err?.message || "Failed to create referral code";
      setError(errorMessage);
      helperToast.error(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, [address, chainId, signTypedDataAsync]);

  return { create, loading, error };
}

/**
 * 绑定推荐码 Hook
 * 使用 EIP-712 类型化数据签名
 */
export function useBindReferralCode() {
  const { address, chainId } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bind = useCallback(
    async (code: string): Promise<BindReferralCodeResponse | null> => {
      if (!address || !chainId) {
        setError("Wallet not connected");
        return null;
      }

      if (!code || code.trim().length === 0) {
        setError("Referral code is required");
        return null;
      }

      // Check JWT authentication before proceeding
      if (!isAuthenticated(address, chainId)) {
        setError("Please sign in first to bind a referral code");
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        const normalizedCode = code.toUpperCase().trim();

        // 1. 获取 nonce 数据以获取 domain 配置
        const nonceData = await getNonce(chainId, address);
        if (!nonceData.typed_data?.domain) {
          throw new Error("Failed to get EIP-712 domain configuration");
        }

        // 2. 构建 EIP-712 类型化数据
        const timestamp = Math.floor(Date.now() / 1000);
        const domain = nonceData.typed_data.domain;
        const typedData = buildBindReferralTypedData(domain, address, normalizedCode, timestamp);

        // 3. 使用 wagmi signTypedDataAsync 签名
        const signature = await signTypedDataAsync({
          domain: typedData.domain as any,
          types: typedData.types as any,
          primaryType: typedData.primaryType as any,
          message: typedData.message as any,
        });

        // 4. 调用绑定推荐码 API
        const response = await bindReferralCode(chainId, {
          code: normalizedCode,
          signature,
          timestamp,
        });

        helperToast.success(t`Referral code bound successfully!`);
        return response;
      } catch (err: any) {
        const errorMessage = normalizeBindReferralErrorMessage(err);
        setError(errorMessage);
        helperToast.error(errorMessage);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [address, chainId, signTypedDataAsync]
  );

  return { bind, loading, error };
}

/**
 * 领取推荐奖励 Hook
 */
export function useClaimReferralReward() {
  const { chainId, address } = useAccount();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const claim = useCallback(async (): Promise<ClaimReferralResponse | null> => {
    if (!chainId) {
      setError("Chain ID not available");
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await claimReferralReward(chainId, { address: address ?? undefined });
      helperToast.success(`Successfully claimed ${response.amount} USDT!`);
      return response;
    } catch (err: any) {
      const errorMessage = err?.message || "Failed to claim referral reward";
      setError(errorMessage);
      helperToast.error(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, [chainId, address]);

  return { claim, loading, error };
}

/**
 * 获取推荐面板数据 Hook（`GET /referral/dashboard`，Bearer；映射为旧 OnChain 字段名）
 */
export function useOnChainReferralDashboard(address?: string) {
  const { chainId } = useAccount();
  const [data, setData] = useState<OnChainDashboardResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!chainId || !address) {
      setError("Chain ID or address not available");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await getOnChainReferralDashboard(chainId, address);
      setData(response);
    } catch (err: any) {
      const errorMessage = err?.message || "Failed to fetch on-chain referral dashboard";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [chainId, address]);

  return { data, loading, error, fetch };
}

/**
 * 查询可领取金额 Hook（公开接口）
 */
export function useClaimableReferralAmount(address?: string) {
  const { chainId } = useAccount();
  const [data, setData] = useState<ClaimableResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!chainId || !address) {
      setError("Chain ID or address not available");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await getClaimableReferralAmount(chainId, address);
      setData(response);
    } catch (err: any) {
      const errorMessage = err?.message || "Failed to fetch claimable amount";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [chainId, address]);

  return { data, loading, error, fetch };
}
