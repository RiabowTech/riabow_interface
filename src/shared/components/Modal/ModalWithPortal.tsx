import Modal, { type ModalProps } from "./Modal";
import Portal from "../Portal/Portal";

/**
 * @deprecated 请改为从 `shared/ui` 引入：`import { ModalWithPortal } from "shared/ui"`.
 * 当前文件保留为兼容层，避免历史引用立即中断。
 */
export default function ModalWithPortal(props: ModalProps) {
  return (
    <Portal>
      <Modal {...props} />
    </Portal>
  );
}
