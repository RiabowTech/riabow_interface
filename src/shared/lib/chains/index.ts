import { useChainContext } from "shared/context/ChainContext/ChainContext";

export function useChainId() {
  return useChainContext();
}
