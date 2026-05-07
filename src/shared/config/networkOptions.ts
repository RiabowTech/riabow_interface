import {
  ARBITRUM,
  ARBITRUM_SEPOLIA,
  getChainName,
} from "config/chains";
import { isDevelopment } from "config/env";
import { getChainIcon } from "config/icons";

export type NetworkOption = {
  label: string;
  value: number;
  icon: string;
  color: string;
};

export const NETWORK_OPTIONS: NetworkOption[] = [
  {
    label: getChainName(ARBITRUM),
    value: ARBITRUM,
    icon: getChainIcon(ARBITRUM),
    color: "#264f79",
  },
];

if (isDevelopment()) {
  NETWORK_OPTIONS.push({
    label: getChainName(ARBITRUM_SEPOLIA),
    value: ARBITRUM_SEPOLIA,
    icon: getChainIcon(ARBITRUM_SEPOLIA),
    color: "#0052ff",
  });
}
