// Minimal ethers v6 compatible typechain factories
// These export ABIs and connect functions compatible with the original typechain interface

import { Contract, InterfaceAbi, ContractRunner } from "ethers";
import DataStoreAbi from "sdk/abis/DataStore";
import ExchangeRouterAbi from "sdk/abis/ExchangeRouter";
import MulticallAbi from "sdk/abis/Multicall";
import GlvRouterAbi from "sdk/abis/GlvRouter";

function createFactory<T>(abi: InterfaceAbi) {
  return {
    abi,
    connect: (address: string, runner?: ContractRunner): T => {
      return new Contract(address, abi, runner) as unknown as T;
    },
  };
}

export const DataStore__factory = createFactory(DataStoreAbi as InterfaceAbi);
export const ExchangeRouter__factory = createFactory(ExchangeRouterAbi as InterfaceAbi);
export const Multicall3__factory = createFactory(MulticallAbi as InterfaceAbi);
export const GlvRouter__factory = createFactory(GlvRouterAbi as InterfaceAbi);
