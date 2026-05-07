import { Trans } from "@lingui/macro";
import { useConnectModal } from "@rainbow-me/rainbowkit";

import Button from "components/Button/Button";
import WalletIcon from "img/ic_wallet.svg?react";

import "./ConnectWalletPrompt.css";

export function ConnectWalletPrompt() {
  const { openConnectModal, connectModalOpen } = useConnectModal();

  const handleConnect = () => {
    if (connectModalOpen || !openConnectModal) return;
    openConnectModal();
  };

  return (
    <div className="connect-wallet-prompt">
      <div className="connect-wallet-content">
        <div className="connect-wallet-icon-wrapper">
          <WalletIcon className="connect-wallet-icon" />
        </div>
        
        <h1 className="connect-wallet-title">
          <Trans>Connect Your Wallet</Trans>
        </h1>
        
        <p className="connect-wallet-description">
          <Trans>
            Connect your wallet to view your portfolio, track your positions, and manage your trades.
          </Trans>
        </p>

        <Button
          variant="primary"
          size="controlled"
          className="connect-wallet-button"
          onClick={handleConnect}
        >
          <WalletIcon className="button-icon" />
          <span><Trans>Connect Wallet</Trans></span>
        </Button>

      </div>
    </div>
  );
}

