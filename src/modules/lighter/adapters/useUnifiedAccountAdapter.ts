import { useMemo } from "react";

import { usePrimitUserUnifiedAccount } from "modules/lighter/api/hooks";

import { mapUnifiedAccountToPanelModel, type LighterUnifiedAccountPanelModel } from "./unifiedAccountMapping";

export function useUnifiedAccountAdapter(): LighterUnifiedAccountPanelModel {
  const { data } = usePrimitUserUnifiedAccount();

  return useMemo(() => mapUnifiedAccountToPanelModel(data), [data]);
}
