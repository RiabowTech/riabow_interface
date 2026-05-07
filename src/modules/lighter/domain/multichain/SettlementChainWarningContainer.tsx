import { Trans } from "@lingui/macro";
import { useCallback } from "react";

import { MULTICHAIN_SOURCE_TO_SETTLEMENTS_MAPPING } from "config/multichain";
import { getChainName, SettlementChainId } from "config/static/chains";
import { useTradingAccountSettlementChainId } from "@/modules/lighter/context/TradingAccountContext";
import { useEmptyTradingAccounts } from "@/modules/lighter/domain/multichain/useEmptyTradingAccounts";
import { useChainId } from "lib/chains";
import { formatUsd } from "lib/numbers";
import { EMPTY_OBJECT } from "lib/objects";

import { ColorfulBanner, ColorfulButtonLink } from "components/ColorfulBanner/ColorfulBanner";
import { useAvailableToTradeAssetMultichainRequest } from "components/TradingAccountModal/hooks";

import InfoIcon from "img/ic_info.svg?react";

export function SettlementChainWarningContainer() {
  const { chainId: fallbackChainId, srcChainId } = useChainId();

  const [settlementChainId, setTradingAccountSettlementChainId] = useTradingAccountSettlementChainId();

  const settlementChains = srcChainId ? MULTICHAIN_SOURCE_TO_SETTLEMENTS_MAPPING[srcChainId] : undefined;

  const { emptyTradingAccounts } = useEmptyTradingAccounts(settlementChains);

  const isCurrentSettlementChainEmpty = emptyTradingAccounts?.[settlementChainId] === true;

  const anyNonEmptyTradingAccountChainId = Object.entries(emptyTradingAccounts ?? EMPTY_OBJECT)
    .filter(([chainId, isEmpty]) => !isEmpty && chainId !== settlementChainId.toString())
    .map(([chainId]) => Number(chainId) as SettlementChainId)
    .at(0);

  const { tradingAccountUsd } = useAvailableToTradeAssetMultichainRequest(
    anyNonEmptyTradingAccountChainId ?? fallbackChainId,
    srcChainId
  );

  const handleNetworkSwitch = useCallback(() => {
    if (!anyNonEmptyTradingAccountChainId) {
      return;
    }

    setTradingAccountSettlementChainId(anyNonEmptyTradingAccountChainId);
  }, [setTradingAccountSettlementChainId, anyNonEmptyTradingAccountChainId]);

  if (!anyNonEmptyTradingAccountChainId || !isCurrentSettlementChainEmpty) {
    return null;
  }

  return (
    <ColorfulBanner color="blue" icon={InfoIcon} className="text-body-small">
      <Trans>
        You switched your settlement network to {getChainName(settlementChainId)}, but you still have{" "}
        {formatUsd(tradingAccountUsd)} remaining in your {getChainName(anyNonEmptyTradingAccountChainId)} Trading Account.
      </Trans>

      <ColorfulButtonLink color="blue" onClick={handleNetworkSwitch}>
        <Trans>Change to {getChainName(anyNonEmptyTradingAccountChainId)}</Trans>
      </ColorfulButtonLink>
    </ColorfulBanner>
  );
}
