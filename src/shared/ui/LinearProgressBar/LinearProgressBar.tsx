import { useMemo, type CSSProperties } from "react";

export type LinearProgressBarProps = {
  value: number;
  max: number;
  className?: string;
  trackClassName?: string;
  fillClassName?: string;
};

function clampPercent(value: number, max: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return 0;
  return Math.min(100, Math.max(0, (value / max) * 100));
}

export function LinearProgressBar({ value, max, className, trackClassName, fillClassName }: LinearProgressBarProps) {
  const pct = clampPercent(value, max);
  const fillStyle = useMemo((): CSSProperties => ({ width: `${pct}%` }), [pct]);

  return (
    <div className={className}>
      <div className={trackClassName}>
        <div className={fillClassName} style={fillStyle} />
      </div>
    </div>
  );
}
