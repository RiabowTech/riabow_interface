import { ReactNode } from "react";

import DiscordIcon from "img/ic_discord.svg?react";
import SubstackIcon from "img/ic_substack.svg?react";
import TelegramIcon from "img/ic_telegram.svg?react";
import XIcon from "img/ic_x.svg?react";

type Link = {
  label: ReactNode;
  link: string;
  external?: boolean;
  isAppLink?: boolean;
};

type SocialLink = {
  link: string;
  name: string;
  icon: React.ReactNode;
};

export const getFooterLinks = (): Link[] => [
  // { label: "Media Kit", link: "#", external: true },
  // { label: "Charts by TradingView", link: "https://www.tradingview.com/", external: true },
];

export const SOCIAL_LINKS: SocialLink[] = [
  { link: "https://x.com/", name: "Twitter", icon: <XIcon className="size-16" /> },
  { link: "#", name: "Telegram", icon: <TelegramIcon className="size-16" /> },
  { link: "#", name: "Discord", icon: <DiscordIcon className="size-16" /> },
];
