import { Trans } from "@lingui/macro";
import { memo, useEffect } from "react";
import { useAccount } from "wagmi";

import {
  TradingAccountModalView,
  useTradingAccountModalOpen,
  useTradingAccountSelectedTransferGuid,
} from "@/modules/lighter/context/TradingAccountContext";
import { SyntheticsStateContextProvider } from "@/modules/lighter/store/SyntheticsStateContext/SyntheticsStateContextProvider";
import { useTradingAccountFundingHistoryItem } from "@/modules/lighter/domain/multichain/useTradingAccountFundingHistory";
import { useChainId } from "lib/chains";
import { userAnalytics } from "lib/userAnalytics";
import { OneClickPromotionEvent } from "lib/userAnalytics/types";

import ModalWithPortal from "components/Modal/ModalWithPortal";
import { SlideModal } from "components/Modal/SlideModal";

import ArrowLeftIcon from "img/ic_arrow_left.svg?react";

import { AvailableToTradeAssetsView } from "./AvailableToTradeAssetsView";
import { DepositStatusView } from "./DepositStatusView";
import { DepositView } from "./DepositView";
import { MainView } from "./MainView";
import { SelectAssetToDepositView } from "./SelectAssetToDepositView";
import { TransferDetailsView } from "./TransferDetailsView";
import { WithdrawalView } from "./WithdrawalView";

const AvailableToTradeAssetsTitle = () => {
  const { srcChainId } = useChainId();
  const [, setIsVisibleOrView] = useTradingAccountModalOpen();

  return (
    <div className="flex items-center gap-8">
      <ArrowLeftIcon
        className="size-20 text-slate-100 outline-none"
        tabIndex={0}
        role="button"
        onClick={() => setIsVisibleOrView("main")}
      />
      {srcChainId !== undefined ? <Trans>Account Balance</Trans> : <Trans>Available to Trade Assets</Trans>}
    </div>
  );
};

const TransferDetailsTitle = () => {
  const [, setIsVisibleOrView] = useTradingAccountModalOpen();
  const [selectedTransferGuid] = useTradingAccountSelectedTransferGuid();
  const selectedTransfer = useTradingAccountFundingHistoryItem(selectedTransferGuid);

  return (
    <div className="flex items-center gap-8">
      <ArrowLeftIcon
        className="size-20 text-slate-100 outline-none"
        tabIndex={0}
        role="button"
        onClick={() => setIsVisibleOrView("main")}
      />
      {selectedTransfer?.operation === "withdrawal" ? (
        <Trans>Withdrawal from Account</Trans>
      ) : (
        <Trans>Deposit to Account</Trans>
      )}
    </div>
  );
};

const DepositTitle = () => {
  const [, setIsVisibleOrView] = useTradingAccountModalOpen();
  return (
    <div className="flex items-center gap-8">
      <ArrowLeftIcon
        className="size-20 text-slate-100 outline-none"
        tabIndex={0}
        role="button"
        onClick={() => setIsVisibleOrView("main")}
      />
      <Trans>Deposit to Account</Trans>
    </div>
  );
};

const DepositStatusTitle = () => {
  return (
    <div className="flex items-center gap-8">
      <Trans>Your deposit is in progress</Trans>
    </div>
  );
};

const SelectAssetToDepositTitle = () => {
  const [, setIsVisibleOrView] = useTradingAccountModalOpen();
  return (
    <div className="flex items-center gap-8">
      <ArrowLeftIcon
        className="size-20 text-slate-100 outline-none"
        tabIndex={0}
        role="button"
        onClick={() => setIsVisibleOrView("deposit")}
      />
      <Trans>Select Asset to Deposit</Trans>
    </div>
  );
};

const WithdrawTitle = () => {
  const [, setIsVisibleOrView] = useTradingAccountModalOpen();
  return (
    <div className="flex items-center gap-8">
      <ArrowLeftIcon
        className="size-20 text-slate-100 outline-none"
        tabIndex={0}
        role="button"
        onClick={() => setIsVisibleOrView("main")}
      />
      <Trans>Withdraw from Account</Trans>
    </div>
  );
};

const MainTitle = () => {
  return <Trans>My Wallet</Trans>;
};

const VIEW_TITLE: Record<TradingAccountModalView, React.ReactNode> = {
  main: <MainTitle />,
  availableToTradeAssets: <AvailableToTradeAssetsTitle />,
  transferDetails: <TransferDetailsTitle />,
  deposit: <DepositTitle />,
  depositStatus: <DepositStatusTitle />,
  selectAssetToDeposit: <SelectAssetToDepositTitle />,
  withdraw: <WithdrawTitle />,
};

export const TradingAccountModal = memo(() => {
  const { address: account } = useAccount();
  const [isVisibleOrView, setIsVisibleOrView] = useTradingAccountModalOpen();

  const isVisible = isVisibleOrView !== false && account !== undefined;
  const view = typeof isVisibleOrView === "string" ? isVisibleOrView : "main";

  useEffect(() => {
    if (!account && Boolean(isVisibleOrView)) {
      setIsVisibleOrView(false);
    }
  }, [account, isVisibleOrView, setIsVisibleOrView]);

  if (view === "depositStatus") {
    const handleDepositStatusModalVisibility = (nextVisible: boolean) => {
      if (!nextVisible) {
        userAnalytics.pushEvent<OneClickPromotionEvent>({
          event: "OneClickPromotion",
          data: { action: "UserRejected" },
        });

        setIsVisibleOrView("main");
      }
    };

    return (
      <ModalWithPortal
        label={VIEW_TITLE[view]}
        isVisible={isVisible}
        setIsVisible={handleDepositStatusModalVisibility}
        withMobileBottomPosition={true}
        contentPadding={false}
        contentClassName="w-[420px]"
      >
        <DepositStatusView />
      </ModalWithPortal>
    );
  }

  return (
    <SlideModal
      label={VIEW_TITLE[view]}
      isVisible={isVisible}
      setIsVisible={setIsVisibleOrView}
      desktopContentClassName={
        view === "main" ? "trading-account-modal-shell" : "!h-[640px] !w-[461px]"
      }
      disableOverflowHandling={true}
      className="text-body-medium"
      contentPadding={false}
    >
      {view === "main" && account && <MainView account={account} />}
      {view === "availableToTradeAssets" && <AvailableToTradeAssetsView />}
      {view === "transferDetails" && <TransferDetailsView />}
      {view === "deposit" && <DepositView />}
      {view === "selectAssetToDeposit" && <SelectAssetToDepositView />}
      {view === "withdraw" && (
        <SyntheticsStateContextProvider skipLocalReferralCode={false} pageType="tradingAccount">
          <WithdrawalView />
        </SyntheticsStateContextProvider>
      )}
    </SlideModal>
  );
});
