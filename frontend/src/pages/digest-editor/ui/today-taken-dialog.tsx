import { useId } from "react";
import { Button } from "react-aria-components";
import { RouterLink } from "#/shared/ui/router-link";
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
        <RouterLink className={styles.button} params={{ date }} to="/admin/digests/$date/edit">
          編集する
        </RouterLink>
        <Button
          className={styles.button}
          onPress={() => {
            close();
          }}
        >
          別の日付で登録する
        </Button>
      </div>
    </dialog>
  );
};
