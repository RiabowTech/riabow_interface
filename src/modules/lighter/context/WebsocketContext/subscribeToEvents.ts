import { AbiCoder, ethers, isAddress, LogParams, Provider, ProviderEvent, ZeroAddress } from "ethers";
import { Abi, decodeEventLog, Hex } from "viem";
import type { ContractEventArgsFromTopics } from "viem/_types/types/contract";

import { tryGetContract } from "config/contracts";
import type { ContractsChainId } from "sdk/configs/chains";
import { getTokens, NATIVE_TOKEN_ADDRESS } from "sdk/configs/tokens";

const APPROVED_HASH = ethers.id("Approval(address,address,uint256)");

const OFT_SENT_HASH = ethers.id("OFTSent(bytes32,uint32,address,uint256,uint256)");
const OFT_RECEIVED_HASH = ethers.id("OFTReceived(bytes32,uint32,address,uint256)");
const COMPOSE_DELIVERED_HASH = ethers.id("ComposeDelivered(address,address,bytes32,uint16)");

export const OFT_SENT_ABI = [
  {
    inputs: [
      { indexed: true, internalType: "bytes32", name: "guid", type: "bytes32" },
      { indexed: false, internalType: "uint32", name: "dstEid", type: "uint32" },
      { indexed: true, internalType: "address", name: "fromAddress", type: "address" },
      { indexed: false, internalType: "uint256", name: "amountSentLD", type: "uint256" },
      { indexed: false, internalType: "uint256", name: "amountReceivedLD", type: "uint256" },
    ],
    name: "OFTSent",
    type: "event",
  },
] as const satisfies Abi;

export const OFT_RECEIVED_ABI = [
  {
    inputs: [
      { indexed: true, internalType: "bytes32", name: "guid", type: "bytes32" },
      { indexed: false, internalType: "uint32", name: "srcEid", type: "uint32" },
      { indexed: true, internalType: "address", name: "toAddress", type: "address" },
      { indexed: false, internalType: "uint256", name: "amountReceivedLD", type: "uint256" },
    ],
    name: "OFTReceived",
    type: "event",
  },
] as const satisfies Abi;

export const COMPOSE_DELIVERED_ABI = [
  {
    inputs: [
      { indexed: false, internalType: "address", name: "from", type: "address" },
      { indexed: false, internalType: "address", name: "to", type: "address" },
      { indexed: false, internalType: "bytes32", name: "guid", type: "bytes32" },
      { indexed: false, internalType: "uint16", name: "index", type: "uint16" },
    ],
    name: "ComposeDelivered",
    type: "event",
  },
] as const satisfies Abi;

export function subscribeToApprovalEvents(
  chainId: ContractsChainId,
  provider: Provider,
  account: string,
  onApprove: (tokenAddress: string, spender: string, value: bigint) => void
) {
  const spenders = [ZeroAddress, tryGetContract(chainId, "SyntheticsRouter"), tryGetContract(chainId, "Router")].filter(
    Boolean
  );

  const spenderTopics = spenders.map((spender) => AbiCoder.defaultAbiCoder().encode(["address"], [spender]));
  const addressHash = AbiCoder.defaultAbiCoder().encode(["address"], [account]);
  const tokenAddresses = getTokens(chainId)
    .filter((token) => isAddress(token.address) && token.address !== NATIVE_TOKEN_ADDRESS)
    .map((token) => token.address);

  const approvalsFilter: ProviderEvent = {
    address: tokenAddresses,
    topics: [APPROVED_HASH, addressHash, spenderTopics],
  };

  const handleApprovalsLog = (log: LogParams) => {
    const tokenAddress = log.address;
    const spender = ethers.AbiCoder.defaultAbiCoder().decode(["address"], log.topics[2])[0];
    const value = ethers.AbiCoder.defaultAbiCoder().decode(["uint256"], log.data)[0];

    onApprove(tokenAddress, spender, value);
  };

  provider.on(approvalsFilter, handleApprovalsLog);

  return () => {
    provider.off(approvalsFilter, handleApprovalsLog);
  };
}

export type OftSentInfo = {
  sender: string;
  txnHash: string;
} & ContractEventArgsFromTopics<typeof OFT_SENT_ABI, "OFTSent">;

