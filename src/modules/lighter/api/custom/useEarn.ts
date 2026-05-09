/**
 * Earn Hooks
 *
 * 理财服务数据获取 hooks
 */
import useSWR from "swr";
import { useState, useCallback } from "react";
import { useAccount } from "wagmi";

import type { ContractsChainId } from "config/chains";
import {
  getEarnProducts,
  getEarnPerformance,
  getEarnSubscriptions,
  prepareEarnSubscribe,
  isAuthenticated,
} from "./client";
import { useAuthToken } from "./useAuthToken";
import type {
  EarnProduct,
  EarnPerformance,
  EarnSubscription,
  EarnSubscribePrepareResponse,
} from "../types";

/**
 * 获取理财产品列表
 */
export function useEarnProducts(
  chainId: ContractsChainId | undefined,
  params?: { status?: string; page?: number; page_size?: number }
) {
  const { data, error, isLoading, mutate } = useSWR(
    chainId ? ["earn-products", chainId, params] : null,
    async () => {
      try {
        if (!chainId) throw new Error("Chain ID is required");
        return getEarnProducts(chainId, params);
      } catch (error) {
        console.error("[useEarnProducts] Error fetching products:", error);
        throw error;
      }
    },
    {
      revalidateOnFocus: false,
      refreshInterval: 10000, // Refresh every 10 seconds
      shouldRetryOnError: false,
      onError: (err) => {
        console.error("[useEarnProducts] SWR error:", err);
      },
    }
  );

  return {
    products: Array.isArray(data?.products) ? data.products : [],
    total: typeof data?.total === "number" ? data.total : 0,
    isLoading,
    error,
    mutate,
  };
}

/**
 * 获取历史表现数据
 */
export function useEarnPerformance(
  chainId: ContractsChainId | undefined,
  limit?: number
) {
  const { data, error, isLoading, mutate } = useSWR(
    chainId ? ["earn-performance", chainId, limit] : null,
    async () => {
      try {
        if (!chainId) throw new Error("Chain ID is required");
        return getEarnPerformance(chainId, limit);
      } catch (error) {
        console.error("[useEarnPerformance] Error fetching performance:", error);
        throw error;
      }
    },
    {
      revalidateOnFocus: false,
      refreshInterval: 60000, // Refresh every minute
      shouldRetryOnError: false,
      onError: (err) => {
        console.error("[useEarnPerformance] SWR error:", err);
      },
    }
  );

  return {
    performances: Array.isArray(data?.performances) ? data.performances : [],
    isLoading,
    error,
    mutate,
  };
}

/**
 * 获取用户申购列表 (需要认证)
 */
export function useEarnSubscriptions(chainId: ContractsChainId | undefined) {
  const { address } = useAccount();
  const { token } = useAuthToken(chainId);
  const enabled = Boolean(chainId && token && address);

  // Debug: Log authentication state

  const { data, error, isLoading, mutate } = useSWR(
    enabled ? ["earn-subscriptions", chainId, address, token] : null,
    async () => {
      try {
        if (!chainId) throw new Error("Chain ID is required");
        return getEarnSubscriptions(chainId, address);
      } catch (error) {
        console.error("[useEarnSubscriptions] Error fetching subscriptions:", error);
        throw error;
      }
    },
    {
      revalidateOnFocus: false,
      refreshInterval: 30000,
      shouldRetryOnError: false,
      onError: (err) => {
        console.error("[useEarnSubscriptions] SWR error:", err);
      },
    }
  );

  return {
    subscriptions: Array.isArray(data?.subscriptions) ? data.subscriptions : [],
    isLoading,
    error,
    mutate,
  };
}

/**
 * 申购准备 Hook - 获取后端签名
 */
