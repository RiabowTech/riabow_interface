import { getChainId, switchChain } from "@wagmi/core";

import { SELECTED_NETWORK_LOCAL_STORAGE_KEY } from "config/localStorage";
import { getChainName } from "sdk/configs/chains";
import { helperToast } from "lib/helperToast";
import { UncheckedJsonRpcSigner } from "lib/rpc/UncheckedJsonRpcSigner";

import { getRainbowKitConfig } from "./rainbowKitConfig";

export type NetworkMetadata = {
  chainId: string;
  chainName: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrls: string[];
  blockExplorerUrls: string[];
};

export type WalletSigner = UncheckedJsonRpcSigner & {
  address: string;
};

export async function switchNetwork(chainId: number, active: boolean): Promise<void> {
  if (active) {
    try {
      const config = getRainbowKitConfig();
      
      // Get actual chain ID from wallet, not from wagmi config
      let walletChainId: number | null = null;
      if (window.ethereum) {
        try {
          const chainIdHex = await window.ethereum.request({
            method: "eth_chainId",
          }) as string;
          walletChainId = parseInt(chainIdHex, 16);
        } catch (e) {
          console.warn("[switchNetwork] Failed to get wallet chainId:", e);
        }
      }
      
      // Also get chainId from wagmi config for comparison
      const wagmiChainId = getChainId(config);
      
      // If wallet is already on the target chain, no need to switch
      if (walletChainId === chainId) {
        return;
      }
      
      // Use window.ethereum directly to ensure wallet popup appears
      if (window.ethereum) {
        // Format chainId as hex string (e.g., 42161 -> "0xa4b1", 421614 -> "0x66eee")
        const chainIdHex = `0x${chainId.toString(16)}`;
        
        try {
          // First try to switch using wallet_switchEthereumChain
          // This will show a popup in MetaMask asking user to confirm the switch
          const result = await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: chainIdHex }],
          });
          
          // Show user feedback that chain switch was successful
          // Note: MetaMask may not always show a popup if the chain is already added
          // or if user has previously allowed automatic switching
          const chainName = getChainName(chainId);
          helperToast.success(`Switched to ${chainName}`);
        } catch (switchError: any) {
          
          // If the chain is not added, error code 4902 means the chain is not added
          if (switchError.code === 4902 || switchError.code === -32603) {
            // Get chain info from wagmi config
            const chains = config.chains;
            const targetChain = chains.find((chain) => chain.id === chainId);
            
            if (targetChain) {
              // Prepare RPC URLs - handle both array and object formats
              let rpcUrls: string[] = [];
              if (Array.isArray(targetChain.rpcUrls.default.http)) {
                rpcUrls = targetChain.rpcUrls.default.http;
              } else if (typeof targetChain.rpcUrls.default.http === 'string') {
                rpcUrls = [targetChain.rpcUrls.default.http];
              }
              
              // Prepare block explorer URLs
              const blockExplorerUrls: string[] = [];
              if (targetChain.blockExplorers?.default?.url) {
                blockExplorerUrls.push(targetChain.blockExplorers.default.url);
              }
              
              // Add the chain using wallet_addEthereumChain
              // This will show a popup in MetaMask asking user to add the chain
              await window.ethereum.request({
                method: "wallet_addEthereumChain",
                params: [
                  {
                    chainId: chainIdHex,
                    chainName: targetChain.name,
                    nativeCurrency: {
                      name: targetChain.nativeCurrency.name,
                      symbol: targetChain.nativeCurrency.symbol,
                      decimals: targetChain.nativeCurrency.decimals,
                    },
                    rpcUrls: rpcUrls,
                    blockExplorerUrls: blockExplorerUrls,
                  },
                ],
              });
              
              // After adding, try to switch again
              await window.ethereum.request({
                method: "wallet_switchEthereumChain",
                params: [{ chainId: chainIdHex }],
              });
            } else {
              // Fallback to wagmi switchChain if chain not found in config
              await switchChain(config, { chainId });
            }
          } else if (switchError.code === 4001) {
            // User rejected the request
            throw new Error("User rejected the chain switch");
          } else {
            // Other error, re-throw
            console.error("[switchNetwork] Unexpected error:", switchError);
            throw switchError;
          }
        }
      } else {
        // Fallback to wagmi switchChain if window.ethereum is not available
        await switchChain(config, {
          chainId,
        });
      }
      
      localStorage.setItem(SELECTED_NETWORK_LOCAL_STORAGE_KEY, String(chainId));
      document.dispatchEvent(new CustomEvent("networkChange", { detail: { chainId } }));
    } catch (error: any) {
      console.error("[switchNetwork] Failed to switch chain:", error);
      // Re-throw the error so the UI can handle it
      throw error;
    }
  } else {
    // chainId in localStorage allows to switch network even if wallet is not connected
    // or there is no wallet at all
    localStorage.setItem(SELECTED_NETWORK_LOCAL_STORAGE_KEY, String(chainId));
    document.dispatchEvent(new CustomEvent("networkChange", { detail: { chainId } }));
    document.location.reload();
    return;
  }
}

export function shortenAddressOrEns(address: string, length: number) {
  if (!length) {
    return "";
  }
  if (!address) {
    return address;
  }
  if (address.length < 10 || address.length < length) {
    return address;
  }
  let left = address.includes(".") ? address.split(".")[1].length : Math.floor((length - 3) / 2) + 1;
  return address.substring(0, left) + "..." + address.substring(address.length - (length - (left + 3)), address.length);
}
