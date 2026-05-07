import cryptoJs from "crypto-js";
import { ethers, Provider } from "ethers";
import {
  decodeFunctionResult,
  encodeAbiParameters,
  encodeFunctionData,
  Hex,
  keccak256,
  maxUint256,
  zeroAddress,
  zeroHash,
} from "viem";

import { isSourceChain } from "config/multichain";
import type { AnyChainId, ContractsChainId } from "config/static/chains";
import type {
  SignedSubacсountApproval,
  Subaccount,
  SubaccountApproval,
  SubaccountSerializedConfig,
  SubaccountValidations,
} from "domain/synthetics/subaccount/types";
import { WalletSigner } from "lib/wallets";
import { SignatureTypes, signTypedData } from "lib/wallets/signing";
import { abis } from "sdk/abis";
import { getContract } from "sdk/configs/contracts";
import {
  maxAllowedSubaccountActionCountKey,
  SUBACCOUNT_ORDER_ACTION,
  subaccountActionCountKey,
  subaccountExpiresAtKey,
  subaccountIntegrationIdKey,
  subaccountListKey,
} from "sdk/configs/dataStore";
import { DEFAULT_SUBACCOUNT_EXPIRY_DURATION, DEFAULT_SUBACCOUNT_MAX_ALLOWED_COUNT } from "sdk/configs/express";
import { bigMath } from "sdk/utils/bigmath";
import { ZERO_DATA } from "sdk/utils/hash";
import { nowInSeconds, secondsToPeriod } from "sdk/utils/time";
import type { SubaccountGelatoRelayRouter } from "typechain-types";

import { getGelatoRelayRouterDomain } from "../express";
import { SubaccountOnchainData } from "./useSubaccountOnchainData";
import { getMultichainInfoFromSigner, getOrderRelayRouterAddress } from "../express/expressOrderUtils";

export function getSubaccountValidations({
  requiredActions,
  subaccount,
  subaccountRouterAddress,
}: {
  requiredActions: number;
  subaccount: Subaccount;
  subaccountRouterAddress: string;
}): SubaccountValidations {
  return {
    isExpired: getIsSubaccountExpired(subaccount),
    isActionsExceeded: getIsSubaccountActionsExceeded(subaccount, requiredActions),
    isNonceExpired: getIsSubaccountNonceExpired(subaccount),
    isApprovalInvalid: getIsSubaccountApprovalInvalid({
      chainId: subaccount.chainId,
      signerChainId: subaccount.signerChainId,
      onchainData: subaccount.onchainData,
      signedApproval: subaccount.signedApproval,
      subaccountRouterAddress,
    }),
    isValid: !getIsInvalidSubaccount({ subaccount, requiredActions, subaccountRouterAddress }),
  };
}

export function getIsSubaccountActive(subaccount: {
  onchainData: SubaccountOnchainData;
  signedApproval: SignedSubacсountApproval | undefined;
}): boolean {
  let active = subaccount.onchainData.active;

  if (!active && subaccount.signedApproval && !getIsEmptySubaccountApproval(subaccount.signedApproval)) {
    active = subaccount.signedApproval.shouldAdd;
  }

  return active;
}

/**
 * Subaccount private-key-encryption key (KEK) helpers.
 *
 * The earlier implementation used the main EOA *address* as the AES passphrase.
 * That address is public on-chain, so the "encryption" provided zero at-rest
 * protection: anyone with a localStorage dump plus the EOA could decrypt.
 *
 * Fix: derive a 256-bit random KEK via WebCrypto per (main-account) on first
 * use, persist it under a separate localStorage key. Upgrade is real — the
 * attacker now needs to exfiltrate *both* the ciphertext and the KEK.
 *
 * NOTE: This is at-rest hardening, not XSS mitigation. Any script running on
 * the same origin can still read both values. True XSS-safe storage requires
 * moving the signing operation out of the renderer (service worker + HttpOnly
 * session, or wallet-held subaccount). Tracked for a follow-up refactor.
 */
const SUBACCOUNT_KEK_PREFIX = "primit_subaccount_kek_";

function normalizeAccount(account: string): string {
  return account.toLowerCase();
}

function kekStorageKey(account: string): string {
  return `${SUBACCOUNT_KEK_PREFIX}${normalizeAccount(account)}`;
}

