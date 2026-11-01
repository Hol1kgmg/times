import { useState } from "react";
import { HoverButton } from "#/shared/ui/hover-button";
import styles from "./client-page.module.css";

export const ClientPage = () => {
  const [n, setN] = useState(0);
  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Client only</h1>
      <HoverButton
        className={styles.button}
        type="button"
        onClick={() => {
          setN(n + 1);
        }}
      >
        count: {n}
      </HoverButton>
    </div>
  );
};
