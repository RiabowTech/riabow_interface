import { Address, encodeFunctionData, type Hex } from "viem";

import { ARBITRUM, ARBITRUM_SEPOLIA, type SettlementChainId } from "config/chains";
import { getTradingVaultAddress } from "config/custom/contracts";
import { GasPriceData, getGasPrice } from "lib/gas/gasPrice";
import { getProvider } from "lib/rpc";
import { TxnCallback, WalletTxnCtx, sendWalletTransaction } from "lib/transactions";
import type { WalletSigner } from "lib/wallets";

export async function sendSameChainDepositTxn({
  chainId,
  signer,
  amount,
  account,
  callback,
}: {
  chainId: SettlementChainId;
  signer: WalletSigner;
  amount: bigint;
  account: string;
  callback?: TxnCallback<WalletTxnCtx>;
}) {
  if (chainId !== ARBITRUM_SEPOLIA && chainId !== ARBITRUM) {
    throw new Error(`Same-chain deposit is not supported for chain ${chainId}`);
  }

  const vaultAddress = getTradingVaultAddress(chainId);
  if (!vaultAddress) {
    throw new Error("Trading vault address not found for chain");
  }

  const vaultAbi = [
    {
      type: "function",
      stateMutability: "nonpayable",
      name: "deposit",
      inputs: [
        { name: "amount", type: "uint256" },
        { name: "referralCode", type: "bytes32" },
      ],
      outputs: [],
    },
  ] as const;

  const emptyReferralCode = ("0x" + "0".repeat(64)) as Hex;
  const callData = encodeFunctionData({
    abi: vaultAbi,
    functionName: "deposit",
    args: [amount, emptyReferralCode],
  });

  const depositGasLimit = 400000n;
  const provider = getProvider(undefined, chainId);
  const baseGasPriceData = await getGasPrice(provider, chainId);
  const multipliedGasPriceData: GasPriceData =
    "gasPrice" in baseGasPriceData
      ? { gasPrice: baseGasPriceData.gasPrice * 2n }
      : {
          maxFeePerGas: baseGasPriceData.maxFeePerGas * 2n,
          maxPriorityFeePerGas: baseGasPriceData.maxPriorityFeePerGas * 2n,
        };

  const runSimulation = async () => {
    try {
      await signer.provider!.call({
        to: vaultAddress,
        data: callData,
        from: account,
        value: 0n,
      });
    } catch (simulationError: any) {
      const revertReason = simulationError?.reason || simulationError?.message || "Transaction will revert";
      throw new Error(`Deposit simulation failed: ${revertReason}. Please check token allowance and balance.`);
    }
  };

  await sendWalletTransaction({
    chainId,
    signer,
    to: vaultAddress as Address,
    callData,
    value: 0n,
    gasLimit: depositGasLimit,
    gasPriceData: multipliedGasPriceData,
    runSimulation,
    callback,
  });
}
