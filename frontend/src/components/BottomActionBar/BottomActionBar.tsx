import type { ReactNode } from "react";
import styles from "./BottomActionBar.module.css";

export function BottomActionBar({ children }: { children: ReactNode }) {
  return (
    <div className={`${styles.bar} no-print`} data-bottom-bar>
      {children}
    </div>
  );
}