function generateRandomKek(): string {
  const bytes = new Uint8Array(32);
  // crypto.getRandomValues is available in all supported browsers (and the
  // build target node >=18). Falling back to Math.random would re-introduce
  // the very weakness we are removing, so we throw loudly instead.
  if (typeof crypto === "undefined" || typeof crypto.getRandomValues !== "function") {
    throw new Error("[subaccount] WebCrypto unavailable; cannot create KEK");
  }
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function getOrCreateSubaccountKek(account: string): string {
  if (typeof window === "undefined") {
    throw new Error("[subaccount] getOrCreateSubaccountKek called outside browser");
  }
  const key = kekStorageKey(account);
  const existing = window.localStorage.getItem(key);
  if (existing && existing.length === 64) {
    return existing;
  }
  const kek = generateRandomKek();
  window.localStorage.setItem(key, kek);
  return kek;
}

function peekSubaccountKek(account: string): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(kekStorageKey(account));
}

export function getSubaccountSigner(config: SubaccountSerializedConfig, account: string, provider?: ethers.Provider) {
  const kek = peekSubaccountKek(account);

  let decryptedPrivateKey = "";
  if (kek) {
    try {
      decryptedPrivateKey = cryptoJs.AES.decrypt(config.privateKey, kek).toString(cryptoJs.enc.Utf8);
    } catch {
      decryptedPrivateKey = "";
    }
  }

  // Backwards-compat: older configs were encrypted with the EOA address as
  // passphrase. If KEK decryption fails or no KEK exists, fall back to the
  // legacy path, then rewrap with a fresh KEK so future reads are secure.
  if (!decryptedPrivateKey) {
    const legacy = cryptoJs.AES.decrypt(config.privateKey, account).toString(cryptoJs.enc.Utf8);
    if (!legacy) {
      throw new Error("[subaccount] Failed to decrypt subaccount private key; recreate subaccount");
    }
    decryptedPrivateKey = legacy;

    try {
      const freshKek = getOrCreateSubaccountKek(account);
      const rewrapped = cryptoJs.AES.encrypt(legacy, freshKek).toString();
      // Mutating the passed-in config is intentional — callers persist this
      // object back to storage on the next subaccount settings write. The
      // migration is best-effort; a failure here does not block signing.
      (config as { privateKey: string }).privateKey = rewrapped;
    } catch {
      // swallow: rewrap is an optimization, not a correctness requirement
    }
  }

  return new ethers.Wallet(decryptedPrivateKey, provider);
}

export function getMaxSubaccountActions(subaccount: {
  onchainData: SubaccountOnchainData;
  signedApproval: SignedSubacсountApproval | undefined;
}): bigint {
  if (subaccount.signedApproval && !getIsEmptySubaccountApproval(subaccount.signedApproval)) {
    return BigInt(subaccount.signedApproval.maxAllowedCount);
  }

  return subaccount.onchainData.maxAllowedCount;
}

export function getSubaccountExpiresAt(subaccount: {
  onchainData: SubaccountOnchainData;
  signedApproval: SignedSubacсountApproval | undefined;
}): bigint {
  if (subaccount.signedApproval && !getIsEmptySubaccountApproval(subaccount.signedApproval)) {
    return BigInt(subaccount.signedApproval.expiresAt);
  }

  return subaccount.onchainData.expiresAt;
}

export function getRemainingSubaccountActions(subaccount: {
  onchainData: SubaccountOnchainData;
  signedApproval: SignedSubacсountApproval | undefined;
}): bigint {
  const maxAllowedCount = getMaxSubaccountActions(subaccount);
  const currentActionCount = subaccount.onchainData.currentActionsCount;

  return maxAllowedCount - currentActionCount;
}

export function getIsApprovalDeadlineExpired(approval: SubaccountApproval): boolean {
  const now = BigInt(nowInSeconds());
  const deadline = approval.deadline;

  return now >= deadline;
}

export function getIsSubaccountActionsExceeded(subaccount: Subaccount, requiredActions: number) {
  return getRemainingSubaccountActions(subaccount) < bigMath.max(1n, BigInt(requiredActions));
}

export function getRemainingSubaccountSeconds(subaccount: Subaccount): bigint {
  const expiresAt = getSubaccountExpiresAt(subaccount);

  const now = BigInt(nowInSeconds());

  return bigMath.max(0n, expiresAt - now);
}

