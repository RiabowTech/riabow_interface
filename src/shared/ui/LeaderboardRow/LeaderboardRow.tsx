import cx from "classnames";

export type LeaderboardRowProps = {
  rank: number | string;
  rankClassName?: string;
  address: string;
  addressTitle?: string;
  points: string;
  isCurrent?: boolean;
  className?: string;
};

export function LeaderboardRow({
  rank,
  rankClassName,
  address,
  addressTitle,
  points,
  isCurrent = false,
  className,
}: LeaderboardRowProps) {
  return (
    <div className={cx("pd-lb-row", { "is-self": isCurrent }, className)}>
      <span className={cx("pd-lb-row__rank", rankClassName)}>{rank}</span>
      <span className="pd-lb-row__addr" title={addressTitle ?? address}>
        {address}
      </span>
      <span className="pd-lb-row__pts">{points}</span>
    </div>
  );
}
