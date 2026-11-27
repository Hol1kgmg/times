import { useDroppable } from "@dnd-kit/react";
import type { ReactNode } from "react";
import { Button, Disclosure, DisclosurePanel } from "react-aria-components";
import { Chevron } from "#/shared/ui/chevron";
import type { BoxId } from "../model/board";
import styles from "./box.module.css";

// 中の記事より外側でも落とせるよう、見出しを含む箱全体を droppable にする (閉じた箱へも落とせる)
export const Box = ({ id, count, children }: { id: BoxId; count: number; children: ReactNode }) => {
  const { ref, isDropTarget } = useDroppable({ id });
  return (
    <Disclosure
      ref={ref}
      className={styles.box}
      data-drop-target={isDropTarget ? "" : undefined}
      defaultExpanded
    >
      <h2 className={styles.heading} data-box={id}>
        <Button className={styles.toggle} slot="trigger">
          <span className={styles.name}>{id}</span>
          <span className={styles.count}>{count} 件</span>
          <Chevron className={styles.chevron} size={18} />
        </Button>
      </h2>
      <DisclosurePanel className={styles.panel}>
        {count === 0 ? (
          <p className={styles.empty}>ここにドラッグ</p>
        ) : (
          <ul className={styles.list}>{children}</ul>
        )}
      </DisclosurePanel>
    </Disclosure>
  );
};
