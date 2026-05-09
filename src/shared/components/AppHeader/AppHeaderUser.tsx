import { Trans } from "@lingui/macro";
import { useCallback } from "react";
import { useConnectModal } from "@rainbow-me/rainbowkit";

import { NETWORK_OPTIONS } from "config/networkOptions";
import { useChainId } from "lib/chains";
import { sendUserAnalyticsConnectWalletClickEvent } from "lib/userAnalytics";
import useWallet from "lib/wallets/useWallet";

import { OneClickButton } from "components/OneClickButton/OneClickButton";
import { ZanbaraAuthButton } from "components/ZanbaraAuth/ZanbaraAuthButton";

import { AddressDropdown } from "../AddressDropdown/AddressDropdown";
import ConnectWalletButton from "../ConnectWalletButton/ConnectWalletButton";
import NetworkDropdown from "../NetworkDropdown/NetworkDropdown";

type Props = {
  openSettings: () => void;
  menuToggle?: React.ReactNode;
};

export function AppHeaderUser({ openSettings, menuToggle }: Props) {
  const { chainId: settlementChainId, srcChainId } = useChainId();
  const { active, account } = useWallet();
  const { openConnectModal, connectModalOpen } = useConnectModal();

  const visualChainId = srcChainId ?? settlementChainId;

  const handleConnectWallet = useCallback(
    (e?: React.MouseEvent) => {
      e?.stopPropagation();
      e?.preventDefault();
      if (!openConnectModal) return;
      // Prevent multiple simultaneous connection requests
      if (active || account) return;
      // Prevent opening if modal is already open
      if (connectModalOpen) return;
      sendUserAnalyticsConnectWalletClickEvent("Header");
      openConnectModal();
    },
    [openConnectModal, active, account, connectModalOpen]
  );

  if (!active || !account) {
    return (
      <div className="flex items-center gap-8">
        {openConnectModal ? (
          <>
            <ConnectWalletButton onClick={handleConnectWallet}>
              <Trans>Connect wallet</Trans>
            </ConnectWalletButton>
            <OneClickButton openSettings={openSettings} />
            <NetworkDropdown chainId={visualChainId} networkOptions={NETWORK_OPTIONS} openSettings={openSettings} />
            {menuToggle ? menuToggle : null}
          </>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-8">
      <div data-qa="user-address">
        <AddressDropdown account={account} />
      </div>
      <ZanbaraAuthButton variant="secondary" />
      <OneClickButton openSettings={openSettings} />
      <NetworkDropdown chainId={visualChainId} networkOptions={NETWORK_OPTIONS} openSettings={openSettings} />
      {menuToggle ? menuToggle : null}
    </div>
  );
}
