import type { ReactNode } from "react";
import "../../styles/global.scss";
import { TopNav } from "../TopNav/TopNav";
import styles from "./LighterShell.module.scss";

interface LighterShellProps {
  children: ReactNode;
}

export function LighterShell({ children }: LighterShellProps) {
  return (
    <div className={`lighter-root ${styles.page}`}>
      <div className={styles.topnav}>
        <TopNav />
      </div>
      {/* <div className={styles.banner}>
        You're accessing Lighter from a restricted jurisdiction. Only withdrawals are available. For more details, see
        the&nbsp;
        <a href="#terms">Terms of Service</a>.
      </div> */}
      <div className={styles.content}>{children}</div>
    </div>
  );
}
