import cx from "classnames";
import { useCallback, type ReactNode } from "react";

type Props = {
  isChecked: boolean | undefined;
  setIsChecked: (value: boolean) => void;
  className?: string;
  textClassName?: string;
  children?: ReactNode;
  beforeSwitchContent?: ReactNode;
  disabled?: boolean;
};

export default function ToggleSwitch({
  isChecked,
  setIsChecked,
  className,
  disabled,
  children,
  textClassName,
  beforeSwitchContent,
}: Props) {
  const handleToggle = useCallback(() => {
    if (disabled) {
      return;
    }

    setIsChecked(!isChecked);
  }, [disabled, isChecked, setIsChecked]);

  return (
    <div className={cx("inline-flex w-full items-center justify-between gap-8", className)}>
      <span className={textClassName}>{children}</span>
      <div className="flex items-center gap-8">
        {beforeSwitchContent}
        <div
          className={cx("group relative w-36 h-20 cursor-pointer rounded-full border-2 transition-colors duration-200", {
            "border-[#00FFB2] bg-[#4A4A4A]": isChecked,
            "border-slate-600 bg-[#4A4A4A]": !isChecked,
            "pointer-events-none opacity-50": disabled,
          })}
          onClick={handleToggle}
        >
          <div
            className="h-14 w-14 rounded-full absolute top-1/2 left-0.5"
            style={{
              // 只做左右滑动动画，不做淡入淡出
              transform: isChecked ? "translate(16px, -50%)" : "translate(0px, -50%)",
              transition: "transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)",
              background: !isChecked
                ? "radial-gradient(circle at 30% 30%, rgba(255,255,255,1) 0%, rgba(240,240,240,1) 100%)"
                : "#00FFB2",
              boxShadow: !isChecked ? "0px 2px 4px rgba(0,0,0,0.2)" : "0 0 8px rgba(0,255,178,0.6)",
            }}
          />
        </div>
      </div>
    </div>
  );
}
