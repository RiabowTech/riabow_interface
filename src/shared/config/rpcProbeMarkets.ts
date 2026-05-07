import { ARBITRUM, ARBITRUM_SEPOLIA, AVALANCHE, AVALANCHE_FUJI, BOTANIX, ContractsChainId } from "config/chains";
import { Address } from "viem";

/**
 * Market addresses used for RPC health check probing
 * These markets are used to test RPC provider responsiveness and data accuracy
 */
export const RPC_PROBE_MARKETS: Record<ContractsChainId, Address> = {
  [ARBITRUM]: "0x70d95587d40A2caf56bd97485aB3Eec10Bee6336", // ETH/USD
  [AVALANCHE]: "0xB7e69749E3d2EDd90ea59A4932EFEa2D41E245d7", // ETH/USD
  [AVALANCHE_FUJI]: "0xbf338a6C595f06B7Cfff2FA8c958d49201466374", // ETH/USD
  [BOTANIX]: "0x6682BB60590a045A956541B1433f016Ed22E361d", // STBTC-STBTC
  [ARBITRUM_SEPOLIA]: "0xb6fC4C9eB02C35A134044526C62bb15014Ac0Bcc", // ETH/USD
};
