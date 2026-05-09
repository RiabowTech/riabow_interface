/**
 * Trading deposit API
 *
 * Deposit API for the exchange trading mode
 */

import type {
  PrepareDepositRequest,
  PrepareDepositResponse,
  DepositRecord,
} from "../types";

import { getStoredToken } from "./client";
// 使用统一的后端 URL 配置
import { tradeProductApiBaseUrl, tradeProductApiPath, type TradeProduct } from "./productRouting";
import { helperToast } from "lib/helperToast";
import type { ApiError } from "../types";

interface FetchOptions extends RequestInit {
  requireAuth?: boolean;
  product?: TradeProduct;
}

async function apiFetch<T>(
  chainId: number,
  path: string,
  options: FetchOptions = {}
): Promise<T> {
  const baseUrl = tradeProductApiBaseUrl(chainId, options.product);
  const resolvedPath = options.product ? tradeProductApiPath(options.product, path) : path;
  const url = `${baseUrl}/api/v1${resolvedPath}`;

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (options.requireAuth) {
    const token = getStoredToken(null, chainId);
    if (!token) {
      throw new Error(" Authentication required");
    }
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      let errorData: ApiError;
      try {
        errorData = await response.json();
      } catch (e) {
        errorData = {
          error: "request_failed",
          message: `Request failed with status ${response.status}`,
        };
      }

      // Add  prefix for all errors
      errorData.message = ` ${errorData.message || errorData.error || "Request failed"}`;
      helperToast.error("API request failed");

      throw errorData;
    }

    return response.json();
  } catch (error) {
    // Handle network errors and other exceptions
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    helperToast.error(errorMessage);
    throw error;
  }
}

export interface DepositHistoryResponse {
  deposits: DepositRecord[];
}

/**
 * Prepare deposit - get contract call parameters
 */
export async function prepareDeposit(
  chainId: number,
  request: PrepareDepositRequest
): Promise<PrepareDepositResponse> {
  return apiFetch<PrepareDepositResponse>(chainId, "/deposit/prepare", {
    method: "POST",
    body: JSON.stringify(request),
    requireAuth: true,
  });
}

/**
 * Get deposit history
 */
export async function getDepositHistory(chainId: number, product?: TradeProduct): Promise<DepositHistoryResponse> {
  return apiFetch<DepositHistoryResponse>(chainId, "/deposit/history", {
    method: "GET",
    requireAuth: true,
    product,
  });
}
