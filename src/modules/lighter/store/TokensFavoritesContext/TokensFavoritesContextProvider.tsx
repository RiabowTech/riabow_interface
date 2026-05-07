import noop from "lodash/noop";
import { PropsWithChildren, createContext, useCallback, useContext, useMemo } from "react";

import { TOKEN_FAVORITES_PREFERENCE_KEY } from "config/localStorage";
import { useLocalStorageSerializeKey } from "lib/localStorage";
import { EMPTY_ARRAY, EMPTY_OBJECT } from "lib/objects";
import type { TokenCategory } from "sdk/types/tokens";

export type TokenFavoritesTabOption = "all" | "favorites" | TokenCategory;
export type TokenFavoritesType = "gm" | "index" | "trade";
export type TokenFavoriteKey =
  | "chart-token-selector"
  | "market-selector"
  | "pool-selector"
  | "gm-token-selector"
  | "gm-token-receive-pay-selector"
  | "gm-list"
  | "gm-pool-selector"
  // Trading-page market selector
  | "trade-market-selector";

const TAB_TYPE_MAP: Record<TokenFavoriteKey, TokenFavoritesType> = {
  "chart-token-selector": "index",
  "market-selector": "index",
  "pool-selector": "index",
  "gm-token-selector": "gm",
  "gm-token-receive-pay-selector": "gm",
  "gm-list": "gm",
  "gm-pool-selector": "gm",
  "trade-market-selector": "trade",
};

type TokensFavoritesStore = {
  tabs: {
    [key in TokenFavoriteKey]?: TokenFavoritesTabOption;
  };
  gmFavoriteTokens: string[];
  indexFavoriteTokens: string[];
  tradeFavoriteTokens: string[];
};

const DEFAULT_TOKENS_FAVORITES_STORE: TokensFavoritesStore = {
  tabs: EMPTY_OBJECT,
  gmFavoriteTokens: EMPTY_ARRAY,
  indexFavoriteTokens: EMPTY_ARRAY,
  tradeFavoriteTokens: EMPTY_ARRAY,
};

type TokensFavoritesContextType = {
  tabs: { [key in TokenFavoriteKey]?: TokenFavoritesTabOption };
  gmFavoriteTokens: string[];
  indexFavoriteTokens: string[];
  tradeFavoriteTokens: string[];
  setTab: (key: TokenFavoriteKey, tab: TokenFavoritesTabOption) => void;
  toggleFavoriteToken: (type: TokenFavoritesType, address: string) => void;
};

export type TokenFavoritesState = {
  tab: TokenFavoritesTabOption;
  favoriteTokens: string[];
  setTab: (tab: TokenFavoritesTabOption) => void;
  toggleFavoriteToken: (address: string) => void;
};

const context = createContext<TokensFavoritesContextType>({
  tabs: {},
  gmFavoriteTokens: EMPTY_ARRAY,
  indexFavoriteTokens: EMPTY_ARRAY,
  tradeFavoriteTokens: EMPTY_ARRAY,
  setTab: noop,
  toggleFavoriteToken: noop,
});

const Provider = context.Provider;

export function TokensFavoritesContextProvider({ children }: PropsWithChildren) {
  const [settings, changeSettings] = useLocalStorageSerializeKey<TokensFavoritesStore>(
    TOKEN_FAVORITES_PREFERENCE_KEY,
    DEFAULT_TOKENS_FAVORITES_STORE
  );

  const setSettings = useCallback(
    (update: (prev: TokensFavoritesStore) => TokensFavoritesStore) => {
      changeSettings(update(settings ?? DEFAULT_TOKENS_FAVORITES_STORE));
    },
    [changeSettings, settings]
  );

  const setTab = useCallback(
    (key: TokenFavoriteKey, tab: TokenFavoritesTabOption) => {
      setSettings((prev) => {
        return {
          ...prev,
          tabs: {
            ...prev.tabs,
            [key]: tab,
          },
        };
      });
    },
    [setSettings]
  );

  const toggleFavoriteToken = useCallback(
    (type: TokenFavoritesType, address: string) => {
      setSettings((prev) => {
        let favoriteTokens: string[];
        if (type === "gm") {
          favoriteTokens = prev.gmFavoriteTokens ?? EMPTY_ARRAY;
        } else if (type === "trade") {
          favoriteTokens = prev.tradeFavoriteTokens ?? EMPTY_ARRAY;
        } else {
          favoriteTokens = prev.indexFavoriteTokens ?? EMPTY_ARRAY;
        }

        const updatedFavoriteTokens = favoriteTokens.includes(address)
          ? favoriteTokens.filter((token) => token !== address)
          : [...favoriteTokens, address];

        const newState = {
          ...prev,
        };

        if (type === "gm") {
          newState.gmFavoriteTokens = updatedFavoriteTokens;
        } else if (type === "trade") {
          newState.tradeFavoriteTokens = updatedFavoriteTokens;
        } else {
          newState.indexFavoriteTokens = updatedFavoriteTokens;
        }

        return newState;
      });
    },
    [setSettings]
  );

  const stableObj = useMemo<TokensFavoritesContextType>(() => {
    const s = settings ?? DEFAULT_TOKENS_FAVORITES_STORE;
    return {
      tabs: s.tabs ?? EMPTY_OBJECT,
      // 旧版 localStorage 可能缺字段，回退到空数组避免下游 `.includes` 崩溃
      gmFavoriteTokens: s.gmFavoriteTokens ?? EMPTY_ARRAY,
      indexFavoriteTokens: s.indexFavoriteTokens ?? EMPTY_ARRAY,
      tradeFavoriteTokens: s.tradeFavoriteTokens ?? EMPTY_ARRAY,
      setTab,
      toggleFavoriteToken,
    };
  }, [settings, setTab, toggleFavoriteToken]);

  return <Provider value={stableObj}>{children}</Provider>;
}

export function useTokensFavorites(key: TokenFavoriteKey): TokenFavoritesState {
  const { tabs, setTab, toggleFavoriteToken, indexFavoriteTokens, gmFavoriteTokens, tradeFavoriteTokens } =
    useContext(context);
  const type = TAB_TYPE_MAP[key];

  const tab = tabs[key] || "all";
  let favoriteTokens: string[];
  if (type === "gm") {
    favoriteTokens = gmFavoriteTokens;
  } else if (type === "trade") {
    favoriteTokens = tradeFavoriteTokens;
  } else {
    favoriteTokens = indexFavoriteTokens;
  }

  const internalSetTab = useCallback(
    (tab: TokenFavoritesTabOption) => {
      setTab(key, tab);
    },
    [key, setTab]
  );

  const internalToggleFavoriteToken = useCallback(
    (address: string) => {
      toggleFavoriteToken(type, address);
    },
    [toggleFavoriteToken, type]
  );

  return {
    tab,
    favoriteTokens,
    setTab: internalSetTab,
    toggleFavoriteToken: internalToggleFavoriteToken,
  };
}

export const tokensFavoritesTabOptions: TokenFavoritesTabOption[] = ["all", "favorites"];

export const tokensFavoritesTabOptionLabels: Record<TokenFavoritesTabOption, string> = {
  all: "All Markets",
  favorites: "Favorites",
};
