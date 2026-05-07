import styles from "./Checkbox.module.scss";

type Props = {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
};

export function Checkbox({ checked, onChange, label }: Props) {
  return (
    <label className={styles.wrap}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className={styles.nativeInput}
      />
      <span className={`${styles.box} ${checked ? styles.checked : ""}`}>
        <svg width="8" height="6" viewBox="0 0 8 6" stroke="currentColor" fill="none" className={styles.check}>
          <path d="M1 3L3 5L7 1" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className={styles.label}>{label}</span>
    </label>
  );
}
