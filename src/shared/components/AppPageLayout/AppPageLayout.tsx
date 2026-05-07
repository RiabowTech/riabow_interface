import cx from "classnames";

import { AppHeader } from "components/AppHeader/AppHeader";
import Footer from "components/Footer/Footer";

export default function AppPageLayout({
  children,
  header,
  className,
  sideNav,
  contentClassName,
  pageWrapperClassName,
  footer,
}: {
  children: React.ReactNode;
  header?: React.ReactNode;
  className?: string;
  sideNav?: React.ReactNode;
  contentClassName?: string;
  pageWrapperClassName?: string;
  footer?: React.ReactNode;
}) {
  return (
    <div className={cx("flex h-full w-full", className)}>
      <div
        className={cx(
          "flex h-full grow flex-col overflow-y-auto scrollbar-gutter-stable p-1 ",
          pageWrapperClassName
        )}
        style={{ backgroundColor: "#090909" }}
      >
        <div className="flex h-full grow flex-col items-center">
          <div className="w-full pb-[4px]">{header ? header : <AppHeader />}</div>
          <div className={cx("flex w-full max-w-[1512px] grow flex-col gap-1 pt-0 pb-8 max-md:px-1", contentClassName)}>
            {children}
          </div>
          <div className="mt-auto hidden w-full pt-8 lg:block">{footer ? footer : <Footer />}</div>
        </div>
      </div>
    </div>
  );
}
