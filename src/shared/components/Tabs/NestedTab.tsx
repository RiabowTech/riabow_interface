import { FloatingPortal, autoUpdate, flip, shift, useFloating } from "@floating-ui/react";
import { Menu } from "@headlessui/react";
import { t } from "@lingui/macro";
import cx from "classnames";

import Button from "components/Button/Button";

import ChevronDownIcon from "img/ic_chevron_down.svg?react";
import ChevronUpIcon from "img/ic_chevron_up.svg?react";

import { NestedOption } from "./types";

type Props<V extends string | number> = {
  option: NestedOption<V>;
  selectedValue: V | undefined;
  commonOptionClassname?: string;
  onOptionClick: ((value: V) => void) | undefined;
  qa?: string;
};

export default function NestedTab<V extends string | number>({
  option,
  selectedValue,
  commonOptionClassname,
  onOptionClick,
  qa,
}: Props<V>) {
  const { refs, floatingStyles } = useFloating({
    middleware: [flip(), shift()],
    placement: "bottom-end",
    whileElementsMounted: autoUpdate,
  });

  const selectedSubOption = option.options.find((opt) => opt.value === selectedValue);

  const label = selectedSubOption ? selectedSubOption.label || selectedSubOption.value : t`More`;

  return (
    <Menu as="div" className="nested-tab-wrapper">
      {({ open }) => (
        <>
          <div ref={refs.setReference} data-qa={qa ? `${qa}-tab-${option.label}` : undefined}>
            <Menu.Button as="div">
              <Button variant="ghost" className={cx("nested-tab-button", { "nested-tab-button--active": selectedSubOption || open })}>
                <span className={cx({ "nested-tab-label--active": selectedSubOption || open })}>{label}</span>
                {open ? (
                  <ChevronUpIcon className="nested-tab-icon nested-tab-icon--up" />
                ) : (
                  <ChevronDownIcon className="nested-tab-icon" />
                )}
              </Button>
            </Menu.Button>
          </div>
          <FloatingPortal>
            <Menu.Items
              as="div"
              className="nested-tab-dropdown"
              ref={refs.setFloating}
              style={floatingStyles}
            >
              {option.options.map((subOpt) => {
                return (
                  <Menu.Item
                    as="div"
                    key={subOpt.value}
                    className={cx(
                      "nested-tab-item",
                      { "nested-tab-item--active": subOpt.value === selectedValue },
                      commonOptionClassname
                    )}
                    onClick={() => onOptionClick?.(subOpt.value)}
                  >
                    {subOpt.label ?? subOpt.value}
                  </Menu.Item>
                );
              })}
            </Menu.Items>
          </FloatingPortal>
        </>
      )}
    </Menu>
  );
}
