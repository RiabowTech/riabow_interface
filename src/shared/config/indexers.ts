// DEPRECATED: Indexer URLs are no longer actively used.
// Data is now fetched from backend API instead of direct indexer queries.

export function getIndexerUrl(
  chainId: number,
  indexer: "stats" | "referrals" | "syntheticsStats" | "subsquid" | "chainLink"
): string | undefined {
  // Disabled: indexer URLs are no longer used
  return undefined;
}
