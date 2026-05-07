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
import once from "lodash/once";
import { http } from "viem";
import { arbitrum, arbitrumSepolia } from "viem/chains"; // 只保留 Arbitrum 相关链

import { isDevelopment } from "config/env";

import binanceWallet from "./connecters/binanceW3W/binanceWallet";

// Read WalletConnect Project ID from environment variable
// Get your project ID from: https://cloud.walletconnect.com/
const WALLET_CONNECT_PROJECT_ID = import.meta.env.VITE_WALLET_CONNECT_PROJECT_ID;

// Validate that the Project ID is configured
if (!WALLET_CONNECT_PROJECT_ID) {
  console.error(
    "[RainbowKit] VITE_WALLET_CONNECT_PROJECT_ID is not set in environment variables. " +
    "Please add it to your .env file. Get your project ID from https://cloud.walletconnect.com/"
  );
}

const APP_NAME = "Primit";

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

export const getRainbowKitConfig = once(() =>
  getDefaultConfig({
    appName: APP_NAME,
    projectId: WALLET_CONNECT_PROJECT_ID,
    chains: [
      arbitrum, // Arbitrum 主网
      ...(isDevelopment() ? [arbitrumSepolia] : []), // 开发环境包含测试网
    ],
    transports: {
      [arbitrum.id]: http(),
      [arbitrumSepolia.id]: http(),
    },
    wallets: [...popularWalletList, ...othersWalletList],
  })
);
