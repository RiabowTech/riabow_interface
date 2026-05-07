import { getPublicClient } from "@wagmi/core";
import useSWR from "swr";
import { Hex, PublicClient } from "viem";
import { useAccount, useChainId, usePublicClient } from "wagmi";

import { AnyChainId, CHAIN_SLUGS_MAP, CONTRACTS_CHAIN_IDS } from "config/chains";
import { SOURCE_CHAINS } from "config/multichain";
import { getIsNonEoaAccountError, nonEoaAccountError } from "lib/errors/customErrors";

import { getRainbowKitConfig } from "./rainbowKitConfig";
import { getKnownSafeSingletons } from "./safeSingletons";

export enum AccountType {
  Safe,
  SmartAccount, // ERC-4337 compatible smart account
  PostEip7702EOA, // Post-EIP-7702 EOA (delegated EOA)
  EOA,
}

/**
 * Cached Safe singleton addresses for fallback detection
 * Keep this in case if Safe API is down or deprecated some addresses
 */
const KNOWN_SAFE_SINGLETONS = getKnownSafeSingletons();

async function isSafeAccount(
  bytecode: Hex,
  address: string,
  client: PublicClient,
  safeSingletonAddresses: Set<string>
): Promise<boolean> {
  if (bytecode === "0x") {
    return false;
  }

  const storage = await client.getStorageAt({ address, slot: "0x0" });
  if (!storage) {
    return false;
  }

  const masterCopy = `0x${storage.slice(-40)}`.toLowerCase() as Hex;

  return KNOWN_SAFE_SINGLETONS.has(masterCopy) || safeSingletonAddresses.has(masterCopy);
}

async function getAccountType(
  address: string,
  client: PublicClient,
  safeSingletonAddresses: Set<string>
): Promise<AccountType> {
  const bytecode = await client.getBytecode({ address });
  if (!bytecode || bytecode === "0x") {
    return AccountType.EOA;
  }

  if (bytecode.startsWith("0xef0100") && bytecode.length === 48) {
    return AccountType.PostEip7702EOA;
  }

  if (safeSingletonAddresses.size > 0) {
    const isSafe = await isSafeAccount(bytecode, address, client, safeSingletonAddresses);
    if (isSafe) {
      return AccountType.Safe;
    }
  }

  return AccountType.SmartAccount;
}

export function useAccountType() {
  const { address } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();

  const { data: safeSingletonAddresses = new Set<Hex>() } = useSWR<Set<string>>([chainId, "safeSingletons"], {
    fetcher: async () => {
      try {
        const chain = CHAIN_SLUGS_MAP[chainId];
        const response = await fetch(`https://safe-transaction-${chain}.safe.global/api/v1/about/singletons/`);
        const data: { address: string }[] = await response.json();
        return new Set(data.map((item) => item.address.toLowerCase() as Hex));
      } catch (error) {
        return new Set<string>();
      }
    },
  });

  const { data: accountType = null } = useSWR<AccountType | null>(
    address && publicClient && [address, publicClient, chainId, "detectAccountType"],
    {
      fetcher: async () => {
        if (!address || !publicClient || !safeSingletonAddresses) {
          return null;
        }

        const account = await getAccountType(address, publicClient, safeSingletonAddresses);
        return account;
      },
      refreshInterval: 0,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateIfStale: false,
    }
  );

  return {
    accountType,
    isSmartAccount: accountType !== AccountType.EOA && accountType !== AccountType.PostEip7702EOA,
  };
}

export function useIsNonEoaAccountOnAnyChain(): boolean {
  const { address } = useAccount();

  const { data: isNonEoaAccountOnAnyChain = false } = useSWR<boolean | undefined>(
    address && [address, "detectIsNonEoaAccountOnAnyChain"],
    {
      fetcher: async (): Promise<boolean | undefined> => {
        if (!address) {
          return undefined;
        }

        return Promise.all(
          (CONTRACTS_CHAIN_IDS as AnyChainId[]).concat(SOURCE_CHAINS).map(async (chainId) => {
            const publicClient = getPublicClient(getRainbowKitConfig(), { chainId });

            if (!publicClient) {
              return undefined;
            }

            const accountType = await getAccountType(address, publicClient, new Set<string>());

            const isSomeEoaAccount = accountType === AccountType.EOA || accountType === AccountType.PostEip7702EOA;

            if (!isSomeEoaAccount) {
              return Promise.reject(nonEoaAccountError(chainId));
            }
          })
        )
          .then(() => {
            return false;
          })
          .catch((error) => {
            if (getIsNonEoaAccountError(error)) {
              return true;
            }

            return false;
          });
      },
      refreshInterval: 0,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateIfStale: false,
    }
  );

  return isNonEoaAccountOnAnyChain;
}
