import cx from "classnames";
import { t } from "@lingui/macro";
import { useLingui } from "@lingui/react";
import { AnimatePresence, Variants, motion } from "framer-motion";
import React, {
  PropsWithChildren,
  ReactNode,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
} from "react";
import { RemoveScroll } from "react-remove-scroll";

import CloseIcon from "img/ic_close.svg?react";

import "./Modal.css";

const FADE_VARIANTS: Variants = {
  hidden: { opacity: 0, pointerEvents: "none" },
  visible: { opacity: 1, pointerEvents: "auto" },
};

const VISIBLE_STYLES: React.CSSProperties = {
  overflow: "hidden",
  position: "fixed",
};

const HIDDEN_STYLES: React.CSSProperties = {
  overflow: "visible",
  position: "fixed",
};

const TRANSITION = { duration: 0.2 };

export type ModalZanbaraSize = "small" | "middle" | "big";

export type ModalProps = PropsWithChildren<{
  className?: string;
  isVisible?: boolean;
  setIsVisible: (isVisible: boolean) => void;
  zIndex?: number;
  label?: React.ReactNode;
  headerContent?: React.ReactNode;
  footerContent?: ReactNode;
  onAfterOpen?: () => void;
  /**
   * If false, you need to add padding and spacing to the children yourself.
   */
  contentPadding?: boolean;
  qa?: string;
  contentClassName?: string;
  disableOverflowHandling?: boolean;
  withMobileBottomPosition?: boolean;
  /**
   * - **`zanbara`（默认）**：第 11 章 Popup_PC — 炭底直角、85% 遮罩；业务无需再手写 `variant`。
   * - **`default`**：历史圆角 + 浅灰遮罩；仅旧版式或特殊布局时使用。
   */
  variant?: "default" | "zanbara";
  /** `variant="zanbara"` 且存在 `label` 时用于 `aria-labelledby`；省略则内部 `useId` */
  zanbaraDialogTitleId?: string;
  /** `variant="zanbara"` 时稿面 Small / Middle / Big；默认 **small**（高度随内容，不锁 400px） */
  zanbaraSize?: ModalZanbaraSize;
  /** `variant="zanbara"` 时在正文外包一层 `.zanbara-popup__body`，可叠稿面占位等 class */
  zanbaraBodyClassName?: string;
}>;

/**
 * @deprecated 请改为从 `shared/ui` 引入：`import { Modal } from "shared/ui"`.
 * 当前文件保留为兼容层，避免历史引用立即中断。
 */
