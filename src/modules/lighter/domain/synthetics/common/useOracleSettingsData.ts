import { useChainId } from "lib/chains";
import { useMulticall } from "lib/multicall";
import { tryGetContract } from "config/contracts";
import { REQUEST_EXPIRATION_TIME_KEY } from "sdk/configs/dataStore";

export type OracleSettingsData = {
  requestExpirationTime: bigint;
};

export const useOracleSettingsData = ({ enabled = true }: { enabled?: boolean } = {}): OracleSettingsData | undefined => {
  const { chainId } = useChainId();
  const dataStoreAddress = enabled ? tryGetContract(chainId, "DataStore") : undefined;

  const { data } = useMulticall(chainId, "useOracleSettings", {
    key: dataStoreAddress ? [] : null,

    request: () => ({
      dataStore: {
        contractAddress: dataStoreAddress!,
        abiId: "DataStore",
        calls: {
          requestExpirationTime: {
            methodName: "getUint",
            params: [REQUEST_EXPIRATION_TIME_KEY],
          },
        },
      },
    }),
    parseResponse: (res) => {
      const results = res.data.dataStore;
      return {
        requestExpirationTime: results.requestExpirationTime.returnValues[0],
      };
    },
  });

  return data;
};
