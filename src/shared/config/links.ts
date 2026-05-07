import { ARBITRUM, AVALANCHE } from "config/chains";
import { TOKENS_BY_SYMBOL_MAP } from "sdk/configs/tokens";

/** 生产环境营销站根（分享链接、SEO canonical、OG 等） */
export const PRODUCTION_HOST = "https://ztdx.io";

/** 交易 SPA 生产部署源站（品牌链接 / cross-origin nav 用） */
const rawAppOrigin =
  (import.meta.env.VITE_ZTDX_APP_ORIGIN as string | undefined) ??
  (import.meta.env.VITE_PRIMIT_APP_ORIGIN as string | undefined);
export const PRODUCTION_APP_ORIGIN = (rawAppOrigin?.trim() || "https://app.ztdx.io").replace(/\/$/, "");

/**
 * 顶栏品牌 Logo 目标：在「交易应用」源站（与 `PRODUCTION_APP_ORIGIN` 同 origin）时回到营销站根；
 * 其余情况（营销站、本地）保持站内 `/`。
 */
export function getPrimitBrandLinkHref(): "/" | string {
  if (typeof window === "undefined") return "/";
  try {
    if (window.location.origin === PRODUCTION_APP_ORIGIN) {
      return `${PRODUCTION_HOST.replace(/\/$/, "")}/`;
    }
  } catch (_error) {
    // ignore
  }
  return "/";
}

const oneInchTokensMap = {
  [ARBITRUM]: {
    BTC: "WBTC",
  },
  [AVALANCHE]: {
    BTC: "BTC.b",
    ETH: "WETH.e",
    WBTC: "WBTC.e",
  },
};

export function get1InchSwapUrl(chainId: number, from?: string, to?: string) {
  const rootUrl = `https://app.1inch.io/#/${chainId}/simple/swap`;
  const chainTokensMap = TOKENS_BY_SYMBOL_MAP[chainId];
  const isInvalidInput = !from || !to || !chainTokensMap[from] || !chainTokensMap[to];
  if (isInvalidInput) {
    return rootUrl;
  }
  const fromToken = oneInchTokensMap[chainId]?.[from] || from;
  const toToken = oneInchTokensMap[chainId]?.[to] || to;
  return `${rootUrl}/${fromToken}/${toToken}`;
}

export function get1InchSwapUrlFromAddresses(chainId: number, fromAddress?: string, toAddress?: string) {
  const addressesStr = [fromAddress, toAddress].filter(Boolean).join("/");
  return `https://app.1inch.io/#/${chainId}/simple/swap/${addressesStr}`;
}

export function getLeaderboardLink(chainId) {
  if (chainId === ARBITRUM) {
    return `${PRODUCTION_APP_ORIGIN}/leaderboard`;
  }
  if (chainId === AVALANCHE) {
    return `${PRODUCTION_APP_ORIGIN}/leaderboard`;
  }
  return `${PRODUCTION_APP_ORIGIN}/leaderboard`;
}

export const DOCS_LINKS = {
  // DOCS_LINK_COMMENTED: "#"
  multiplierPoints: "#",
  // DOCS_LINK_COMMENTED: "#"
  fundingFees: "#",
  // DOCS_LINK_COMMENTED: "#"
  adaptiveFunding: "#",
  // DOCS_LINK_COMMENTED: "#"
  borrowingFees: "#",
  // DOCS_LINK_COMMENTED: "#"
  priceImpact: "#",
};

export const ARBITRUM_INCENTIVES_V2_URL = `${PRODUCTION_APP_ORIGIN}/points`;
export const AVALANCHE_INCENTIVES_V2_URL = `${PRODUCTION_APP_ORIGIN}/points`;

export function getIncentivesV2Url(chainId: number): string {
  if (chainId === ARBITRUM) {
    return ARBITRUM_INCENTIVES_V2_URL;
  }

  if (chainId === AVALANCHE) {
    return AVALANCHE_INCENTIVES_V2_URL;
  }

  return ARBITRUM_INCENTIVES_V2_URL;
}
