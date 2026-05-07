import cx from "classnames";

import { BigTab } from "shared/ui/BigTab";

import Button from "components/Button/Button";

import { RegularOption } from "./types";

type Props<V extends string | number> = {
  option: RegularOption<V>;
  selectedValue: V | undefined;
  onOptionClick: ((value: V) => void) | undefined;
  regularOptionClassname?: string;
  qa?: string;
  type: "inline" | "block" | "inline-primary" | "primit-big-tab";
  dataTabValue?: V;
};

export default function RegularTab<V extends string | number>({
  option,
  selectedValue,
  onOptionClick,
  regularOptionClassname,
  qa,
  type,
  dataTabValue,
}: Props<V>) {
  const isActive = option.value === selectedValue;
  const label = option.label || option.value;
  const optionClassName = isActive ? option.className?.active : option.className?.regular;

  if (type === "inline-primary") {
    return (
      <Button
        variant={isActive ? "primary" : "secondary"}
        onClick={() => onOptionClick?.(option.value)}
        key={option.value}
        data-qa={qa ? `${qa}-tab-${option.value}` : undefined}
        className={cx(optionClassName, regularOptionClassname)}
      >
        {option.icon && <span className="mt-2 scale-75 opacity-70">{option.icon}</span>}
        {label}
      </Button>
    );
  }

  if (type === "inline") {
    return (
      <Button
        variant={isActive ? "secondary" : "ghost"}
        onClick={() => onOptionClick?.(option.value)}
        key={option.value}
        data-qa={qa ? `${qa}-tab-${option.value}` : undefined}
        className={cx(optionClassName, regularOptionClassname, {
          "!text-typography-primary": isActive,
        })}
      >
        {option.icon && <span className="mt-2 scale-75 opacity-70">{option.icon}</span>}
        {label}
      </Button>
    );
  }

  if (type === "primit-big-tab") {
    return (
      <BigTab
        key={option.value}
        type="button"
        selected={isActive}
        className={cx("min-w-0 flex-1 shrink-0", optionClassName, regularOptionClassname)}
        data-qa={qa ? `${qa}-tab-${option.value}` : undefined}
        data-tab-value={String(dataTabValue ?? option.value)}
        onClick={() => onOptionClick?.(option.value)}
      >
        {option.icon && <span className="mr-4 inline-flex opacity-70">{option.icon}</span>}
        {label}
      </BigTab>
    );
  }

  return (
    <button
      className={cx(
        `relative -mb-[0.5px] flex items-baseline justify-center gap-8 border-b-[2.5px] border-b-[transparent] px-20 pb-9 pt-11
        font-medium text-typography-secondary first:rounded-tl-8 last:rounded-tr-8 hover:text-typography-primary`,
        optionClassName,
        regularOptionClassname,
        {
          "tab-active-green": isActive,
        }
      )}
      onClick={() => onOptionClick?.(option.value)}
      key={option.value}
      data-qa={qa ? `${qa}-tab-${option.value}` : undefined}
      data-tab-value={dataTabValue ?? option.value}
    >
      {option.icon && <span className="mt-2 scale-75 opacity-70">{option.icon}</span>}
      {label}
    </button>
  );
}
