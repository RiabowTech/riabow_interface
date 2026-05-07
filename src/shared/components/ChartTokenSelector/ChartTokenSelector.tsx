import { t } from "@lingui/macro";
import cx from "classnames";
import { useMemo } from "react";

import { useChainId } from "lib/chains";
import { useBreakpoints } from "lib/useBreakpoints";

import Button from "components/Button/Button";
import { SelectorBase } from "../SelectorBase/SelectorBase";
import TokenIcon from "components/TokenIcon/TokenIcon";

import ChevronDownIcon from "img/ic_chevron_down.svg?react";

import { useSelectedTradingMarket } from "@/modules/lighter/api/custom/useTradingMarkets";
import { useTradeState } from "@/modules/lighter/store/TradeStateContext/TradeStateContext";
import { TradingMarketsDropdown } from "../TradingMarketsList/TradingMarketsDropdown";

type Props = {
  oneRowLabels?: boolean;
};

export default function ChartTokenSelector({ oneRowLabels }: Props) {
  const { isMobile } = useBreakpoints();
  const { chainId } = useChainId();
  const { selectedSymbol, setSelectedSymbol } = useTradeState();
  const market = useSelectedTradingMarket(chainId, selectedSymbol);

  const baseSymbol = useMemo(() => {
    return market?.base_asset || selectedSymbol?.replace(/[-/]?USD[T]?$/i, "") || "BTC";
  }, [market, selectedSymbol]);

  return (
    <SelectorBase
      popoverPlacement="bottom-start"
      handleClassName={cx({
        "mr-24": oneRowLabels === false,
      })}
      desktopPanelClassName="max-w-[100vw] w-[880px] shadow-md"
      chevronClassName="hidden"
      disabled={false}
      label={
        <Button variant="secondary">
          <span
            className={cx("inline-flex gap-12 whitespace-nowrap pl-0 text-[13px]", {
              "items-start": !oneRowLabels,
              "items-center": oneRowLabels,
            })}
          >
            <div className="flex items-center gap-8">
              <TokenIcon symbol={baseSymbol} displaySize={isMobile ? 32 : 20} />
              <div className="flex gap-2 md:items-center md:gap-8">
                <span
                  className={cx("flex justify-start leading-base", {
                    "flex-col items-baseline gap-2": !oneRowLabels,
                    "flex-row items-center": oneRowLabels,
                  })}
                >
                  <span className="text-start text-[13px] font-medium text-typography-primary">{baseSymbol}/USD</span>
                </span>

                <ChevronDownIcon className="primit-chevron-rotate inline-block size-16" />
              </div>
            </div>
          </span>
        </Button>
      }
      modalLabel={t`Market`}
      mobileModalContentPadding={false}
    >
      <TradingMarketsDropdown onMarketSelect={setSelectedSymbol} />
    </SelectorBase>
  );
}
