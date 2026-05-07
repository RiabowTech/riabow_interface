import type { SettlementChainId, SourceChainId } from "config/chains";
import { MULTICHAIN_SOURCE_TO_SETTLEMENTS_MAPPING } from "config/multichain";

export function areChainsRelated(settlementChainId: SettlementChainId, sourceChainId: SourceChainId) {
  return MULTICHAIN_SOURCE_TO_SETTLEMENTS_MAPPING[sourceChainId]?.includes(settlementChainId) ?? false;
}