export function usePrepareEarnSubscribe(chainId: ContractsChainId | undefined) {
  const { address } = useAccount();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const prepare = useCallback(
    async (
      productId: string,
      amount: string
    ): Promise<EarnSubscribePrepareResponse | null> => {
      if (!chainId) {
        setError("Chain ID is required");
        return null;
      }

      // Check JWT authentication before proceeding
      if (!isAuthenticated(address, chainId)) {
        setError("Please sign in first to subscribe to earn products");
        return null;
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await prepareEarnSubscribe(chainId, {
          product_id: productId,
          amount,
        }, address);
        return response;
      } catch (err: unknown) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to prepare subscription";
        setError(errorMessage);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [chainId, address]
  );

  return { prepare, isLoading, error };
}

/**
 * USDT decimals (6 for USDT)
 */
const USDT_DECIMALS = 6;

/**
 * 将最小单位金额转换为人类可读格式
 * @param amount 最小单位金额 (如 "10000000.00" 表示 10 USDT)
 * @returns 人类可读金额 (如 "10")
 */
function formatUsdtAmount(amount: string): string {
  const num = parseFloat(amount);
  if (isNaN(num)) return "0";
  return (num / Math.pow(10, USDT_DECIMALS)).toString();
}

/**
 * 将 API 产品数据转换为 UI 需要的格式
 *
 * Backend status values:
 * - created: 产品已创建，等待开放申购
 * - subscribing: 申购期，用户可以申购
 * - active: 申购结束，产品运行中（锁仓期）
 * - settled: 已结算，用户可领取本息
 * - cancelled: 已取消（紧急情况）
 */
export function mapProductToStrategy(product: EarnProduct) {
  // 解析 ISO 8601 日期字符串为毫秒时间戳
  const parseIsoDate = (isoString: string): number => {
    return new Date(isoString).getTime();
  };

  // 计算结束时间（用于倒计时显示）
  let endTime: number | undefined;
  if (product.status === "subscribing") {
    // 申购中：显示申购结束倒计时
    endTime = parseIsoDate(product.subscribe_end_time);
  } else if (product.status === "active") {
    // 运行中：显示结算倒计时
    endTime = parseIsoDate(product.settle_time);
  }

  // 格式化 ISO 日期字符串为 UI 显示格式
  const formatIsoDate = (isoString: string) => {
    const date = new Date(isoString);
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    const hours = String(date.getUTCHours()).padStart(2, "0");
    const minutes = String(date.getUTCMinutes()).padStart(2, "0");
    return `${year}${month}${day} ${hours}:${minutes}`;
  };

  const subscriptionPeriod = `${formatIsoDate(product.subscribe_start_time)}-${formatIsoDate(product.subscribe_end_time)}`;

  return {
    id: product.id,
    chainProductId: product.chain_product_id,
    name: product.name.split(" ").slice(0, 2).join(" ") || "Zanbara Strategy", // Extract base name
    term: product.name.split(" ").slice(2).join(" ") || "", // Extract term part
    token: "USDT",
    totalQuota: formatUsdtAmount(product.total_quota),
    remainingQuota: formatUsdtAmount(product.available_quota),
    estimatedAPR: product.annual_rate.replace("%", ""),
    subscriptionPeriod,
    apr: parseFloat(product.annual_rate.replace("%", "")),
    participatingAddresses: product.subscriber_count,
    contractAddress: "", // Will be filled from domain or config
    status: product.status, // Use backend status directly
    endTime,
    minAmount: formatUsdtAmount(product.min_amount),
    maxAmount: formatUsdtAmount(product.max_amount_per_user),
    durationDays: Math.ceil(product.duration_seconds / 86400), // Convert seconds to days (86400 = 60 * 60 * 24)
    periodRate: product.period_rate,
  };
}

/**
 * 将 API 申购数据转换为 UI 需要的格式
 */
export function mapSubscriptionToUI(subscription: EarnSubscription) {
  // 格式化 ISO 日期字符串为 UI 显示格式
  const formatIsoDate = (isoString: string) => {
    const date = new Date(isoString);
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    const hours = String(date.getUTCHours()).padStart(2, "0");
    const minutes = String(date.getUTCMinutes()).padStart(2, "0");
    return `${year}${month}${day} ${hours}:${minutes}`;
  };

  return {
    id: subscription.id,
    productId: subscription.product_id,
    chainProductId: subscription.chain_product_id,
    productName: subscription.product_name,
    subscriptionAmount: `${formatUsdtAmount(subscription.amount)} USDT`,
    estimatedInterest: `${formatUsdtAmount(subscription.expected_return)} USDT`, // API 返回 expected_return
    periodRate: subscription.period_rate,
    maturingDate: formatIsoDate(subscription.settle_time),
    nftStatus: subscription.nft_status,
    claimed: subscription.claimed,
    settledAt: subscription.settled_at,
  };
}
