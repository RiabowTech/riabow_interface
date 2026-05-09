import "@wagmi/connectors";

import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { SWRConfig } from "swr";

import "react-toastify/dist/ReactToastify.css";
import "styles/Font.css";
import "styles/FoundationLayout.css";
import "styles/Input.css";
import "styles/Shared.scss";
import "styles/ZanbaraTypography.css";
import "styles/ZanbaraColors.css";
import "./theme/component-themes";
import "styles/recharts.css";
import "styles/DeprecatedExchageStyles.scss";
import "components/Card/Card.css";
import "./App.scss";

import { SorterContextProvider } from "@/modules/lighter/context/SorterContext";
import { TokensFavoritesContextProvider } from "@/modules/lighter/store/TokensFavoritesContext/TokensFavoritesContextProvider";
import { useChainId } from "lib/chains";
import { RainbowKitProviderWrapper } from "lib/wallets/WalletProvider";

import SEO from "components/Seo/SEO";

import { AppRoutes } from "./AppRoutes";
import {
  ChainContextProvider,
  DesignSystemProvider,
  ThemeProvider,
} from "./providers";
import { SWRConfigProp } from "./swrConfig";


if (window?.ethereum?.autoRefreshOnNetworkChange) {
  window.ethereum.autoRefreshOnNetworkChange = false;
}

function SWRConfigWithKey({ children }: { children: React.ReactNode }) {
  const { chainId } = useChainId();
  return (
    <SWRConfig key={chainId} value={SWRConfigProp}>
      {children}
    </SWRConfig>
  );
}

function App() {
  let app = <AppRoutes />;
  app = <SorterContextProvider>{app}</SorterContextProvider>;
  app = <TokensFavoritesContextProvider>{app}</TokensFavoritesContextProvider>;
  app = <SEO>{app}</SEO>;
  app = <RainbowKitProviderWrapper>{app}</RainbowKitProviderWrapper>;
  app = <I18nProvider i18n={i18n as any}>{app}</I18nProvider>;
  app = <SWRConfigWithKey>{app}</SWRConfigWithKey>;
  app = <ChainContextProvider>{app}</ChainContextProvider>;
  app = <DesignSystemProvider>{app}</DesignSystemProvider>;
  app = <ThemeProvider>{app}</ThemeProvider>;

  return app;
}

export default App;
