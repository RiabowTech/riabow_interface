import { useSettings } from "@/modules/lighter/context/SettingsContext";

import { MobileSideNav } from "components/SideNav/MobileSideNav";

import { AppHeaderLogo } from "./AppHeaderLogo";
import { AppHeaderUser } from "./AppHeaderUser";

type Props = {
  leftContent?: React.ReactNode;
  rightContent?: React.ReactNode;
};

export function AppHeader({ leftContent, rightContent }: Props) {
  const { setIsSettingsVisible } = useSettings();

  const openSettings = () => {
    setIsSettingsVisible(true);
  };

  return (
    <header
      data-qa="header"
      className="flex justify-between rounded-[20px] gap-16 max-md:border-b-1/2 max-md:border-slate-600 max-md:p-8 overflow-hidden"
      style={{ backgroundColor: "#090909", padding: "20px" }}
    >
      <div className="flex flex-1 items-center overflow-hidden min-w-0">{leftContent ? leftContent : <AppHeaderLogo />}</div>

      <div className="flex items-center gap-16 shrink-0">
        {rightContent && <div className="flex items-center">{rightContent}</div>}
        <div className="shrink-0">
          <AppHeaderUser
            openSettings={openSettings}
            menuToggle={
              <div className="hidden max-[1024px]:block">
                <MobileSideNav />
              </div>
            }
          />
        </div>
      </div>
    </header>
  );
}
