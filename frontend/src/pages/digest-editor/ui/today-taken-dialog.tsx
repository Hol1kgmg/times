import { useId } from "react";
import { HoverButton } from "#/shared/ui/hover-button";
import { HoverLink } from "#/shared/ui/hover-link";
import { useModal } from "#/shared/ui/modal";
import styles from "./today-taken-dialog.module.css";

export const TodayTakenDialog = ({ date, onClose }: { date: string; onClose: () => void }) => {
  const { dialogProps, close } = useModal(onClose, { closeOnOutside: true });
  const headingId = useId();
  return (
    <dialog {...dialogProps} aria-labelledby={headingId} className={styles.dialog}>
      <p className={styles.text} id={headingId}>
        今日の記事は登録済みです。編集しますか？
      </p>
      <div className={styles.actions}>
        {/* showModal は DOM 順で最初の要素にフォーカスするので、勧める方を先に置く */}
        <HoverLink className={styles.button} params={{ date }} to="/admin/digests/$date/edit">
          編集する
        </HoverLink>
        <HoverButton
          className={styles.button}
          type="button"
          onClick={() => {
            close();
          }}
        >
          別の日付で登録する
        </HoverButton>
      </div>
    </dialog>
  );
};
