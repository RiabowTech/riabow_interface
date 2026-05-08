/**
 * Trading Contract Addresses
 *
 * Contract addresses specific to API trading mode and API adapters
 */

import { ARBITRUM, ARBITRUM_SEPOLIA } from "../chains";

/**
 * ZTDX 代理合约地址从 .env 覆盖,便于部署/灰度切换而不改代码:
 *   VITE_ZTDX_VAULT_PROXY  → ZTDX_VAULT
 *   VITE_ZTDX_REBATE_PROXY → REFERRAL_REBATE
 *   VITE_ZTDX_EARN_PROXY   → EARN
 *   VITE_ZTDX_USDT         → USDT
 * 没配置时回退到 0x0000…0000 占位地址 (部署时通过 .env 填充实际地址).
 */
const ZTDX_VAULT_PROXY =
  (import.meta.env.VITE_ZTDX_VAULT_PROXY as string | undefined) || "0x0000000000000000000000000000000000000000";
const ZTDX_REBATE_PROXY =
  (import.meta.env.VITE_ZTDX_REBATE_PROXY as string | undefined) || "0x0000000000000000000000000000000000000000";
const ZTDX_EARN_PROXY =
  (import.meta.env.VITE_ZTDX_EARN_PROXY as string | undefined) || "0x0000000000000000000000000000000000000000";
const ZTDX_USDT =
  (import.meta.env.VITE_ZTDX_USDT as string | undefined) || "0x0000000000000000000000000000000000000000";


/**
 * Trading-specific contract addresses by chain ID
 *
 * These are used for deposit and withdrawal operations in API trading mode.
 * The configuration automatically switches based on the chainId:
 * - ARBITRUM_SEPOLIA (421614): Testnet addresses
 * - ARBITRUM (42161): Mainnet/production addresses
 *
 * Use the getter functions (getTradingUsdtAddress, getTradingVaultAddress, getReferralRebateAddress)
 * to retrieve addresses for a specific chainId.
 */
export const TRADING_CONTRACTS = {
  [ARBITRUM_SEPOLIA]: {
    USDT: ZTDX_USDT,
    ZTDX_VAULT: ZTDX_VAULT_PROXY,
    REFERRAL_REBATE: ZTDX_REBATE_PROXY,
    EARN: ZTDX_EARN_PROXY,
  },
  [ARBITRUM]: {
    USDT: ZTDX_USDT,
    ZTDX_VAULT: ZTDX_VAULT_PROXY,
    REFERRAL_REBATE: ZTDX_REBATE_PROXY,
    EARN: ZTDX_EARN_PROXY,
  },
};

/**
 * Market symbol to contract address mapping
 * Used by API adapters (orderAdapter, tradeAdapter, positionAdapter)
 *
 * Maps market symbols (e.g., "BTC-USD", "ETHUSDT") to their contract addresses
 */
export const MARKET_SYMBOL_TO_ADDRESS: Record<number, Record<string, string>> = {
  [ARBITRUM_SEPOLIA]: {
    "BTC-USD": "0xBb532Ab4923C23c2bfA455151B14fec177a34C0D",
    "ETH-USD": "0x482Df3D320C964808579b585a8AC7Dd5D144eFaF",
    "PRIMIT-USD": "0x756be641d97c796bd13856c76830f274fb0ac857",
    "SOL-USD": "0x09400D9DB990D5ed3f35D7be61DfAEB900Af03C9",
    // Also support API format (ETHUSDT -> ETH-USD)
    BTCUSDT: "0xBb532Ab4923C23c2bfA455151B14fec177a34C0D",
    ETHUSDT: "0x482Df3D320C964808579b585a8AC7Dd5D144eFaF",
    PRIMITUSDT: "0x756be641d97c796bd13856c76830f274fb0ac857",
    SOLUSDT: "0x09400D9DB990D5ed3f35D7be61DfAEB900Af03C9",
  },
  [ARBITRUM]: {
    // Mainnet market addresses - Use SDK standard addresses for compatibility
    "BTC-USD": "0x47c031236e19d024b42f8AE6780E44A573170703", // BTC/USD on Arbitrum mainnet
    "ETH-USD": "0x70d95587d40A2caf56bd97485aB3Eec10Bee6336", // ETH/USD on Arbitrum mainnet (SDK standard address)
    "SOL-USD": "0x09400D9DB990D5ed3f35D7be61DfAEB900Af03C9", // SOL/USD on Arbitrum mainnet
    // Also support API format (ETHUSDT -> ETH-USD)
    BTCUSDT: "0x47c031236e19d024b42f8AE6780E44A573170703",
    ETHUSDT: "0x70d95587d40A2caf56bd97485aB3Eec10Bee6336",
    SOLUSDT: "0x09400D9DB990D5ed3f35D7be61DfAEB900Af03C9",
  },
} as const;

