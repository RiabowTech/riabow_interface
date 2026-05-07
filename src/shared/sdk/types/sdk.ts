import type { PublicClient, WalletClient } from "viem";

import type { ContractsChainId } from "sdk/configs/chains";

import type { MarketSdkConfig } from "./markets";
import type { Token } from "./tokens";

export interface TradingSdkConfig {
  /** Chain ID */
  chainId: ContractsChainId;
  /** Account's address */
  account?: string;
  /** Oracle URL */
  oracleUrl: string;
  /** Blockhain RPC URL */
  rpcUrl: string;
  /** Subsquid URL */
  subsquidUrl: string;

  /** Custom viem's public and private client */
  publicClient?: PublicClient;
  walletClient?: WalletClient;

  /** Tokens override configurations */
  tokens?: Record<string, Partial<Token>>;
  /** Markets override configurations */
  markets?: Record<string, Partial<MarketSdkConfig>>;

  settings?: {
    uiFeeReceiverAccount?: string;
  };
}
