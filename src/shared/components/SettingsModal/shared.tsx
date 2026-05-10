import cx from "classnames";
import { Fragment, ReactNode } from "react";

import PercentageInput from "components/PercentageInput/PercentageInput";
import TooltipWithPortal from "components/Tooltip/TooltipWithPortal";
import { ValueInput } from "components/ValueInput/ValueInput";

import CheckIcon from "img/ic_check.svg?react";

export enum TradingMode {
  Classic = "classic",
  Express = "express",
  Express1CT = "express-1ct",
}

export function SettingsSection({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <div className={cx("settings-section", className)}>{children}</div>;
}

export function InputSetting({
  title,
  description,
  defaultValue,
  value,
  maxValue,
  onChange,
  onBlur,
  className,
  suggestions,
  type = "percentage",
}: {
  title: ReactNode;
  description?: ReactNode;
  defaultValue: number;
  value?: number;
  maxValue?: number;
  onChange: (value: number) => void;
  onBlur?: () => void;
  className?: string;
  suggestions?: number[];
  type?: "percentage" | "number";
}) {
  const titleComponent = <span className="text-14 font-medium">{title}</span>;

  const titleWithDescription = description ? (
    <TooltipWithPortal position="bottom" content={description} variant="icon">
      {titleComponent}
    </TooltipWithPortal>
  ) : (
    titleComponent
  );

  const Input =
    type === "percentage" ? (
      <PercentageInput
        defaultValue={defaultValue}
        value={value}
        maxValue={maxValue}
        onChange={onChange}
        tooltipPosition="bottom"
        suggestions={suggestions}
      />
    ) : (
      <ValueInput value={value ?? 0} onChange={onChange} onBlur={onBlur} className="w-[80px]" />
    );

  return (
    <div className={cx("flex items-center justify-between", className)}>
      <div className="mr-8">{titleWithDescription}</div>
      {Input}
    </div>
  );
}

export function SettingButton({
  title,
  icon,
  description,
  onClick,
  active,
  chip,
  info,
  disabled,
  disabledTooltip,
}: {
  title: ReactNode;
  icon: ReactNode;
  description: ReactNode;
  active?: boolean;
  chip?: ReactNode;
  onClick: () => void;
  info?: ReactNode;
  disabled?: boolean;
  disabledTooltip?: ReactNode;
}) {
  const Wrapper = disabled && disabledTooltip ? TooltipWithPortal : Fragment;

  return (
    <Wrapper content={disabledTooltip} variant="none">
      <div
        className={cx(
          "settings-mode-card",
          active && "is-active",
          disabled ? "muted cursor-not-allowed" : "cursor-pointer"
        )}
        onClick={disabled ? undefined : onClick}
      >
        <div className={cx("settings-mode-card__icon", disabled && "opacity-50")}>
          {icon}
        </div>
        <div className="settings-mode-card__content">
          <div className="settings-mode-card__title-row">
            <div className="settings-mode-card__title">
              {title}
              {info && (
                <TooltipWithPortal
                  content={info}
                  handleClassName=""
                  variant="icon"
                  className="flex items-center"
                  handle={<span className="inline-flex items-center" />}
                />
              )}
            </div>
            {chip ? <div className="settings-mode-card__chip">{chip}</div> : null}
          </div>
          <div className="settings-mode-card__description">{description}</div>
        </div>
        {active && (
          <div className="settings-mode-card__check">
            <CheckIcon />
          </div>
        )}
      </div>
    </Wrapper>
  );
}

export function Chip({ children, color }: { children: ReactNode; color: "blue" | "gray" }) {
  const colorClass = {
    blue: "bg-blue-600",
    gray: "bg-slate-500",
  }[color];

  return (
    <div className={cx(`rounded-full px-8 py-4 pb-3 text-[10px] font-medium text-white`, colorClass)}>{children}</div>
  );
}
