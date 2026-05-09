import { ethers } from "ethers";
import sample from "lodash/sample";

import {
  AnyChainId,
  ARBITRUM_SEPOLIA,
  BOTANIX,
  ContractsChainId,
  CONTRACTS_CHAIN_IDS as SDK_CONTRACTS_CHAIN_IDS,
  CONTRACTS_CHAIN_IDS_DEV as SDK_CONTRACTS_CHAIN_IDS_DEV,
  SOURCE_BASE_MAINNET,
  SOURCE_BSC_MAINNET,
  SOURCE_OPTIMISM_SEPOLIA,
  SOURCE_SEPOLIA,
} from "sdk/configs/chains";

import { isDevelopment } from "./env";
import { ARBITRUM, AVALANCHE, AVALANCHE_FUJI, ETH_MAINNET } from "./static/chains";

export { CHAIN_NAMES_MAP, getChainName } from "sdk/configs/chains";
export * from "./static/chains";

export const CONTRACTS_CHAIN_IDS = isDevelopment() ? SDK_CONTRACTS_CHAIN_IDS_DEV : SDK_CONTRACTS_CHAIN_IDS;

const { parseEther } = ethers;

export const ENV_ARBITRUM_RPC_URLS = import.meta.env.VITE_APP_ARBITRUM_RPC_URLS;
export const ENV_AVALANCHE_RPC_URLS = import.meta.env.VITE_APP_AVALANCHE_RPC_URLS;
export const ENV_BOTANIX_RPC_URLS = import.meta.env.VITE_APP_BOTANIX_RPC_URLS;

const FALLBACK_DEFAULT_CHAIN_ID: ContractsChainId = ARBITRUM_SEPOLIA;

function resolveDefaultChainId(): ContractsChainId {
  const raw = import.meta.env.VITE_DEFAULT_CHAIN;
  if (!raw) return FALLBACK_DEFAULT_CHAIN_ID;

  const parsed = Number(raw);
  if (!Number.isInteger(parsed)) return FALLBACK_DEFAULT_CHAIN_ID;

  return (CONTRACTS_CHAIN_IDS as readonly number[]).includes(parsed)
    ? (parsed as ContractsChainId)
    : FALLBACK_DEFAULT_CHAIN_ID;
}

export const DEFAULT_CHAIN_ID = resolveDefaultChainId();
export const CHAIN_ID = DEFAULT_CHAIN_ID;

export const IS_NETWORK_DISABLED: Record<ContractsChainId, boolean> = {
  [ARBITRUM]: false,
  [AVALANCHE]: true, // 禁用
  [ARBITRUM_SEPOLIA]: false,
  [AVALANCHE_FUJI]: true, // 禁用
  [BOTANIX]: true, // 禁用
};

export const NETWORK_EXECUTION_TO_CREATE_FEE_FACTOR = {
  [ARBITRUM]: 10n ** 29n * 5n,
  [AVALANCHE]: 10n ** 29n * 35n,
  [AVALANCHE_FUJI]: 10n ** 29n * 2n,
} as const;

