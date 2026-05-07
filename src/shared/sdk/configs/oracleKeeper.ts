// DEPRECATED: Oracle Keeper URLs are no longer actively used.
// Most OracleKeeperFetcher methods have been disabled and return stub values.
// The URLs are kept for backwards compatibility but may be removed in the future.

export function getOracleKeeperUrl(chainId: number) {
  // Return a placeholder URL - oracle keeper methods are disabled
  return "https://disabled-oracle-keeper.local";
}

export function getOracleKeeperFallbackUrls(chainId: number) {
  // Return empty array - oracle keeper fallback is disabled
  return [];
}
