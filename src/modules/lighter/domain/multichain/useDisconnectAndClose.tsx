import { useCallback } from "react";
import { useHistory, useLocation } from "react-router-dom";
import { useAccount, useDisconnect } from "wagmi";

import { useTradingAccountModalOpen } from "@/modules/lighter/context/TradingAccountContext";
import { useSettings } from "@/modules/lighter/context/SettingsContext";
import { SHOULD_EAGER_CONNECT_LOCALSTORAGE_KEY, CURRENT_PROVIDER_LOCALSTORAGE_KEY } from "config/localStorage";
import { userAnalytics } from "lib/userAnalytics";
import { DisconnectWalletEvent } from "lib/userAnalytics/types";
import { logout as apiLogout } from "modules/lighter/api/custom/client";
import { disconnectAllWebSockets } from "modules/lighter/api/custom/websocket";

export function useDisconnectAndClose() {
  const { setIsSettingsVisible } = useSettings();
  const [, setIsVisible] = useTradingAccountModalOpen();
  const { disconnect } = useDisconnect();
  const { address, connector: activeConnector } = useAccount();
  const history = useHistory();
  const location = useLocation();

  const handleDisconnect = useCallback(() => {
    // Clean up WebSocket connections first to prevent "CLOSING or CLOSED" errors
    disconnectAllWebSockets();

    // Clear API auth tokens
    apiLogout(address);

    // Disconnect with the active connector to ensure full cleanup
    if (activeConnector) {
      disconnect({ connector: activeConnector });
    } else {
      disconnect();
    }

    userAnalytics.pushEvent<DisconnectWalletEvent>({
      event: "ConnectWalletAction",
      data: {
        action: "Disconnect",
      },
    });
    localStorage.removeItem(SHOULD_EAGER_CONNECT_LOCALSTORAGE_KEY);
    localStorage.removeItem(CURRENT_PROVIDER_LOCALSTORAGE_KEY);

    // Clear wagmi persisted store to prevent stale connector state on reconnect
    localStorage.removeItem("wagmi.store");
    localStorage.removeItem("wagmi.recentConnectorId");

    setIsVisible(false);
    setIsSettingsVisible(false);

    // If on accounts page, redirect to /accounts to show connect wallet prompt
    if (location.pathname.startsWith("/accounts")) {
      setTimeout(() => {
        history.push("/accounts");
      }, 1000);
    }
  }, [disconnect, activeConnector, address, setIsVisible, setIsSettingsVisible, history, location]);

  return handleDisconnect;
}