const constants = {
  [ARBITRUM]: {
    nativeTokenSymbol: "ETH",
    wrappedTokenSymbol: "WETH",
    defaultCollateralSymbol: "USDC.e",
    defaultFlagOrdersEnabled: false,
    positionReaderPropsLength: 9,
    v2: true,

    SWAP_ORDER_EXECUTION_GAS_FEE: parseEther("0.0003"),
    INCREASE_ORDER_EXECUTION_GAS_FEE: parseEther("0.0003"),
    // contract requires that execution fee be strictly greater than instead of gte
    DECREASE_ORDER_EXECUTION_GAS_FEE: parseEther("0.000300001"),
  },

  [AVALANCHE]: {
    nativeTokenSymbol: "AVAX",
    wrappedTokenSymbol: "WAVAX",
    defaultCollateralSymbol: "USDC",
    defaultFlagOrdersEnabled: true,
    positionReaderPropsLength: 9,
    v2: true,

    SWAP_ORDER_EXECUTION_GAS_FEE: parseEther("0.01"),
    INCREASE_ORDER_EXECUTION_GAS_FEE: parseEther("0.01"),
    // contract requires that execution fee be strictly greater than instead of gte
    DECREASE_ORDER_EXECUTION_GAS_FEE: parseEther("0.0100001"),
  },

  [AVALANCHE_FUJI]: {
    nativeTokenSymbol: "AVAX",
    wrappedTokenSymbol: "WAVAX",
    defaultCollateralSymbol: "USDC",
    defaultFlagOrdersEnabled: true,
    positionReaderPropsLength: 9,
    v2: true,

    SWAP_ORDER_EXECUTION_GAS_FEE: parseEther("0.01"),
    INCREASE_ORDER_EXECUTION_GAS_FEE: parseEther("0.01"),
    // contract requires that execution fee be strictly greater than instead of gte
    DECREASE_ORDER_EXECUTION_GAS_FEE: parseEther("0.0100001"),
  },

  [ARBITRUM_SEPOLIA]: {
    nativeTokenSymbol: "ETH",
    wrappedTokenSymbol: "WETH",
    defaultCollateralSymbol: "USDC",
    defaultFlagOrdersEnabled: true,
    positionReaderPropsLength: 9,
    v2: true,

    SWAP_ORDER_EXECUTION_GAS_FEE: parseEther("0.01"),
    INCREASE_ORDER_EXECUTION_GAS_FEE: parseEther("0.01"),
    // contract requires that execution fee be strictly greater than instead of gte
    DECREASE_ORDER_EXECUTION_GAS_FEE: parseEther("0.0100001"),
  },
  [BOTANIX]: {
    nativeTokenSymbol: "BTC",
    wrappedTokenSymbol: "PBTC",
    defaultCollateralSymbol: "USDC.E",
    defaultFlagOrdersEnabled: true,
    positionReaderPropsLength: 9,
    v2: true,

    SWAP_ORDER_EXECUTION_GAS_FEE: parseEther("0.01"),
    INCREASE_ORDER_EXECUTION_GAS_FEE: parseEther("0.01"),
    // contract requires that execution fee be strictly greater than instead of gte
    DECREASE_ORDER_EXECUTION_GAS_FEE: parseEther("0.0100001"),
  },
} satisfies Record<ContractsChainId, Record<string, any>>;

const _ALCHEMY_WHITELISTED_DOMAINS = ["primit.io", "www.primit.io", "app.primit.io", "api.primit.io"];
const _PRIMIT_DOMAINS = ["primit.io", "www.primit.io", "app.primit.io", "api.primit.io"];

