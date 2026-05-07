const NOOP = () => undefined;

export function useTradePageVersion() {
  return [2, NOOP] as const;
}