export default function Modal({
  className,
  isVisible,
  label,
  zIndex,
  children,
  headerContent,
  footerContent,
  contentPadding = true,
  onAfterOpen,
  setIsVisible,
  qa,
  contentClassName,
  disableOverflowHandling = false,
  withMobileBottomPosition = false,
  variant = "zanbara",
  zanbaraDialogTitleId,
  zanbaraSize = "small",
  zanbaraBodyClassName = "",
}: ModalProps) {
  const { i18n } = useLingui();
  const modalRef = useRef<HTMLDivElement | null>(null);
  const generatedZanbaraTitleId = useId();

  useEffect(() => {
    function close(e: KeyboardEvent) {
      if (e.key === "Escape" && setIsVisible) {
        setIsVisible(false);
      }
    }
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [setIsVisible]);

  useEffect(() => {
    if (typeof onAfterOpen === "function") onAfterOpen();
  }, [onAfterOpen]);

  useEffect(
    function blurOutsideOnVisible() {
      if (isVisible) {
        const focusedElement = document.activeElement;
        const isNotBody = !document.body.isSameNode(focusedElement);
        const isOutside = !modalRef.current?.contains(focusedElement);

        if (focusedElement && isNotBody && isOutside) {
          (focusedElement as HTMLElement).blur();
        }
      }
    },
    [isVisible],
  );

  const isZanbara = variant === "zanbara";
  const showZanbaraTitle = Boolean(label);
  const effectiveContentPadding = isZanbara ? false : contentPadding;
  const zanbaraTitleId =
    isZanbara && showZanbaraTitle ? (zanbaraDialogTitleId ?? generatedZanbaraTitleId) : undefined;

  const mergedContentClassName = useMemo(() => {
    if (!isZanbara) return contentClassName;
    return cx(
      "zanbara-popup-panel",
      zanbaraSize === "small" && "zanbara-popup-panel--small",
      zanbaraSize === "middle" && "zanbara-popup-panel--middle",
      zanbaraSize === "big" && "zanbara-popup-panel--big",
      contentClassName,
    );
  }, [isZanbara, zanbaraSize, contentClassName]);

  const showZanbaraBody =
    isZanbara &&
    (children != null || (typeof zanbaraBodyClassName === "string" && zanbaraBodyClassName.trim() !== ""));

  const bodyChildren = showZanbaraBody ? (
    <div className={cx("zanbara-popup__body", zanbaraBodyClassName)}>{children}</div>
  ) : (
    children
  );

  const modalStyle = useMemo(
    () => ({ zIndex: zIndex ?? (isZanbara ? 1200 : undefined) }),
    [zIndex, isZanbara],
  );

  const stopPropagation = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  return (
    <AnimatePresence>
      {isVisible && (
        <RemoveScroll>
          <motion.div
            className={cx(
              "Modal",
              className,
              isZanbara && "Modal--zanbara-popup",
              { "max-md:!items-end": withMobileBottomPosition },
            )}
            ref={modalRef}
            style={modalStyle}
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={FADE_VARIANTS}
            transition={TRANSITION}
          >
            <div
              className="Modal-backdrop"
              style={isVisible ? VISIBLE_STYLES : HIDDEN_STYLES}
              onClick={() => setIsVisible(false)}
            />

            <div
              className={cx(
                "Modal-content flex flex-col",
                {
                  "gap-16": effectiveContentPadding,
                  "max-md:w-full max-md:!rounded-t-0": withMobileBottomPosition,
                },
                mergedContentClassName,
              )}
              onClick={stopPropagation}
              data-qa={qa}
              role={isZanbara ? "dialog" : undefined}
              aria-modal={isZanbara ? true : undefined}
              aria-labelledby={zanbaraTitleId}
            >
              <div
                className={cx(
                  "Modal-header-wrapper flex flex-col gap-8",
                  isZanbara ? "Modal-header-wrapper--zanbara" : "px-adaptive pt-adaptive",
                )}
              >
                <div
                  className={cx(
                    "Modal-title-bar h-28",
                    isZanbara && !showZanbaraTitle && "Modal-title-bar--zanbara-close-only",
                  )}
                >
                  {showZanbaraTitle ? (
                    <div
                      id={zanbaraTitleId}
                      className={cx(
                        "Modal-title font-medium text-typography-primary",
                        isZanbara && "zanbara-popup__title-in-modal",
                      )}
                    >
                      {label}
                    </div>
                  ) : !isZanbara ? (
                    <div className="Modal-title font-medium text-typography-primary">{label}</div>
                  ) : null}
                  <button
                    type="button"
                    className="Modal-close-button"
                    aria-label={i18n._(t`Close dialog`)}
                    onClick={() => setIsVisible(false)}
                  >
                    <CloseIcon
                      className={cx("Modal-close-icon", isZanbara ? "Modal-close-icon--zanbara" : "size-20")}
                    />
                  </button>
                </div>
                {headerContent}
              </div>
              {disableOverflowHandling ? (
                bodyChildren
              ) : (
                <div className="overflow-auto">
                  <div
                    className={cx("Modal-body", {
                      "px-adaptive": effectiveContentPadding,
                      "pb-adaptive": effectiveContentPadding && !footerContent,
                    })}
                  >
                    {bodyChildren}
                  </div>
                </div>
              )}
              {footerContent && (
                <div className={cx("px-adaptive pb-adaptive", isZanbara && "Modal-footer--zanbara")}>
                  {isZanbara ? <div className="zanbara-popup__footer">{footerContent}</div> : footerContent}
                </div>
              )}
            </div>
          </motion.div>
        </RemoveScroll>
      )}
    </AnimatePresence>
  );
}
