import { t } from "@lingui/macro";
import { useLingui } from "@lingui/react";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { useAccount } from "wagmi";

import { useChainId } from "lib/chains";
import { getOrderPreview } from "modules/lighter/api/custom/client";
import type { OrderPreviewData, OrderPreviewRequest } from "modules/lighter/api/types";
import { useTradeProduct, useTradeState } from "modules/lighter/store/TradeStateContext";
import { tradeProductSWRKey, type TradeProduct } from "@/modules/lighter/api/custom/productRouting";

export type PreviewInput = {
  side: "buy" | "sell";
  orderType: "market" | "limit";
  amount: number;
  leverage: number;
  marginMode?: "cross" | "isolated";
  reduceOnly?: boolean;
  price?: number;
  /** 防抖间隔(ms),默认 300。传 0 立即请求。*/
  debounceMs?: number;
};

export type PreviewState = {
  data: OrderPreviewData | null;
  loading: boolean;
  /** 原始错误信息(message / raw code),用于 DEBUG / 回退。*/
  error: string | null;
  /** 结构化错误码,命中后端枚举时给出,用于前端定向提示。*/
  errorCode: PreviewErrorCode | null;
};

/**
 * 后端 preview 语义化错误枚举。加字段时注意与后端保持同步 —— 枚举名未命中走通用 "Preview failed"。
 */
export type PreviewErrorCode =
  | "SLIPPAGE_EXCEEDED"
  | "REDUCE_ONLY_NO_POSITION"
  | "INSUFFICIENT_BALANCE"
  | "MARKET_CLOSED"
  | "LEVERAGE_TOO_HIGH"
  | "AMOUNT_TOO_SMALL"
  | "PRICE_OUT_OF_RANGE"
  | "NO_PRICE_AVAILABLE";

const EMPTY: PreviewState = { data: null, loading: false, error: null, errorCode: null };

