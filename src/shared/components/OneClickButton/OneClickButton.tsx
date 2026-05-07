import cx from "classnames";

import Button from "components/Button/Button";

// import OneClickIcon from "img/ic_one_click.svg?react";
import SettingsIcon from "img/ic_settings.svg?react";

type Props = {
  openSettings: () => void;
  className?: string;
};

export function OneClickButton({ openSettings, className }: Props) {
  return (
    <Button
      variant="secondary"
      size="icon"
      onClick={openSettings}
      className={cx("max-md:!h-32 max-md:!min-h-[32px] max-md:!w-32 max-md:!min-w-[32px]", className)}
    >
      <SettingsIcon className="size-20 p-0" />
    </Button>
  );
}
