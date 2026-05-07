import { Helmet } from "react-helmet";
import { useLocation } from "react-router-dom";

import { PRODUCTION_HOST } from "config/links";

/**
 * 默认站点元信息使用固定英文文案，不经过 Lingui catalog。
 * 链接预览（Telegram、Discord、Slack 等）抓取的就是这里写出去的 og/twitter 标签。
 */
const DEFAULT_SEO_TITLE = "Zanbara | Decentralized Derivatives Trading Platform";
const DEFAULT_SEO_DESCRIPTION =
  "Trade spot or perpetual BTC, ETH and other top cryptocurrencies with up to 100x leverage directly from your wallet on Arbitrum.";
const DEFAULT_SEO_KEYWORDS = "Zanbara, ZTDX, DeFi, crypto exchange, perpetuals, BTC, ETH, leverage, Arbitrum";

function SEO(props) {
  const { children, ...customMeta } = props;
  const { pathname, search } = useLocation();
  const origin = PRODUCTION_HOST.replace(/\/$/, "");
  const canonicalUrl = `${origin}${pathname}${search}`;

  const meta = {
    title: DEFAULT_SEO_TITLE,
    description: DEFAULT_SEO_DESCRIPTION,
    keywords: DEFAULT_SEO_KEYWORDS,
    image: `${origin}/og.png`,
    type: "exchange",
    ...customMeta,
  };
  return (
    <>
      <Helmet>
        <title>{meta.title}</title>
        <link rel="canonical" href={canonicalUrl} />
        <meta name="robots" content="follow, index" />
        <meta content={meta.description} name="description" />
        <meta content={meta.keywords} name="keywords" />
        <meta property="og:type" content={meta.type} />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:site_name" content="Zanbara" />
        <meta property="og:description" content={meta.description} />
        <meta property="og:title" content={meta.title} />
        <meta property="og:image" content={meta.image} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@Zanbara" />
        <meta name="twitter:title" content={meta.title} />
        <meta name="twitter:description" content={meta.description} />
        <meta name="twitter:image" content={meta.image} />
      </Helmet>
      {children}
    </>
  );
}

export default SEO;