export function getRemainingSubaccountDays(subaccount: Subaccount): bigint {
  const seconds = getRemainingSubaccountSeconds(subaccount);

  return BigInt(secondsToPeriod(Number(seconds), "1d"));
}

/**
 * Returns false for empty subaccount approval
 */
export function getIsApprovalExpired(subaccount: Subaccount): boolean {
  const { signedApproval } = subaccount;

  if (getIsEmptySubaccountApproval(signedApproval)) {
    return false;
  }

  const now = BigInt(nowInSeconds());

  const expiresAt = signedApproval.expiresAt;
  const deadline = signedApproval.deadline;

  return now >= expiresAt || now >= deadline;
}

/**
 * Returns false for empty subaccount approval
 */
export function getIsSubaccountNonceExpired({
  chainId,
  onchainData,
  signedApproval,
}: {
  chainId: ContractsChainId;
  onchainData: SubaccountOnchainData;
  signedApproval: SignedSubacсountApproval;
}): boolean {
  if (getIsEmptySubaccountApproval(signedApproval)) {
    return false;
  }

  if (chainId !== signedApproval.signatureChainId) {
    return false;
  }

  let onChainNonce: bigint;
  if (signedApproval.subaccountRouterAddress === getContract(chainId, "SubaccountGelatoRelayRouter")) {
    onChainNonce = onchainData.approvalNonce;
  } else if (signedApproval.subaccountRouterAddress === getContract(chainId, "MultichainSubaccountRouter")) {
    onChainNonce = onchainData.multichainApprovalNonce;
  } else if (!signedApproval.subaccountRouterAddress) {
    if (isSourceChain(signedApproval.signatureChainId)) {
      onChainNonce = onchainData.multichainApprovalNonce;
    } else {
      onChainNonce = onchainData.approvalNonce;
    }
  } else {
    // eslint-disable-next-line no-console
    console.error(
      `Invalid subaccount router address: ${signedApproval.subaccountRouterAddress} at ${signedApproval.signatureChainId} for chainId: ${chainId}`
    );
    return false;
  }

  const signedNonce = signedApproval.nonce;

  return signedNonce !== onChainNonce;
}

/**
 * Returns false for empty subaccount approval
 */
export function getIsSubaccountApprovalInvalid({
  chainId,
  signerChainId,
  signedApproval,
  onchainData,
  subaccountRouterAddress,
}: {
  chainId: ContractsChainId;
  signerChainId: AnyChainId;
  signedApproval: SignedSubacсountApproval;
  onchainData: SubaccountOnchainData;
  subaccountRouterAddress: string;
}): boolean {
  if (getIsEmptySubaccountApproval(signedApproval)) {
    return false;
  }

  const isSignedSubaccountFresh = !onchainData.active;

  let relatedOnchainNonce: bigint | undefined;
  if (signedApproval.subaccountRouterAddress === getContract(chainId, "MultichainSubaccountRouter")) {
    relatedOnchainNonce = onchainData.multichainApprovalNonce;
  } else if (
    signedApproval.subaccountRouterAddress === getContract(chainId, "SubaccountGelatoRelayRouter") ||
    !signedApproval.subaccountRouterAddress
  ) {
    relatedOnchainNonce = onchainData.approvalNonce;
  } else {
    return true;
  }

  // Technically it is possible to create a new subaccount without deactivating the old one
  // For this we need to check approval signature even if currently there is a subaccount but our nonce
  // would be able to update it
  const isSignedSubaccountPossibleUpdate = signedApproval.nonce === relatedOnchainNonce;

  const result =
    (isSignedSubaccountFresh || isSignedSubaccountPossibleUpdate) &&
    (signedApproval.signatureChainId !== signerChainId ||
      signedApproval.subaccountRouterAddress !== subaccountRouterAddress);

  return result;
}

export function getIsSubaccountExpired(subaccount: Subaccount): boolean {
  const now = BigInt(nowInSeconds());
  const isApprovalExpired = getIsApprovalExpired(subaccount);

  if (isApprovalExpired) {
    return true;
  }

  const expiresAt = getSubaccountExpiresAt(subaccount);
  const isExpired = now >= expiresAt;

  return isExpired;
}

