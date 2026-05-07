import type { ReactNode } from "react";

import { GlobalStateProvider } from "@/modules/lighter/context/GlobalContext";
import { PendingTxnsContextProvider } from "@/modules/lighter/context/PendingTxnsContext";
import { SettingsContextProvider, useSettings } from "@/modules/lighter/context/SettingsContext";
import { SubaccountContextProvider } from "@/modules/lighter/context/SubaccountContext";
import { SyntheticsEventsProvider } from "@/modules/lighter/context/SyntheticsEvents";
import { TokenPermitsContextProvider } from "@/modules/lighter/context/TokenPermitsContext";
import { TokensBalancesContextProvider } from "@/modules/lighter/context/TokensBalancesContext";
import { TradingAccountContextProvider } from "@/modules/lighter/context/TradingAccountContext";
import { WebsocketContextProvider } from "@/modules/lighter/context/WebsocketContext";
import { SettingsModal } from "@/shared/components/SettingsModal/SettingsModal";

type Props = {
  children: ReactNode;
};

function RuntimeSettingsModal() {
  const { isSettingsVisible, setIsSettingsVisible } = useSettings();

  return <SettingsModal isSettingsVisible={isSettingsVisible} setIsSettingsVisible={setIsSettingsVisible} />;
}

export function LighterTradeRuntimeProviders({ children }: Props) {
  return (
    <GlobalStateProvider>
      <SettingsContextProvider>
        <WebsocketContextProvider>
          <PendingTxnsContextProvider>
            <SubaccountContextProvider>
              <TokenPermitsContextProvider>
                <TradingAccountContextProvider>
                  <TokensBalancesContextProvider>
                    <SyntheticsEventsProvider>
                      {children}
                      <RuntimeSettingsModal />
                    </SyntheticsEventsProvider>
                  </TokensBalancesContextProvider>
                </TradingAccountContextProvider>
              </TokenPermitsContextProvider>
            </SubaccountContextProvider>
          </PendingTxnsContextProvider>
        </WebsocketContextProvider>
      </SettingsContextProvider>
    </GlobalStateProvider>
  );
}
