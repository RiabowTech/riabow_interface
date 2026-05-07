import { Hex } from "viem";

/**
 * Known Safe smart account singleton addresses
 * These are used as fallback addresses in case Safe API is down or has deprecated some addresses
 * We can still detect Safe accounts using these known singleton addresses
 *
 * @see https://docs.safe.global/core-api/transaction-service-reference
 */
export const KNOWN_SAFE_SINGLETON_ADDRESSES: Hex[] = [
  "0x3e5c63644e683549055b9be8653de26e0b4cd36e", // v1.3.0 L2 default
  "0xfb1bffc9d739b8d520daf37df666da4c687191ea", // v1.3.0 L2
  "0xd9db270c1b5e3bd161e8c8503c55ceabee709552", // v1.3.0
  "0x69f4d1788e39c87893c980c06edf4b7f686e2938", // v1.3.0
  "0x41675c099f32341bf84bfc5382af534df5c7461a", // v1.4.1
  "0x29fcb43b46531bca003ddc8fcb67ffe91900c762", // v1.4.1 L2
];

/**
 * Get a Set of lowercase Safe singleton addresses for efficient lookup
 */
export function getKnownSafeSingletons(): Set<Hex> {
  return new Set(KNOWN_SAFE_SINGLETON_ADDRESSES.map((addr) => addr.toLowerCase() as Hex));
}
