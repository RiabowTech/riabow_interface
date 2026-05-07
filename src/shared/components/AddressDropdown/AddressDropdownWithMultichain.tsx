import { Trans } from "@lingui/macro";
import cx from "classnames";
import { useCallback } from "react";
import Skeleton from "react-loading-skeleton";

import { useTradingAccountModalOpen } from "@/modules/lighter/context/TradingAccountContext";
import { useTradingAccountShowDepositButton } from "@/modules/lighter/domain/multichain/useTradingAccountShowDepositButton";
import { isTradeModeActive } from "@/modules/lighter/store/TradeStateContext/TradeStateContext";
import { useChainId } from "lib/chains";
import { useENS } from "lib/legacy";
import { formatUsd } from "lib/numbers";
import { useBreakpoints } from "lib/useBreakpoints";
import { shortenAddressOrEns } from "lib/wallets";

import { Avatar } from "components/Avatar/Avatar";
import Button from "components/Button/Button";
import { useAvailableToTradeAssetSettlementChain } from "components/TradingAccountModal/hooks";

type Props = {
  account: string;
};

export function AddressDropdownWithMultichain({ account }: Props) {
  const { srcChainId } = useChainId();
  const { ensName } = useENS(account);
  const [, setTradingAccountModalOpen] = useTradingAccountModalOpen();
  const { totalUsd, apiAccountUsd, isTradingAccountLoading } = useAvailableToTradeAssetSettlementChain();
  const { shouldShowDepositButton } = useTradingAccountShowDepositButton();

  const { isMobile, isSmallMobile } = useBreakpoints();
  const displayAddressLength = isMobile ? 9 : 13;

  const handleOpenTradingAccountModal = useCallback(() => {
    setTradingAccountModalOpen(true);
  }, [setTradingAccountModalOpen]);

  const handleOpenDeposit = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setTradingAccountModalOpen("deposit");
    },
    [setTradingAccountModalOpen]
  );

  // In API trading mode, always show apiAccountUsd from the /balances API.
  const shouldShowTradingAccountBalance = isTradeModeActive() || srcChainId !== undefined;
  const showSideButton = shouldShowTradingAccountBalance || (apiAccountUsd !== undefined && apiAccountUsd > 0n);

  return (
    <div className="text-body-medium flex font-medium text-typography-primary">
      <Button
        variant="secondary"
        type="button"
        size="controlled"
        className={cx("h-32 md:h-40", {
          "!py-4 !pl-12 !pr-4": shouldShowDepositButton && !isMobile,
          "!py-0 !pl-12 !pr-0": shouldShowDepositButton && isMobile,
        })}
        onClick={handleOpenTradingAccountModal}
      >
        <div
          className={cx(
            "text-body-medium flex items-center font-medium text-typography-primary",
            !isMobile && (!shouldShowDepositButton ? "gap-16" : "gap-20"),
            isMobile && "gap-8"
          )}
        >
          <div className="flex items-center gap-8">
            <Avatar size={isMobile ? 16 : 24} ensName={ensName} address={account} />

            {!isSmallMobile && <>{shortenAddressOrEns(ensName || account, displayAddressLength)}</>}
          </div>

          {showSideButton && !shouldShowDepositButton && (
            <>
              {!isSmallMobile && <div className="h-20 w-1 shrink-0 bg-slate-600" />}

              {isTradingAccountLoading ? (
                <Skeleton baseColor="#B4BBFF1A" highlightColor="#B4BBFF1A" width={55} height={18} />
              ) : (
                formatUsd(shouldShowTradingAccountBalance ? apiAccountUsd : totalUsd, { displayDecimals: 0 })
              )}
            </>
          )}

          {shouldShowDepositButton && (
            <Button variant="primary" onClick={handleOpenDeposit}>
              <Trans>Deposit</Trans>
            </Button>
          )}
        </div>
      </Button>
    </div>
  );
}