export function subscribeToOftSentEvents(
  provider: Provider,
  account: string,
  stargates: string[],
  onOftSent: (info: OftSentInfo) => void
): () => void {
  const addressHash = AbiCoder.defaultAbiCoder().encode(["address"], [account]);

  const providerFilter: ProviderEvent = {
    address: stargates,
    topics: [OFT_SENT_HASH, null, addressHash],
  };

  const handleOftSentLog = (log: LogParams) => {
    const args = decodeEventLog({
      abi: OFT_SENT_ABI,
      eventName: "OFTSent",
      topics: log.topics as any,
      data: log.data as Hex,
    }).args;

    onOftSent({
      sender: log.address,
      txnHash: log.transactionHash,
      ...args,
    });
  };

  provider.on(providerFilter, handleOftSentLog);

  return () => {
    provider.off(providerFilter, handleOftSentLog);
  };
}

export function subscribeToOftReceivedEvents(
  provider: Provider,
  stargates: string[],
  guids: string[],
  onOftReceive: (
    info: { sender: string; txnHash: string } & ContractEventArgsFromTopics<typeof OFT_RECEIVED_ABI, "OFTReceived">
  ) => void
) {
  if (guids.length === 0) {
    return undefined;
  }

  const providerFilter: ProviderEvent = {
    address: stargates,
    topics: [OFT_RECEIVED_HASH, guids, null],
  };

  const handleOftReceivedLog = (log: LogParams) => {
    const args = decodeEventLog({
      abi: OFT_RECEIVED_ABI,
      eventName: "OFTReceived",
      topics: log.topics as any,
      data: log.data as Hex,
    }).args;

    onOftReceive({
      sender: log.address,
      txnHash: log.transactionHash,
      ...args,
    });
  };

  provider.on(providerFilter, handleOftReceivedLog);

  return () => {
    provider.off(providerFilter, handleOftReceivedLog);
  };
}

export function subscribeToComposeDeliveredEvents(
  provider: Provider,
  layerZeroEndpoint: string,
  guids: string[],
  onComposeDelivered: (
    info: { sender: string; txnHash: string } & ContractEventArgsFromTopics<
      typeof COMPOSE_DELIVERED_ABI,
      "ComposeDelivered"
    >
  ) => void
) {
  if (guids.length === 0) {
    return undefined;
  }

  const providerFilter: ProviderEvent = {
    address: layerZeroEndpoint,
    topics: [COMPOSE_DELIVERED_HASH],
  };

  const handleComposeDeliveredLog = (log: LogParams) => {
    const args = decodeEventLog({
      abi: COMPOSE_DELIVERED_ABI,
      eventName: "ComposeDelivered",
      topics: log.topics as any,
      data: log.data as Hex,
    }).args;

    // Manual filtering because event params are not indexed
    if (!guids.includes(args.guid)) {
      return;
    }

    onComposeDelivered({
      sender: log.address,
      txnHash: log.transactionHash,
      ...args,
    });
  };

  provider.on(providerFilter, handleComposeDeliveredLog);

  return () => {
    provider.off(providerFilter, handleComposeDeliveredLog);
  };
}

export function subscribeToMultichainApprovalEvents(
  provider: Provider,
  account: string,
  tokenAddresses: string[],
  spenders: string[],
  onApprove: (tokenAddress: string, spender: string, value: bigint) => void
) {
  const spenderTopics = spenders.map((spender) => AbiCoder.defaultAbiCoder().encode(["address"], [spender]));
  const addressHash = AbiCoder.defaultAbiCoder().encode(["address"], [account]);

  const approvalsFilter: ProviderEvent = {
    address: tokenAddresses,
    topics: [APPROVED_HASH, addressHash, spenderTopics],
  };

  const handleApprovalsLog = (log: LogParams) => {
    const tokenAddress = log.address;
    const spender = ethers.AbiCoder.defaultAbiCoder().decode(["address"], log.topics[2])[0];
    const value = ethers.AbiCoder.defaultAbiCoder().decode(["uint256"], log.data)[0];
    onApprove(tokenAddress, spender, value);
  };

  provider.on(approvalsFilter, handleApprovalsLog);

  return () => {
    provider.off(approvalsFilter, handleApprovalsLog);
  };
}

/**
 * The historical V2 GMX event subscription is gone (see SyntheticsEventsProvider
 * cleanup). The WebSocket health check still calls this to decide whether to
 * force a reconnect, so the function stays but returns 0 — connection-state
 * checks (`isProviderInClosedState`) remain in place as the primary signal.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function getTotalSubscribersEventsCount(_chainId: ContractsChainId, _provider: Provider, _opts: { v2: boolean }) {
  return 0;
}
