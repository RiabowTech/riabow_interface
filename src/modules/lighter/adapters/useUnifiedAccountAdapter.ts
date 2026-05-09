import { useMemo } from "react";

import { useZanbaraUserUnifiedAccount } from "modules/lighter/api/hooks";

import { mapUnifiedAccountToPanelModel, type LighterUnifiedAccountPanelModel } from "./unifiedAccountMapping";

export function useUnifiedAccountAdapter(): LighterUnifiedAccountPanelModel {
  const { data } = useZanbaraUserUnifiedAccount();

  return useMemo(() => mapUnifiedAccountToPanelModel(data), [data]);
}
