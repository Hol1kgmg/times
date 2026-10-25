import { useDroppable } from "@dnd-kit/react";
import { useId, useState } from "react";
import type { ReactNode } from "react";
import { Chevron } from "#/shared/ui/chevron";
import type { BoxId } from "../model/board";
import styles from "./box.module.css";

// 中の記事より外側でも落とせるよう、見出しを含む箱全体を droppable にする (閉じた箱へも落とせる)
export const Box = ({ id, count, children }: { id: BoxId; count: number; children: ReactNode }) => {
  const { ref, isDropTarget } = useDroppable({ id });
  const [open, setOpen] = useState(true);
  const panelId = useId();
  return (
    <section ref={ref} className={styles.box} data-drop-target={isDropTarget ? "" : undefined}>
      <h2 className={styles.heading}>
        <button
          aria-controls={panelId}
          aria-expanded={open}
          className={styles.toggle}
          type="button"
          onClick={() => {
            setOpen(!open);
          }}
        >
          <span className={styles.name}>{id}</span>
          <span className={styles.count}>{count} 件</span>
          <Chevron className={styles.chevron} size={18} />
        </button>
      </h2>
      <div className={styles.panel} id={panelId}>
        <div className={styles.panelInner}>
          {count === 0 ? (
            <p className={styles.empty}>ここにドラッグ</p>
          ) : (
            <ul className={styles.list}>{children}</ul>
          )}
        </div>
      </div>
    </section>
  );
};