function toAmountString(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0";
  return parseFloat(n.toFixed(8)).toString();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

/**
 * 后端在不同分支里会返回:
 *   (a) 结构化 code,如 error_code: "REDUCE_ONLY_NO_POSITION"
 *   (b) 直接一句人类可读的中文 / 英文错误字符串
 * 前端对两种都做识别,优先拿 code;没 code 就按已知关键词做正则匹配,把消息归一为 PreviewErrorCode。
 * 识别不到任何模式才放行原始错误字符串到 UI。
 */
const ERROR_PATTERNS: Array<{ code: PreviewErrorCode; regex: RegExp }> = [
  { code: "SLIPPAGE_EXCEEDED", regex: /slippage|滑点/i },
  { code: "REDUCE_ONLY_NO_POSITION", regex: /reduce.?only|对手方仓位|无对手仓位|无持仓|无可平仓位/i },
  { code: "INSUFFICIENT_BALANCE", regex: /insufficient (margin|balance|funds)|保证金不足|余额不足/i },
  { code: "MARKET_CLOSED", regex: /market (is )?closed|market.*paus|市场已关闭|已暂停交易/i },
  { code: "LEVERAGE_TOO_HIGH", regex: /leverage.*(exceed|too high|limit)|杠杆超过|杠杆过高/i },
  { code: "AMOUNT_TOO_SMALL", regex: /amount.*(min|too small|below)|minimum.*size|低于最小|小于最小|最小下单/i },
  { code: "PRICE_OUT_OF_RANGE", regex: /price.*(range|band|out of)|价格.*(范围|超出|偏离)/i },
  { code: "NO_PRICE_AVAILABLE", regex: /no price available|price.*unavailable|行情不可用|无可用价格|无价格/i },
];

function extractErrorCode(payload: unknown): PreviewErrorCode | null {
  const payloadRec = asRecord(payload);
  if (!payloadRec) return null;
  const candidates: string[] = [];
  const tryPush = (v: unknown) => {
    if (typeof v === "string" && v.length > 0) candidates.push(v);
  };
  tryPush(payloadRec.error_code);
  tryPush(payloadRec.code);
  const errorRec = asRecord(payloadRec.error);
  if (errorRec) {
    tryPush(errorRec.code);
    tryPush(errorRec.error_code);
    tryPush(errorRec.message);
  }
  // apiFetch 抛出的 Error 会把完整后端响应挂到 `.errorData` 上(见 lighter/api/custom/client.ts)
  const errorDataRec = asRecord(payloadRec.errorData);
  if (errorDataRec) {
    tryPush(errorDataRec.error_code);
    tryPush(errorDataRec.code);
    tryPush(errorDataRec.error);
    tryPush(errorDataRec.message);
  }
  tryPush(payloadRec.error);
  tryPush(payloadRec.message);
  // 先尝试精确匹配后端返回的 code 字段
  for (const c of candidates) {
    const up = c.toUpperCase().replace(/\s+/g, "_");
    if (
      up === "SLIPPAGE_EXCEEDED" ||
      up === "REDUCE_ONLY_NO_POSITION" ||
      up === "INSUFFICIENT_BALANCE" ||
      up === "MARKET_CLOSED" ||
      up === "LEVERAGE_TOO_HIGH" ||
      up === "AMOUNT_TOO_SMALL" ||
      up === "PRICE_OUT_OF_RANGE" ||
      up === "NO_PRICE_AVAILABLE"
    ) {
      return up as PreviewErrorCode;
    }
  }
  // 后端只返回自然语言时,按中英文关键词 fallback 归类
  for (const c of candidates) {
    for (const { code, regex } of ERROR_PATTERNS) {
      if (regex.test(c)) return code;
    }
  }
  return null;
}

/**
 * 将结构化错误码映射为用户友好文案。未命中返回 null,调用方回退原始 error string。
 */
export function usePreviewErrorMessage(state: Pick<PreviewState, "error" | "errorCode">): string | null {
  const { i18n } = useLingui();
  if (!state.error) return null;
  switch (state.errorCode) {
    case "SLIPPAGE_EXCEEDED":
      return i18n._(t`Slippage exceeds the allowed maximum. Raise your slippage tolerance or try a smaller size.`);
    case "REDUCE_ONLY_NO_POSITION":
      return i18n._(t`Reduce-only requires an open position on this market.`);
    case "INSUFFICIENT_BALANCE":
      return i18n._(t`Insufficient margin for this order.`);
    case "MARKET_CLOSED":
      return i18n._(t`This market is currently closed.`);
    case "LEVERAGE_TOO_HIGH":
      return i18n._(t`Selected leverage exceeds the market cap. Lower leverage and retry.`);
    case "AMOUNT_TOO_SMALL":
      return i18n._(t`Order amount is below the minimum size for this market.`);
    case "PRICE_OUT_OF_RANGE":
      return i18n._(t`Price is outside the acceptable band for this market.`);
    case "NO_PRICE_AVAILABLE":
      return i18n._(t`No live price available for this market right now. Please retry in a moment.`);
    default:
      return state.error || null;
  }
}

function buildSwrKey(
  product: TradeProduct,
  chainId: number | undefined,
  address: string | undefined,
  request: OrderPreviewRequest | null
): readonly unknown[] | null {
  if (!chainId || !request) return null;
  return tradeProductSWRKey(product, [
    "zanbara:order-preview",
    chainId,
    address ?? "anon",
    request.symbol,
    request.side,
    request.order_type,
    request.amount,
    request.leverage,
    request.margin_mode,
    request.reduce_only,
    request.price ?? "",
  ]);
}

/**
 * 调用 POST /api/v1/orders/preview 获取订单预估。
 *
 * 与旧版相比:
 * - 改走 SWR:相同 key 的请求被去重/共享,重挂组件能直接吃缓存。
 * - 输入仍走 debounce(默认 300ms),避免每次键入都打预览接口。
 * - 响应体错误保留原始文案(`error`),额外解析结构化错误码(`errorCode`),
 *   配合 `usePreviewErrorMessage` 给出语义化提示。
 */
export function useOrderPreviewAdapter(input: PreviewInput): PreviewState {
  const { chainId } = useChainId();
  const { address } = useAccount();
  const product = useTradeProduct();
  const { selectedSymbol } = useTradeState();

  const priceNeeded = input.orderType === "limit";
  const priceValid = !priceNeeded || (input.price != null && input.price > 0);
  const hasValidInput =
    Boolean(chainId) && Boolean(selectedSymbol) && Number.isFinite(input.amount) && input.amount > 0 && priceValid;

  const request: OrderPreviewRequest | null = hasValidInput
    ? {
        symbol: selectedSymbol!,
        side: input.side,
        order_type: input.orderType,
        amount: toAmountString(input.amount),
        leverage: input.leverage,
        margin_mode: input.marginMode ?? "cross",
        reduce_only: input.reduceOnly ?? false,
        ...(priceNeeded && input.price != null ? { price: toAmountString(input.price) } : {}),
      }
    : null;

  // 经过 debounce 的 key:只有当输入稳定 debounceMs 后才切换 SWR key,避免在输入过程中打满请求。
  const debounceMs = input.debounceMs ?? 300;
  const currentKey = buildSwrKey(product, chainId, address, request);
  const [debouncedKey, setDebouncedKey] = useState<readonly unknown[] | null>(currentKey);
  const currentKeyStr = currentKey ? JSON.stringify(currentKey) : null;
  const debouncedKeyStr = debouncedKey ? JSON.stringify(debouncedKey) : null;

  useEffect(() => {
    if (currentKeyStr === debouncedKeyStr) return;
    if (!currentKey) {
      setDebouncedKey(null);
      return;
    }
    const timer = setTimeout(() => setDebouncedKey(currentKey), debounceMs);
    return () => clearTimeout(timer);
  }, [currentKey, currentKeyStr, debouncedKey, debouncedKeyStr, debounceMs]);

  const { data, error, isValidating } = useSWR(
    debouncedKey,
    async () => {
      if (!chainId || !request) return null;
      return getOrderPreview(chainId, request, address, product);
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      keepPreviousData: true,
      dedupingInterval: 250,
    }
  );

  if (!hasValidInput) {
    return EMPTY;
  }

  if (error) {
    return {
      data: null,
      loading: false,
      error: error instanceof Error ? error.message : String(error),
      errorCode: extractErrorCode(error),
    };
  }

  // 兼容两种响应形态:
  // 1) 文档版:{ success, data, error, timestamp }
  // 2) 实际版:扁平 OrderPreviewData 对象
  const raw = data as unknown;
  const rawRec = asRecord(raw);
  const payload: OrderPreviewData | null =
    rawRec && "order_size" in rawRec
      ? (rawRec as unknown as OrderPreviewData)
      : (asRecord(rawRec?.data) as unknown as OrderPreviewData | null) ?? null;
  if (payload) {
    return { data: payload, loading: false, error: null, errorCode: null };
  }

  if (raw == null) {
    return { data: null, loading: isValidating, error: null, errorCode: null };
  }

  const rawErr = rawRec?.error;
  const errStr =
    typeof rawErr === "string"
      ? rawErr
      : asRecord(rawErr)?.message != null
        ? String(asRecord(rawErr)?.message)
        : "Preview failed";
  return { data: null, loading: false, error: errStr, errorCode: extractErrorCode(raw) };
}
