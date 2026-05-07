import { cssTransition, ToastContainer } from "react-toastify";

import { TOAST_AUTO_CLOSE_TIME } from "config/ui";
import { useTheme } from "shared/context/ThemeContext/ThemeContext";

import { CloseToastButton } from "components/CloseToastButton/CloseToastButton";

import { MainRoutes } from "./MainRoutes";

const Zoom = cssTransition({
  enter: "zoomIn",
  exit: "zoomOut",
  appendPosition: false,
  collapse: true,
  collapseDuration: 200,
});

export function AppRoutes() {
  const { theme } = useTheme();

  return (
    <>
      <div className="App flex h-full w-full overflow-hidden">
        <div className="flex h-full min-w-0 grow flex-col overflow-hidden">
          <MainRoutes openSettings={() => undefined} />
        </div>
      </div>
      <ToastContainer
        limit={1}
        transition={Zoom}
        position="bottom-right"
        autoClose={TOAST_AUTO_CLOSE_TIME}
        hideProgressBar={true}
        newestOnTop={false}
        closeOnClick={false}
        draggable={false}
        pauseOnHover
        theme={theme}
        icon={false}
        closeButton={CloseToastButton}
      />
    </>
  );
}
