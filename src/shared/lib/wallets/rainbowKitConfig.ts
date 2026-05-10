import { Chain, getDefaultConfig, WalletList } from "@rainbow-me/rainbowkit";
import {
  coinbaseWallet,
  coreWallet,
  injectedWallet,
  metaMaskWallet,
  okxWallet,
  rabbyWallet,
  safeWallet,
  trustWallet,
  walletConnectWallet,
  geminiWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { http } from "viem";
import { arbitrum, arbitrumSepolia, bscTestnet } from "viem/chains";

import { isDevelopment } from "config/env";

import binanceWallet from "./connecters/binanceW3W/binanceWallet";

// Read WalletConnect Project ID from environment variable
// Get your project ID from: https://cloud.walletconnect.com/
const WALLET_CONNECT_PROJECT_ID =
  import.meta.env.VITE_WALLET_CONNECT_PROJECT_ID || "your_walletconnect_project_id_here";

// Validate that the Project ID is configured
if (!import.meta.env.VITE_WALLET_CONNECT_PROJECT_ID) {
  console.error(
    "[RainbowKit] VITE_WALLET_CONNECT_PROJECT_ID is not set in environment variables. " +
    "Please add it to your .env file. Get your project ID from https://cloud.walletconnect.com/"
  );
}

const APP_NAME = "Zanbara";
const DEFAULT_WALLET_CHAIN_ID = Number(import.meta.env.VITE_DEFAULT_CHAIN);
const ENABLE_ARBITRUM_SEPOLIA = isDevelopment() || DEFAULT_WALLET_CHAIN_ID === arbitrumSepolia.id;
const ENABLE_BSC_TESTNET = Number(import.meta.env.VITE_DEFAULT_SPOT_CHAIN) === bscTestnet.id;

const popularWalletList: WalletList = [
  {
    // Group name with standard name is localized by rainbow kit
    groupName: "Popular",
    wallets: [
      rabbyWallet,
      metaMaskWallet,
      walletConnectWallet,
      // This wallet will automatically hide itself from the list when the fallback is not necessary or if there is no injected wallet available.
      injectedWallet,
      // The Safe option will only appear in the Safe Wallet browser environment.
      safeWallet,
      geminiWallet,
    ],
  },
];

const othersWalletList: WalletList = [
  {
    groupName: "Others",
    wallets: [binanceWallet, coinbaseWallet, trustWallet, coreWallet, okxWallet],
  },
];

type RainbowKitConfig = ReturnType<typeof getDefaultConfig>;

let rainbowKitConfig: RainbowKitConfig | undefined;

export function getRainbowKitConfig(): RainbowKitConfig {
  if (rainbowKitConfig) {
    return rainbowKitConfig;
  }

  const nextConfig = getDefaultConfig({
    appName: APP_NAME,
    projectId: WALLET_CONNECT_PROJECT_ID,
    chains: [
      arbitrum, // Arbitrum 主网
      ...(ENABLE_ARBITRUM_SEPOLIA ? [arbitrumSepolia] : []),
      ...(ENABLE_BSC_TESTNET ? [bscTestnet] : []),
    ],
    transports: {
      [arbitrum.id]: http(),
      [arbitrumSepolia.id]: http(),
      [bscTestnet.id]: http(),
    },
    wallets: [...popularWalletList, ...othersWalletList],
  });

  rainbowKitConfig = nextConfig;
  return nextConfig;
}
