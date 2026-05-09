import { Trans } from "@lingui/macro";
import { useMemo, type ReactNode } from "react";

import ChartTokenSelector from "components/ChartTokenSelector/ChartTokenSelector";

import styles from "./SymbolBar.module.scss";
import { useMarketInfoAdapter } from "../../adapters/useMarketInfoAdapter";
import { formatFundingPct } from "../../utils/fundingFormat";
// 以下导入是旧自建 selector 的实现痕迹。当前直接复用 shared 的 ChartTokenSelector，
// 保留注释仅作为回退参考。
// import { useCallback } from "react";
// import { getNormalizedTokenSymbol } from "sdk/configs/tokens";
// import { SelectorBase } from "components/SelectorBase/SelectorBase";
// import TokenIcon from "components/TokenIcon/TokenIcon";
// import { MarketsDropdown } from "../MarketsDropdown/MarketsDropdown";

function fmt(n: number | null, d = 2, prefix = ""): string {
  if (n == null) return "-";
  return prefix + n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
}
function fmtPct(n: number | null, fixed = 2): string {
  if (n == null) return "-";
  return `${n >= 0 ? "" : ""}${n.toFixed(fixed)}%`;
}
function fmtCompactUsd(n: number | null): string {
  if (n == null) return "-";
  const abs = Math.abs(n);
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `$${(n / 1e3).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
}
function fmtCountdown(ts: number | null): string {
  if (ts == null) return "-";
  const diff = Math.max(0, ts - Date.now());
  const totalSec = Math.floor(diff / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  // 8 小时 funding 周期 → 倒计时上限 ~07:59:59;<1h 时省略小时段。
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
function Stat({
  label,
  value,
  cls,
  clickable,
}: {
  label: ReactNode;
  value: string;
  cls?: string;
  clickable?: boolean;
}) {
  return (
    <div className={styles.stat}>
      <div className={`${styles.label} ${clickable ? styles.labelLink : ""}`}>{label}</div>
      <div className={`${styles.value} ltr-mono ${cls ?? ""}`}>{value}</div>
    </div>
  );
}

export function SymbolBar() {
  const m = useMarketInfoAdapter();
  const changeCls = m.change24hPct == null ? "" : m.change24hPct >= 0 ? "ltr-up" : "ltr-down";

  // ---- 旧 SymbolBar 自建 selector 逻辑（已弃用，改为使用 interface_copy 的 ChartTokenSelector）----
  // const { selectedSymbol, setSelectedSymbol } = useTradeState();
  // const baseSymbol = useMemo(() => getNormalizedTokenSymbol(m.symbol.replace(/[-/]?USD[T]?$/i, "")), [m.symbol]);
  // /** 主/次符号排版与 Zanbara 市场选择器一致：`BASE/QUOTE [BASE-USDT]` */
  // const displayPair = useMemo(() => {
  //   const quote = (selectedSymbol?.split("-")[1] ?? "USD").toUpperCase();
  //   return `${baseSymbol}/${quote}`;
  // }, [selectedSymbol, baseSymbol]);
  // const instId = useMemo(() => `${baseSymbol}-USDT`, [baseSymbol]);
  // const handleSelectMarket = useCallback(
  //   (symbol: string) => setSelectedSymbol(symbol),
  //   [setSelectedSymbol]
  // );

  // 读一次 baseSymbol 是为了让 useMarketInfoAdapter 的订阅在本组件里仍然触发；
  // 显示逻辑已交给 ChartTokenSelector（内部会自行读取当前选中的交易标的）
  useMemo(() => m.symbol, [m.symbol]);

  return (
    <div className={styles.wrapper}>
      <div className={styles.root}>
        {/* 旧 <SelectorBase>...<MarketsDropdown /></SelectorBase> 已注释。
            当前直接复用 ChartTokenSelector，由它负责读取当前交易标的并渲染
            「TokenIcon + BASE/USD + [BASE-USDT] + chevron」布局。 */}
        <ChartTokenSelector selectedToken={undefined} oneRowLabels={true} />

        <div className={styles.stats}>
          <Stat label={<Trans>Mark Price</Trans>} value={fmt(m.markPrice, 1)} clickable />
          <Stat label={<Trans>Index Price</Trans>} value={fmt(m.indexPrice, 1)} clickable />
          <Stat label={<Trans>24h Change</Trans>} value={fmtPct(m.change24hPct)} cls={changeCls} />
          <Stat label={<Trans>24h Volume</Trans>} value={fmtCompactUsd(m.volume24hUsd)} />
          <Stat label={<Trans>Open Interest</Trans>} value={fmtCompactUsd(m.openInterestUsd)} clickable />
          <div className={styles.fundingGroup}>
            <span className={`${styles.corner} ${styles.cornerTL}`} />
            <span className={`${styles.corner} ${styles.cornerTR}`} />
            <span className={`${styles.corner} ${styles.cornerBL}`} />
            <span className={`${styles.corner} ${styles.cornerBR}`} />
            <Stat label={<Trans>1hr Funding</Trans>} value={formatFundingPct(m.funding1hPct, 4)} clickable />
            <Stat label={<Trans>Next Funding</Trans>} value={fmtCountdown(m.nextFundingTs)} />
          </div>
        </div>
      </div>
    </div>
  );
}