export function getIsInvalidSubaccount({
  subaccount,
  requiredActions,
  subaccountRouterAddress,
}: {
  subaccount: Subaccount;
  requiredActions: number;
  subaccountRouterAddress: string;
}): boolean {
  const isExpired = getIsSubaccountExpired(subaccount);
  const isNonceExpired = getIsSubaccountNonceExpired(subaccount);
  const actionsExceeded = getIsSubaccountActionsExceeded(subaccount, requiredActions);
  const isApprovalInvalid = getIsSubaccountApprovalInvalid({
    chainId: subaccount.chainId,
    signedApproval: subaccount.signedApproval,
    subaccountRouterAddress,
    signerChainId: subaccount.signerChainId,
    onchainData: subaccount.onchainData,
  });

  return isExpired || isNonceExpired || actionsExceeded || isApprovalInvalid;
}

export function getEmptySubaccountApproval(
  chainId: ContractsChainId,
  subaccountAddress: string
): SignedSubacсountApproval {
  return {
    subaccount: subaccountAddress,
    shouldAdd: false,
    expiresAt: 0n,
    maxAllowedCount: 0n,
    actionType: SUBACCOUNT_ORDER_ACTION,
    nonce: 0n,
    deadline: maxUint256,
    desChainId: BigInt(chainId),
    signature: ZERO_DATA,
    signedAt: 0,
    integrationId: zeroHash,
    subaccountRouterAddress: zeroAddress,
    signatureChainId: chainId,
  };
}

export function getIsEmptySubaccountApproval(subaccountApproval: SignedSubacсountApproval): boolean {
  return (
    subaccountApproval.signature === ZERO_DATA &&
    subaccountApproval.nonce === 0n &&
    subaccountApproval.expiresAt === 0n &&
    subaccountApproval.maxAllowedCount === 0n &&
    subaccountApproval.shouldAdd === false &&
    subaccountApproval.integrationId === zeroHash
  );
}

export async function getInitialSubaccountApproval({
  chainId,
  signer,
  provider,
  subaccountAddress,
  isTradingAccount,
}: {
  chainId: ContractsChainId;
  signer: WalletSigner;
  provider: Provider;
  subaccountAddress: string;
  isTradingAccount: boolean;
}) {
  const onchainData = await getSubaccountOnchainData({ chainId, signer, provider, subaccountAddress });

  const defaultExpiresAt = BigInt(nowInSeconds() + DEFAULT_SUBACCOUNT_EXPIRY_DURATION);

  let expiresAt = getSubaccountExpiresAt({
    onchainData,
    signedApproval: undefined,
  });

  if (expiresAt < defaultExpiresAt) {
    expiresAt = defaultExpiresAt;
  }

  const defaultMaxAllowedCount = BigInt(DEFAULT_SUBACCOUNT_MAX_ALLOWED_COUNT);
  const maxAllowedCount = onchainData.currentActionsCount + defaultMaxAllowedCount;

  const defaultSubaccountApproval = await createAndSignSubaccountApproval(
    chainId,
    signer,
    provider,
    subaccountAddress,
    {
      shouldAdd: !onchainData.active,
      expiresAt,
      maxAllowedCount,
    },
    isTradingAccount
  );

  return defaultSubaccountApproval;
}

export function getActualApproval(params: {
  chainId: ContractsChainId;
  address: string;
  signedApproval: SignedSubacсountApproval | undefined;
  onchainData: SubaccountOnchainData;
}): SignedSubacсountApproval {
  const { chainId, signedApproval, address, onchainData } = params;

  if (
    !signedApproval ||
    getIsSubaccountApprovalSynced({
      chainId,
      signedApproval,
      onchainData,
    })
  ) {
    return getEmptySubaccountApproval(chainId, address);
  }

  return signedApproval;
}

export function getIsSubaccountApprovalSynced(params: {
  chainId: ContractsChainId;
  signedApproval: SignedSubacсountApproval;
  onchainData: SubaccountOnchainData;
}): boolean {
  const { signedApproval, onchainData } = params;

  /**
   * If nonce is expired, we believe a newer settings have been applied in some other way e.g. different browser
   */
  if (getIsSubaccountNonceExpired(params)) {
    return true;
  }

  return (
    onchainData.maxAllowedCount === signedApproval.maxAllowedCount &&
    onchainData.expiresAt === signedApproval.expiresAt &&
    onchainData.active === true
  );
}