/**
 * Default collateral token addresses by chain
 * Used by API adapters for order/position/trade conversion
 */
export const DEFAULT_COLLATERAL_ADDRESS: Record<number, string> = {
  [ARBITRUM_SEPOLIA]: "0xc96BDE5008518332Bb5c45177f9E70D75Ea5D865", // Test USDT on Arbitrum Sepolia (redeployed 2026-01-27)
  [ARBITRUM]: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", // Official Tether USDT on Arbitrum mainnet
} as const;

/**
 * Get the USDT token address for a given chain ID in API trading mode.
 */
export function getTradingUsdtAddress(chainId: number): string | undefined {
  return TRADING_CONTRACTS[chainId as keyof typeof TRADING_CONTRACTS]?.USDT;
}

/**
 * Check if a token address is the API trading USDT address on the given chain.
 */
export function isTradingUsdtAddress(chainId: number, tokenAddress: string): boolean {
  const usdtAddress = getTradingUsdtAddress(chainId);
  return usdtAddress?.toLowerCase() === tokenAddress.toLowerCase();
}

/**
 * Get the trading vault contract address for a given chain ID in API trading mode.
 */
export function getTradingVaultAddress(chainId: number): string | undefined {
  return TRADING_CONTRACTS[chainId as keyof typeof TRADING_CONTRACTS]?.ZTDX_VAULT;
}

/**
 * Get market address from symbol for a given chain ID
 * Used by API adapters to convert API symbols to contract addresses
 */
export function getMarketAddressFromSymbol(chainId: number, symbol: string): string | undefined {
  return MARKET_SYMBOL_TO_ADDRESS[chainId]?.[symbol];
}

/**
 * Get symbol from market address for a given chain ID
 * Reverse lookup of getMarketAddressFromSymbol
 */
export function getSymbolFromMarketAddress(chainId: number, marketAddress: string): string | undefined {
  const mapping = MARKET_SYMBOL_TO_ADDRESS[chainId];
  if (!mapping) return undefined;

  for (const [symbol, address] of Object.entries(mapping)) {
    if (address.toLowerCase() === marketAddress.toLowerCase()) {
      return symbol;
    }
  }
  return undefined;
}

/**
 * Get default collateral token address for a given chain ID
 * Used by API adapters for order/position/trade conversion
 */
export function getDefaultCollateralAddress(chainId: number): string | undefined {
  return DEFAULT_COLLATERAL_ADDRESS[chainId];
}

/**
 * Get ReferralRebate contract address for a given chain ID
 */
export function getReferralRebateAddress(chainId: number): string | undefined {
  return TRADING_CONTRACTS[chainId as keyof typeof TRADING_CONTRACTS]?.REFERRAL_REBATE;
}

/**
 * Get Earn contract address for a given chain ID
 */
export function getEarnContractAddress(chainId: number): string | undefined {
  return TRADING_CONTRACTS[chainId as keyof typeof TRADING_CONTRACTS]?.EARN;
}
