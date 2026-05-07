import { Trans, t } from "@lingui/macro";
import { useLingui } from "@lingui/react";
import cx from "classnames";
import { useMemo } from "react";
import type { Address } from "viem";

import { getAccountDashboardTabKey } from "config/localStorage";
import { useLocalStorageSerializeKey } from "lib/localStorage";
import { OpenOrdersTab } from "@/modules/lighter/components/BottomTabs/OpenOrdersTab";
import { OrderHistoryTab } from "@/modules/lighter/components/BottomTabs/OrderHistoryTab";
import { PositionsTab } from "@/modules/lighter/components/BottomTabs/PositionsTab";
import { useOpenOrdersAdapter } from "@/modules/lighter/adapters/useOpenOrdersAdapter";
import { usePositionsAdapter } from "@/modules/lighter/adapters/usePositionsAdapter";
import type { ContractsChainId } from "sdk/configs/chains";

import Tabs from "components/Tabs/Tabs";

enum TabKey {
  Positions = "Positions",
  Orders = "Orders",
  OrderHistory = "OrderHistory",
}

type Props = {
  chainId: ContractsChainId;
  account: Address;
};

export function HistoricalLists({ chainId }: Props) {
  const { i18n } = useLingui();
  const [tabKey, setTabKey] = useLocalStorageSerializeKey(getAccountDashboardTabKey(chainId), TabKey.Positions);
  const positions = usePositionsAdapter();
  const openOrders = useOpenOrdersAdapter();

  const tabsOptions = useMemo(
    () => [
      {
        value: TabKey.Positions,
        label: (
          <span className="flex items-center gap-6">
            <Trans>Positions</Trans>
            <span className="text-typography-secondary">({positions.length})</span>
          </span>
        ),
      },
      {
        value: TabKey.Orders,
        label: (
          <span className="flex items-center gap-6">
            <Trans>Orders</Trans>
            <span className="text-typography-secondary">({openOrders.length})</span>
          </span>
        ),
      },
      {
        value: TabKey.OrderHistory,
        label: t`Order History`,
      },
    ],
    [i18n.locale, openOrders.length, positions.length]
  );

  const activeTab = (tabKey as TabKey) ?? TabKey.Positions;

  return (
    <div>
      <div className="overflow-x-auto scrollbar-hide">
        <Tabs
          options={tabsOptions}
          selectedValue={activeTab}
          onChange={setTabKey}
          type="block"
          className={cx("historical-lists-tabs w-[max(100%,600px)] max-md:w-[max(100%,420px)]", {
            "max-lg:mb-8 max-lg:rounded-b-8": activeTab !== TabKey.OrderHistory,
          })}
          regularOptionClassname={cx({
            "max-lg:first:rounded-l-8 max-lg:last:rounded-r-8": activeTab !== TabKey.OrderHistory,
          })}
        />
      </div>

      {activeTab === TabKey.Positions && <PositionsTab mode="all" />}
      {activeTab === TabKey.Orders && <OpenOrdersTab mode="all" marketFilter="All" typeFilter="All" />}
      {activeTab === TabKey.OrderHistory && <OrderHistoryTab mode="all" marketFilter="All" />}
    </div>
  );
}
