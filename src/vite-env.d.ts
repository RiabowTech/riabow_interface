/// <reference types="vite-plugin-svgr/client" />
/// <reference types="vite/client" />

interface ImportMetaEnv {
  // WalletConnect Configuration
  readonly VITE_WALLET_CONNECT_PROJECT_ID: string;

  // Backend API URLs
  readonly VITE_PROXY_API_URL: string;
  readonly VITE_PROXY_WS_URL: string;
  readonly VITE_BACKEND_URL: string;

  // Feature Flags
  readonly VITE_USE_API_POSITIONS: string;
  readonly VITE_USE_API_ORDERS: string;
  readonly VITE_USE_API_ORDER_SUBMIT: string;

  // App Configuration
  readonly VITE_APP_IS_HOME_SITE: string;
  readonly VITE_IS_HOME_SITE: string;
  readonly VITE_APP_VERSION: string;
  readonly VITE_APP_UI_FEE_RECEIVER: string;

  // Default chain ID (numeric, e.g. "421614" for Arbitrum Sepolia)
  // Falls back to ARBITRUM_SEPOLIA when unset or invalid.
  readonly VITE_DEFAULT_CHAIN: string;

  // RPC URLs
  readonly VITE_APP_ARBITRUM_RPC_URLS: string;
  readonly VITE_APP_AVALANCHE_RPC_URLS: string;
  readonly VITE_APP_BOTANIX_RPC_URLS: string;

  // Alchemy Configuration
  readonly VITE_ALCHEMY_API_KEY: string;

  // Sentry
  readonly VITE_SENTRY_DSN: string;

  // Git Info
  readonly VITE_GIT_COMMIT_HASH: string;

  // Primit proxy contracts (per-chain env override; falls back to hardcoded
  // mainnet addresses in src/shared/config/custom/contracts.ts when unset).
  readonly VITE_PRIMIT_VAULT_PROXY: string;
  readonly VITE_PRIMIT_REBATE_PROXY: string;
  readonly VITE_PRIMIT_EARN_PROXY: string;
  readonly VITE_PRIMIT_APP_ORIGIN: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