export async function signUpdatedSubaccountSettings({
  chainId,
  signer,
  provider,
  subaccount,
  nextRemainigActions,
  nextRemainingSeconds,
  isTradingAccount,
}: {
  chainId: ContractsChainId;
  signer: WalletSigner;
  provider: Provider;
  subaccount: Subaccount;
  nextRemainigActions: bigint | undefined;
  nextRemainingSeconds: bigint | undefined;
  isTradingAccount: boolean;
}) {
  const oldMaxAllowedCount = getMaxSubaccountActions(subaccount);
  const oldRemainingActions = getRemainingSubaccountActions(subaccount);

  let nextMaxAllowedCount = oldMaxAllowedCount;

  if (nextRemainigActions !== undefined) {
    nextMaxAllowedCount = oldMaxAllowedCount + nextRemainigActions - oldRemainingActions;
  }

  const oldExpiresAt = getSubaccountExpiresAt(subaccount);
  const oldRemainingSeconds = getRemainingSubaccountSeconds(subaccount);

  let nextExpiresAt = oldExpiresAt;

  if (nextRemainingSeconds !== undefined) {
    nextExpiresAt = oldExpiresAt + nextRemainingSeconds - oldRemainingSeconds;
  }

  const signedSubaccountApproval = await createAndSignSubaccountApproval(
    chainId,
    signer,
    provider,
    subaccount.address,
    {
      expiresAt: nextExpiresAt,
      maxAllowedCount: nextMaxAllowedCount,
      shouldAdd: !subaccount.onchainData.active,
    },
    isTradingAccount
  );

  return signedSubaccountApproval;
}

export async function createAndSignSubaccountApproval(
  chainId: ContractsChainId,
  mainAccountSigner: WalletSigner,
  provider: Provider,
  subaccountAddress: string,
  params: {
    shouldAdd: boolean;
    expiresAt: bigint;
    maxAllowedCount: bigint;
  },
  isTradingAccount: boolean
): Promise<SignedSubacсountApproval> {
  const srcChainId = await getMultichainInfoFromSigner(mainAccountSigner, chainId);

  const nonce = await getSubaccountApprovalNonceForProvider(chainId, mainAccountSigner, provider, isTradingAccount);

  const subaccountRouterAddress = getOrderRelayRouterAddress(chainId, true, isTradingAccount);

  const types: SignatureTypes = {
    SubaccountApproval: [
      { name: "subaccount", type: "address" },
      { name: "shouldAdd", type: "bool" },
      { name: "expiresAt", type: "uint256" },
      { name: "maxAllowedCount", type: "uint256" },
      { name: "actionType", type: "bytes32" },
      { name: "nonce", type: "uint256" },
      { name: "desChainId", type: "uint256" },
      { name: "deadline", type: "uint256" },
      { name: "integrationId", type: "bytes32" },
    ],
  };

  const domain = getGelatoRelayRouterDomain(srcChainId ?? chainId, subaccountRouterAddress);

  const typedData = {
    subaccount: subaccountAddress,
    shouldAdd: params.shouldAdd,
    expiresAt: params.expiresAt,
    maxAllowedCount: params.maxAllowedCount,
    desChainId: BigInt(chainId),
    actionType: SUBACCOUNT_ORDER_ACTION,
    nonce,
    integrationId: zeroHash,
    deadline: params.expiresAt,
  };

  const signature = await signTypedData({ signer: mainAccountSigner, domain, types, typedData });

  return {
    ...typedData,
    signature,
    signedAt: Date.now(),
    signatureChainId: domain.chainId as AnyChainId,
    subaccountRouterAddress,
  };
}

export function hashSubaccountApproval(subaccountApproval: SignedSubacсountApproval) {
  if (!subaccountApproval) {
    return zeroHash;
  }

  const encodedData = encodeAbiParameters(
    [
      {
        type: "tuple",
        components: [
          { name: "subaccount", type: "address" },
          { name: "shouldAdd", type: "bool" },
          { name: "expiresAt", type: "uint256" },
          { name: "maxAllowedCount", type: "uint256" },
          { name: "actionType", type: "bytes32" },
          { name: "nonce", type: "uint256" },
          { name: "desChainId", type: "uint256" },
          { name: "deadline", type: "uint256" },
          { name: "integrationId", type: "bytes32" },
          { name: "signature", type: "bytes" },
        ],
      },
    ],
    [subaccountApproval as any]
  );

  return keccak256(encodedData);
}

