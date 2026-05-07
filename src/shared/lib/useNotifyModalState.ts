import { useCallback } from "react";

import { useGlobalContext } from "@/modules/lighter/context/GlobalContext";

export function useNotifyModalState() {
  const { setNotifyModalOpen, notifyModalOpen } = useGlobalContext();
  const openNotifyModal = useCallback(() => setNotifyModalOpen(true), [setNotifyModalOpen]);
  const closeNotifyModal = useCallback(() => setNotifyModalOpen(false), [setNotifyModalOpen]);

  return { notifyModalOpen, openNotifyModal, closeNotifyModal, setNotifyModalOpen };
}
