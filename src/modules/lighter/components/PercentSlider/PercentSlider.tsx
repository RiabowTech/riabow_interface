import { useCallback, useEffect, useRef } from "react";
import styles from "./PercentSlider.module.scss";

type Props = {
  value: number; // 0-100
  onChange: (v: number) => void;
  side: "buy" | "sell";
};

// 4 tall ticks at 25/50/75 (plus 0/100 endpoints), 3 short dots between each → 5 tall + 12 short = 17
const TICKS = Array.from({ length: 17 }, (_, i) => i % 4 === 0);

export function PercentSlider({ value, onChange, side }: Props) {
  const trackRef = useRef<HTMLSpanElement>(null);
  const draggingRef = useRef(false);

  const commitFromPointer = useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const pct = Math.max(0, Math.min(100, Math.round(((clientX - r.left) / r.width) * 100)));
      onChange(pct);
    },
    [onChange]
  );

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (draggingRef.current) commitFromPointer(e.clientX);
    };
    const onUp = () => {
      draggingRef.current = false;
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, [commitFromPointer]);

  const clamped = Math.max(0, Math.min(100, value));
  const sideClass = side === "buy" ? styles.buy : styles.sell;

  return (
    <div className={styles.wrap}>
      <span
        ref={trackRef}
        className={styles.slider}
        onMouseDown={(e) => {
          draggingRef.current = true;
          commitFromPointer(e.clientX);
        }}
      >
        <span className={styles.track}>
          <div className={styles.ticks}>
            {TICKS.map((tall, i) => (
              <div key={i} className={tall ? styles.tallTick : styles.dotTick} />
            ))}
          </div>
          <span className={styles.range} style={{ right: `${100 - clamped}%` }}>
            <span className={`${styles.fill} ${sideClass}`} />
          </span>
          <div className={styles.steps}>
            {[25, 50, 75].map((p) => (
              <button
                key={p}
                type="button"
                aria-label={`Set slider value to ${p}`}
                className={styles.stepBtn}
                style={{ left: `${p}%` }}
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(p);
                }}
              />
            ))}
          </div>
        </span>
        <span className={styles.thumbWrap} style={{ left: `calc(${clamped}% + 3px)` }}>
          <span
            role="slider"
            aria-label="Slider Thumb"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={clamped}
            aria-orientation="horizontal"
            tabIndex={0}
            className={`${styles.thumb} ${sideClass}`}
          />
        </span>
      </span>
      <div className={styles.inputBox}>
        <input
          className={styles.input}
          value={Math.round(clamped)}
          inputMode="numeric"
          onChange={(e) => {
            const n = Number(e.target.value.replace(/[^0-9]/g, ""));
            if (!Number.isNaN(n)) onChange(Math.max(0, Math.min(100, n)));
          }}
        />
        %
      </div>
    </div>
  );
}