async function getSubaccountApprovalNonceForProvider(
  chainId: ContractsChainId,
  signer: WalletSigner,
  provider: Provider,
  isTradingAccount: boolean
): Promise<bigint> {
  if (provider === undefined) {
    throw new Error("Provider is required for multicall");
  }

  const subaccountRouterAddress = getOrderRelayRouterAddress(chainId, true, isTradingAccount);

  const contract = new ethers.Contract(
    subaccountRouterAddress,
    abis.AbstractSubaccountApprovalNonceable,
    provider
  ) as unknown as SubaccountGelatoRelayRouter;

  return await contract.subaccountApprovalNonces(signer.address);
}

export async function getSubaccountOnchainData({
  chainId,
  signer,
  provider,
  subaccountAddress,
}: {
  chainId: ContractsChainId;
  signer: WalletSigner;
  provider: Provider;
  subaccountAddress: string;
}) {
  const account = signer.address;

  const calls: {
    [key in keyof SubaccountOnchainData]:
      | {
          contractAddress: string;
          abi: any;
          functionName: string;
          args: any[];
        }
      | undefined;
  } = {
    approvalNonce: {
      contractAddress: getContract(chainId, "SubaccountGelatoRelayRouter"),
      abi: abis.AbstractSubaccountApprovalNonceable,
      functionName: "subaccountApprovalNonces",
      args: [account],
    },
    multichainApprovalNonce: {
      contractAddress: getContract(chainId, "MultichainSubaccountRouter"),
      abi: abis.AbstractSubaccountApprovalNonceable,
      functionName: "subaccountApprovalNonces",
      args: [account],
    },
    active: {
      contractAddress: getContract(chainId, "DataStore"),
      abi: abis.DataStore,
      functionName: "containsAddress",
      args: [subaccountListKey(account), subaccountAddress],
    },
    maxAllowedCount: {
      contractAddress: getContract(chainId, "DataStore"),
      abi: abis.DataStore,
      functionName: "getUint",
      args: [maxAllowedSubaccountActionCountKey(account, subaccountAddress, SUBACCOUNT_ORDER_ACTION)],
    },
    currentActionsCount: {
      contractAddress: getContract(chainId, "DataStore"),
      abi: abis.DataStore,
      functionName: "getUint",
      args: [subaccountActionCountKey(account, subaccountAddress, SUBACCOUNT_ORDER_ACTION)],
    },
    expiresAt: {
      contractAddress: getContract(chainId, "DataStore"),
      abi: abis.DataStore,
      functionName: "getUint",
      args: [subaccountExpiresAtKey(account, subaccountAddress, SUBACCOUNT_ORDER_ACTION)],
    },
    integrationId: {
      contractAddress: getContract(chainId, "DataStore"),
      abi: abis.DataStore,
      functionName: "getBytes32",
      args: [subaccountIntegrationIdKey(account, subaccountAddress)],
    },
  };

  const callData = encodeFunctionData({
    abi: abis.Multicall,
    functionName: "aggregate",
    args: [
      Object.values(calls)
        .filter(
          (call): call is { contractAddress: string; abi: any; functionName: string; args: any[] } => call !== undefined
        )
        .map((call) => ({
          target: call.contractAddress,
          callData: encodeFunctionData(call),
        })),
    ],
  });

  const result = await provider.call({
    data: callData,
    to: getContract(chainId, "Multicall"),
  });

  const [_, decodedMulticallResults] = decodeFunctionResult({
    abi: abis.Multicall,
    data: result as Hex,
    functionName: "aggregate",
  }) as [bigint, string[]];

  const results: SubaccountOnchainData = Object.entries(calls).reduce((acc, [key, call], index) => {
    if (call === undefined) {
      return acc;
    }

    acc[key] = decodeFunctionResult({
      abi: call.abi,
      functionName: call.functionName,
      data: decodedMulticallResults[index] as Hex,
    });

    return acc;
  }, {} as SubaccountOnchainData);

  return results;
}
