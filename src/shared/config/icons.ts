import {
  AnyChainId,
  ARBITRUM,
  ARBITRUM_SEPOLIA,
  AVALANCHE,
  AVALANCHE_FUJI,
  BOTANIX,
  SOURCE_BASE_MAINNET,
  SOURCE_BSC_MAINNET,
  SOURCE_OPTIMISM_SEPOLIA,
  SOURCE_SEPOLIA,
} from "config/chains";

import gmIcon from "img/gm_icon.svg";
import bsc from "img/ic_bsc.svg";
import gmArbitrum from "img/ic_gm_arbitrum.svg";
import gmAvax from "img/ic_gm_avax.svg";
import arbitrum from "img/tokens/ic_arbitrum.svg";
import arbitrumSepolia from "img/tokens/ic_arbitrum_sepolia.svg";
import avalanche from "img/tokens/ic_avalanche.svg";
import avalancheTestnet from "img/tokens/ic_avalanche_testnet.svg";
import base from "img/tokens/ic_base.svg";
import botanix from "img/tokens/ic_botanix.svg";
import glvIcon from "img/tokens/ic_glv.svg";
import protocolTokenIcon from "img/tokens/ic_zanbara.svg";
import optimismSepolia from "img/tokens/ic_op.svg";
import sepolia from "img/tokens/ic_sepolia.svg";

type ChainIcons = {
  network?: string;
  gm: string;
  glv?: string;
};

const ICONS: Record<number | "common", ChainIcons> = {
  [ARBITRUM]: {
    network: arbitrum,
    gm: gmArbitrum,
  },
  [ARBITRUM_SEPOLIA]: {
    network: arbitrumSepolia,
    gm: gmArbitrum,
  },
  [AVALANCHE]: {
    network: avalanche,
    gm: gmAvax,
  },
  [AVALANCHE_FUJI]: {
    network: avalancheTestnet,
    gm: gmAvax,
  },
  [BOTANIX]: {
    network: botanix,
    gm: gmIcon,
  },
  common: {
    gm: gmIcon,
    glv: glvIcon,
  },
};

export const CHAIN_ID_TO_NETWORK_ICON: Record<AnyChainId | 0, string> = {
  [ARBITRUM]: arbitrum,
  [AVALANCHE]: avalanche,
  0: protocolTokenIcon,
  [SOURCE_BASE_MAINNET]: base,
  [AVALANCHE_FUJI]: avalancheTestnet,
  [ARBITRUM_SEPOLIA]: arbitrumSepolia,
  [SOURCE_OPTIMISM_SEPOLIA]: optimismSepolia,
  [SOURCE_SEPOLIA]: sepolia,
  [BOTANIX]: botanix,
  [SOURCE_BSC_MAINNET]: bsc,
};

/**
 * For chain icons use `getChainIcon`
 */
export function getIcon(chainId: number | "common", label: keyof ChainIcons) {
  if (!chainId || !(chainId in ICONS)) {
    throw new Error(`No icons found for chain: ${chainId}`);
  }

  return ICONS[chainId][label];
}

export function getChainIcon(chainId: number): string {
  if (!(chainId in CHAIN_ID_TO_NETWORK_ICON)) {
    throw new Error(`No icon found for chain: ${chainId}`);
  }

  return CHAIN_ID_TO_NETWORK_ICON[chainId];
}

export function getIcons(chainId: number | "common") {
  if (!chainId || !(chainId in ICONS)) {
    throw new Error(`No icons found for chain: ${chainId}`);
  }

  return ICONS[chainId];
}