export const RPC_PROVIDERS: Record<number, string[]> = {
  [ETH_MAINNET]: ["https://rpc.ankr.com/eth"],
  [ARBITRUM]: [
    "https://arb1.arbitrum.io/rpc",
    "https://arbitrum-one-rpc.publicnode.com",
    // "https://1rpc.io/arb", has CORS issue
    "https://arbitrum-one.public.blastapi.io",
    // "https://arbitrum.drpc.org",
    // requires authentication
    // "https://rpc.ankr.com/arbitrum",
  ],
  [AVALANCHE]: [
    "https://api.avax.network/ext/bc/C/rpc",
    "https://avalanche-c-chain-rpc.publicnode.com",
    "https://1rpc.io/avax/c",
  ],
  [AVALANCHE_FUJI]: [
    "https://avalanche-fuji-c-chain.publicnode.com",
    "https://api.avax-test.network/ext/bc/C/rpc",
    // "https://ava-testnet.public.blastapi.io/v1/avax/fuji/public",
    // "https://rpc.ankr.com/avalanche_fuji",
  ],
  [ARBITRUM_SEPOLIA]: [
    "https://sepolia-rollup.arbitrum.io/rpc",
    "https://arbitrum-sepolia.drpc.org",
    "https://arbitrum-sepolia-rpc.publicnode.com",
  ],
  [SOURCE_BASE_MAINNET]: [
    "https://mainnet.base.org",
    "https://base.llamarpc.com",
    "https://base-rpc.publicnode.com",
    "https://base.drpc.org",
  ],
  [SOURCE_OPTIMISM_SEPOLIA]: [
    "https://sepolia.optimism.io",
    "https://optimism-sepolia.drpc.org",
    "https://optimism-sepolia.therpc.io",
  ],
  [SOURCE_SEPOLIA]: ["https://sepolia.drpc.org"],
  [BOTANIX]: [
    // returns incorrect gas price
    // "https://rpc.botanixlabs.com",
    "https://rpc.ankr.com/botanix_mainnet",
  ],
  [SOURCE_BSC_MAINNET]: [
    "https://bsc-dataseed.bnbchain.org",
    "https://1rpc.io/bnb",
    "https://bsc.drpc.org",
    "https://bsc-rpc.publicnode.com",
  ],
  97: [
    "https://data-seed-prebsc-1-s1.bnbchain.org:8545",
    "https://data-seed-prebsc-2-s1.bnbchain.org:8545",
    "https://bsc-testnet-rpc.publicnode.com",
  ],
};

export const FALLBACK_PROVIDERS: Record<number, string[]> = {
  [ARBITRUM]: ENV_ARBITRUM_RPC_URLS ? JSON.parse(ENV_ARBITRUM_RPC_URLS) : [getAlchemyArbitrumHttpUrl()],
  [AVALANCHE]: ENV_AVALANCHE_RPC_URLS ? JSON.parse(ENV_AVALANCHE_RPC_URLS) : [getAlchemyAvalancheHttpUrl()],
  [AVALANCHE_FUJI]: [
    "https://endpoints.omniatech.io/v1/avax/fuji/public",
    "https://api.avax-test.network/ext/bc/C/rpc",
    "https://ava-testnet.public.blastapi.io/ext/bc/C/rpc",
  ],
  [BOTANIX]: ENV_BOTANIX_RPC_URLS ? JSON.parse(ENV_BOTANIX_RPC_URLS) : [getAlchemyBotanixHttpUrl()],
  [ARBITRUM_SEPOLIA]: [
    "https://sepolia-rollup.arbitrum.io/rpc",
    "https://arbitrum-sepolia.drpc.org",
    "https://arbitrum-sepolia-rpc.publicnode.com",
  ],
  [SOURCE_BASE_MAINNET]: [getAlchemyBaseMainnetHttpUrl()],
  [SOURCE_OPTIMISM_SEPOLIA]: [getAlchemyOptimismSepoliaHttpUrl()],
  [SOURCE_SEPOLIA]: [getAlchemySepoliaHttpUrl()],
  [SOURCE_BSC_MAINNET]: [getAlchemyBscMainnetHttpUrl()],
  97: [
    "https://data-seed-prebsc-1-s1.bnbchain.org:8545",
    "https://data-seed-prebsc-2-s1.bnbchain.org:8545",
    "https://bsc-testnet-rpc.publicnode.com",
  ],
};

type ConstantName = keyof (typeof constants)[ContractsChainId];

export const getConstant = <T extends ContractsChainId, K extends ConstantName>(
  chainId: T,
  key: K
): (typeof constants)[T][K] => {
  if (!constants[chainId]) {
    throw new Error(`Unsupported chainId ${chainId}`);
  }

  if (!(key in constants[chainId])) {
    throw new Error(`Key ${key} does not exist for chainId ${chainId}`);
  }

  return constants[chainId][key];
};

export function getFallbackRpcUrl(chainId: number): string {
  const fallbackUrl = sample(FALLBACK_PROVIDERS[chainId]);
  if (!fallbackUrl) {
    throw new Error(`No fallback RPC provider configured for chainId: ${chainId}`);
  }
  return fallbackUrl;
}

