import { AES } from "crypto-js";
import { Signer } from "ethers";
import { keccak256, type Hash } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { SUBACCOUNT_MESSAGE } from "sdk/configs/express";

import { getOrCreateSubaccountKek } from "./utils";

export async function generateSubaccount(signer: Signer) {
  const signature = await signer.signMessage(SUBACCOUNT_MESSAGE);

  const pk = keccak256(signature as Hash);
  const subaccount = privateKeyToAccount(pk);

  // Encrypt with a random per-install KEK instead of the public EOA address.
  // See utils.ts -> getOrCreateSubaccountKek for the full threat model.
  const account = await signer.getAddress();
  const kek = getOrCreateSubaccountKek(account);
  const encrypted = AES.encrypt(pk, kek);

  return {
    privateKey: encrypted.toString(),
    address: subaccount.address,
    isNew: true,
  };
}
