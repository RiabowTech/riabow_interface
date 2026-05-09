import cx from "classnames";
import React from "react";

import { Button } from "shared/ui/Button/Button";

import type { ModalZanbaraSize } from "./Modal";

export interface ModalZanbaraDefaultFooterProps {
  size: ModalZanbaraSize;
  onCancel: () => void;
  onConfirm: () => void;
  cancelLabel?: string;
  confirmLabel?: string;
}

/** Zanbara 第 11 章默认底栏：Secondary + Main · MainBtn 40（Small/Middle 160px，Big 200px） */
export function ModalZanbaraDefaultFooter({
  size,
  onCancel,
  onConfirm,
  cancelLabel = "Cancel",
  confirmLabel = "Confirm",
}: ModalZanbaraDefaultFooterProps) {
  const btnClass = cx("zanbara-popup__footer-btn", size === "big" && "zanbara-popup__footer-btn--big");
  return (
    <>
      <Button appearance="main-40" className={btnClass} intent="secondary" variant="secondary" onClick={onCancel}>
        {cancelLabel}
      </Button>
      <Button appearance="main-40" className={btnClass} intent="main" variant="primary" onClick={onConfirm}>
        {confirmLabel}
      </Button>
    </>
  );
}
