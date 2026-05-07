import cx from "classnames";
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

export type ModalPrimitSize = "small" | "middle" | "big";

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
   * - **`primit`（默认）**：第 11 章 Popup_PC — 炭底直角、85% 遮罩；业务无需再手写 `variant`。
   * - **`default`**：历史圆角 + 浅灰遮罩；仅旧版式或特殊布局时使用。
   */
  variant?: "default" | "primit";
  /** `variant="primit"` 且存在 `label` 时用于 `aria-labelledby`；省略则内部 `useId` */
  primitDialogTitleId?: string;
  /** `variant="primit"` 时稿面 Small / Middle / Big；默认 **small**（高度随内容，不锁 400px） */
  primitSize?: ModalPrimitSize;
  /** `variant="primit"` 时在正文外包一层 `.primit-popup__body`，可叠稿面占位等 class */
  primitBodyClassName?: string;
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
  variant = "primit",
  primitDialogTitleId,
  primitSize = "small",
  primitBodyClassName = "",
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement | null>(null);
  const generatedPrimitTitleId = useId();

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

  const isPrimit = variant === "primit";
  const showPrimitTitle = Boolean(label);
  const effectiveContentPadding = isPrimit ? false : contentPadding;
  const primitTitleId =
    isPrimit && showPrimitTitle ? (primitDialogTitleId ?? generatedPrimitTitleId) : undefined;

  const mergedContentClassName = useMemo(() => {
    if (!isPrimit) return contentClassName;
    return cx(
      "primit-popup-panel",
      primitSize === "small" && "primit-popup-panel--small",
      primitSize === "middle" && "primit-popup-panel--middle",
      primitSize === "big" && "primit-popup-panel--big",
      contentClassName,
    );
  }, [isPrimit, primitSize, contentClassName]);

  const showPrimitBody =
    isPrimit &&
    (children != null || (typeof primitBodyClassName === "string" && primitBodyClassName.trim() !== ""));

  const bodyChildren = showPrimitBody ? (
    <div className={cx("primit-popup__body", primitBodyClassName)}>{children}</div>
  ) : (
    children
  );

  const modalStyle = useMemo(
    () => ({ zIndex: zIndex ?? (isPrimit ? 1200 : undefined) }),
    [zIndex, isPrimit],
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
              isPrimit && "Modal--primit-popup",
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
              role={isPrimit ? "dialog" : undefined}
              aria-modal={isPrimit ? true : undefined}
              aria-labelledby={primitTitleId}
            >
              <div
                className={cx(
                  "Modal-header-wrapper flex flex-col gap-8",
                  isPrimit ? "Modal-header-wrapper--primit" : "px-adaptive pt-adaptive",
                )}
              >
                <div
                  className={cx(
                    "Modal-title-bar h-28",
                    isPrimit && !showPrimitTitle && "Modal-title-bar--primit-close-only",
                  )}
                >
                  {showPrimitTitle ? (
                    <div
                      id={primitTitleId}
                      className={cx(
                        "Modal-title font-medium text-typography-primary",
                        isPrimit && "primit-popup__title-in-modal",
                      )}
                    >
                      {label}
                    </div>
                  ) : !isPrimit ? (
                    <div className="Modal-title font-medium text-typography-primary">{label}</div>
                  ) : null}
                  <button
                    type="button"
                    className="Modal-close-button"
                    aria-label="Close"
                    onClick={() => setIsVisible(false)}
                  >
                    <CloseIcon
                      className={cx("Modal-close-icon", isPrimit ? "Modal-close-icon--primit" : "size-20")}
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
                <div className={cx("px-adaptive pb-adaptive", isPrimit && "Modal-footer--primit")}>
                  {isPrimit ? <div className="primit-popup__footer">{footerContent}</div> : footerContent}
                </div>
              )}
            </div>
          </motion.div>
        </RemoveScroll>
      )}
    </AnimatePresence>
  );
}
