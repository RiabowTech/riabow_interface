import { useMemo } from "react";
import useSWR from "swr";
import { useAccount } from "wagmi";

import { useSyntheticsEvents } from "@/modules/lighter/context/SyntheticsEvents";
import { getIndexerUrl } from "config/indexers";
import { MultichainFundingHistoryItem } from "@/modules/lighter/domain/multichain/types";
import { useChainId } from "lib/chains";
import { FREQUENT_UPDATE_INTERVAL } from "lib/timeConstants";
import graphqlFetcher from "sdk/utils/graphqlFetcher";

const query = /* gql */ `
query ($account: String, $guid: String) {
  multichainFunding(where: {account: $account, id: $guid}) {
    id
    step
    account
    sentAmount
    receivedAmount
    isExecutionError
    executedTimestamp
    executedTxn
    operation
    receivedTimestamp
    receivedTxn
    sentTimestamp
    sentTxn
    settlementChainId
    sourceChainId
    token
  }
}
`;

async function fetchTradingAccountFundingHistory(
  chainId: number,
  variables: {
    account?: string;
    guid?: string;
  }
): Promise<MultichainFundingHistoryItem[]> {
  const subsquidUrl = getIndexerUrl(chainId, "subsquid");

  if (!subsquidUrl) {
    throw new Error("No squid url");
  }

  const response = (await graphqlFetcher(subsquidUrl, query, variables)) as {
    multichainFunding: MultichainFundingHistoryItem[];
  };

  return response.multichainFunding.map(
    (item): MultichainFundingHistoryItem => ({
      ...item,
      sentAmount: BigInt(item.sentAmount),
      receivedAmount: item.receivedAmount ? BigInt(item.receivedAmount) : undefined,
      sentTimestamp: item.sentTimestamp,
      receivedTimestamp: item.receivedTimestamp ? item.receivedTimestamp : undefined,
      executedTimestamp: item.executedTimestamp ? item.executedTimestamp : undefined,

      receivedTxn: item.receivedTxn ? item.receivedTxn : undefined,
      executedTxn: item.executedTxn ? item.executedTxn : undefined,
    })
  );
}

const STEP_ORDER: Record<MultichainFundingHistoryItem["step"], number> = {
  submitted: 1,
  sent: 2,
  received: 3,
  executed: 4,
};

export function isStepGreaterOrEqual(
  step: MultichainFundingHistoryItem["step"],
  than: MultichainFundingHistoryItem["step"]
): boolean {
  return STEP_ORDER[step] - STEP_ORDER[than] >= 0;
}

export function isStepGreater(
  step: MultichainFundingHistoryItem["step"],
  than: MultichainFundingHistoryItem["step"]
): boolean {
  return STEP_ORDER[step] - STEP_ORDER[than] > 0;
}

export function useTradingAccountFundingHistory(opts?: { enabled?: boolean }): {
  fundingHistory: MultichainFundingHistoryItem[] | undefined;
  isLoading: boolean;
} {
  const { chainId } = useChainId();
  const { address: account } = useAccount();
  const { pendingMultichainFunding, updatePendingMultichainFunding } = useSyntheticsEvents();
  const isEnabled = opts?.enabled !== false;
  const safePendingMultichainFunding = Array.isArray(pendingMultichainFunding) ? pendingMultichainFunding : [];

  const { data, isLoading } = useSWR<MultichainFundingHistoryItem[]>(
    account && isEnabled ? [chainId, "trading-account-funding-history", account] : null,
    {
      fetcher: () => fetchTradingAccountFundingHistory(chainId, { account }),
      refreshInterval: FREQUENT_UPDATE_INTERVAL,
      onSuccess(data) {
        updatePendingMultichainFunding(data);
      },
    }
  );

  const mergedData = useMemo(() => {
    if (!isEnabled) {
      return data;
    }

    let mergedData = data ? [...data] : [];
    const guidToIndex: Partial<Record<string, number>> = {};

    for (let index = 0; index < mergedData.length; index++) {
      const guid = mergedData[index].id;
      guidToIndex[guid] = index;
    }

    const dataToUnshift: MultichainFundingHistoryItem[] = [];

    for (const item of safePendingMultichainFunding) {
      if (item.step === "submitted") {
        continue;
      }

      const currentIndex = guidToIndex[item.id];

      if (currentIndex === undefined) {
        dataToUnshift.unshift(item);
        continue;
      }

      const current = mergedData[currentIndex];

      if (isStepGreaterOrEqual(current.step, item.step)) {
        continue;
      }

      mergedData[currentIndex] = item;
    }

    mergedData = dataToUnshift.concat(mergedData);

    const alreadySentTxns = mergedData.filter((item) => item.sentTxn !== undefined).map((item) => item.sentTxn!);

    const filteredSubmittedEvents = safePendingMultichainFunding.filter(
      (item) => item.step === "submitted" && (!item.sentTxn || !alreadySentTxns.includes(item.sentTxn))
    );

    mergedData = [...filteredSubmittedEvents, ...mergedData];

    mergedData.sort((a, b) => b.sentTimestamp - a.sentTimestamp);

    return mergedData;
  }, [data, isEnabled, safePendingMultichainFunding]);

  return { fundingHistory: mergedData, isLoading };
}

function useTradingAccountPendingFundingHistoryItem(guid: string | undefined): MultichainFundingHistoryItem | undefined {
  const { pendingMultichainFunding } = useSyntheticsEvents();
  const safePendingMultichainFunding = Array.isArray(pendingMultichainFunding) ? pendingMultichainFunding : [];

  const pendingItem = useMemo((): MultichainFundingHistoryItem | undefined => {
    if (!guid) {
      return undefined;
    }

    const pendingItem = safePendingMultichainFunding.find((item) => item.id === guid);

    return pendingItem;
  }, [guid, safePendingMultichainFunding]);

  return pendingItem;
}

export function useTradingAccountFundingHistoryItem(
  guid: string | undefined,
  opts?: { refetch?: boolean }
): MultichainFundingHistoryItem | undefined {
  const { chainId } = useChainId();

  const { data } = useSWR(guid ? ["trading-account-funding-history-item", guid] : null, {
    fetcher: () => fetchTradingAccountFundingHistory(chainId, { guid }),
    refreshInterval: opts?.refetch ? FREQUENT_UPDATE_INTERVAL : 0,
  });

  const currentItem = data?.[0];

  const pendingItem = useTradingAccountPendingFundingHistoryItem(guid);

  if (!currentItem && !pendingItem) {
    return undefined;
  }

  if (!currentItem && pendingItem) {
    return pendingItem;
  }

  if (currentItem && !pendingItem) {
    return currentItem;
  }

  return isStepGreaterOrEqual(currentItem!.step, pendingItem!.step) ? currentItem : pendingItem;
}