function getAlchemyKey() {
  return import.meta.env.VITE_ALCHEMY_API_KEY ?? "";
}

export function getAlchemyArbitrumHttpUrl() {
  return `https://arb-mainnet.g.alchemy.com/v2/${getAlchemyKey()}`;
}

export function getAlchemyAvalancheHttpUrl() {
  return `https://avax-mainnet.g.alchemy.com/v2/${getAlchemyKey()}`;
}

export function getAlchemyArbitrumWsUrl() {
  return `wss://arb-mainnet.g.alchemy.com/v2/${getAlchemyKey()}`;
}

export function getAlchemyBotanixHttpUrl() {
  return `https://botanix-mainnet.g.alchemy.com/v2/${getAlchemyKey()}`;
}

export function getAlchemyBotanixWsUrl() {
  return `wss://botanix-mainnet.g.alchemy.com/v2/${getAlchemyKey()}`;
}

export function getAlchemyOptimismSepoliaHttpUrl() {
  return `https://opt-sepolia.g.alchemy.com/v2/${getAlchemyKey()}`;
}

export function getAlchemyOptimismSepoliaWsUrl() {
  return `wss://opt-sepolia.g.alchemy.com/v2/${getAlchemyKey()}`;
}

export function getAlchemyArbitrumSepoliaHttpUrl() {
  return `https://arb-sepolia.g.alchemy.com/v2/${getAlchemyKey()}`;
}

export function getAlchemyArbitrumSepoliaWsUrl() {
  return `wss://arb-sepolia.g.alchemy.com/v2/${getAlchemyKey()}`;
}

export function getAlchemyBaseMainnetHttpUrl() {
  return `https://base-mainnet.g.alchemy.com/v2/${getAlchemyKey()}`;
}

export function getAlchemyBaseMainnetWsUrl() {
  return `wss://base-mainnet.g.alchemy.com/v2/${getAlchemyKey()}`;
}

export function getAlchemyBscMainnetHttpUrl() {
  return `https://bnb-mainnet.g.alchemy.com/v2/${getAlchemyKey()}`;
}

export function getAlchemyBscMainnetWsUrl() {
  return `wss://bnb-mainnet.g.alchemy.com/v2/${getAlchemyKey()}`;
}

export function getAlchemySepoliaHttpUrl() {
  return `https://eth-sepolia.g.alchemy.com/v2/${getAlchemyKey()}`;
}

export function getAlchemySepoliaWsUrl() {
  return `wss://eth-sepolia.g.alchemy.com/v2/${getAlchemyKey()}`;
}

export function getExplorerUrl(chainId: number | "layerzero" | "layerzero-testnet"): string {
  switch (chainId as AnyChainId | "layerzero" | "layerzero-testnet") {
    case ARBITRUM:
      return "https://arbiscan.io/";
    case AVALANCHE:
      return "https://snowtrace.io/";
    case AVALANCHE_FUJI:
      return "https://testnet.snowtrace.io/";
    case ARBITRUM_SEPOLIA:
      return "https://sepolia.arbiscan.io/";
    case SOURCE_OPTIMISM_SEPOLIA:
      return "https://sepolia-optimism.etherscan.io/";
    case SOURCE_SEPOLIA:
      return "https://sepolia.etherscan.io/";
    case BOTANIX:
      return "https://botanixscan.io/";
    case SOURCE_BASE_MAINNET:
      return "https://basescan.org/";
    case SOURCE_BSC_MAINNET:
      return "https://bscscan.com/";
    case "layerzero":
      return "https://layerzeroscan.com/";
    case "layerzero-testnet":
      return "https://testnet.layerzeroscan.com/";
  }
}

export function getTokenExplorerUrl(chainId: number, tokenAddress: string) {
  return `${getExplorerUrl(chainId)}token/${tokenAddress}`;
}
