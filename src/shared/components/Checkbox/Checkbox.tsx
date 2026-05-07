import cx from "classnames";
import { ReactNode } from "react";

import CheckIcon from "img/ic_check.svg?react";
import MinusIcon from "img/ic_minus.svg?react";
import "./Checkbox.css";

type Props = {
  isChecked?: boolean;
  setIsChecked?: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  children?: ReactNode;
  asRow?: boolean;
  isPartialChecked?: boolean;
  qa?: string;
};

export default function Checkbox(props: Props) {
  const { isChecked, setIsChecked, disabled, className, asRow, isPartialChecked } = props;

  return (
    <button
      className={cx(
        "checkbox-wrapper group flex items-center gap-8",
        { disabled, selected: isChecked, fullRow: asRow, noLabel: !props.children },
        className
      )}
      onClick={(event) => {
        setIsChecked?.(!isChecked);
        event.stopPropagation();
      }}
      disabled={disabled}
      data-qa={props.qa}
    >
      <span
        className={cx(
          "checkbox-box",
          {
            checked: isChecked && !isPartialChecked,
            "partial-checked": isPartialChecked,
            disabled: disabled,
          }
        )}
      >
        {isChecked && !isPartialChecked && <CheckIcon className="size-11" />}
        {isPartialChecked && <MinusIcon className="size-11" />}
      </span>
      {props.children && props.children}
    </button>
  );
}
