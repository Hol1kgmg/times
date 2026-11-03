import { useId } from "react";
import { Button } from "react-aria-components";
import { RouterLink } from "#/shared/ui/router-link";
import { ModalDialog } from "#/shared/ui/modal";
import styles from "./today-taken-dialog.module.css";

export const TodayTakenDialog = ({ date, onClose }: { date: string; onClose: () => void }) => {
  const headingId = useId();
  return (
    <ModalDialog className={styles.dialog} closeOnOutside labelledBy={headingId} onClose={onClose}>
      {({ close }) => (
        <>
          <p className={styles.text} id={headingId}>
            今日の記事は登録済みです。編集しますか？
          </p>
          <div className={styles.actions}>
            {/* ModalDialog は DOM 順で最初の要素にフォーカスするので、勧める方を先に置く */}
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
        </>
      )}
    </ModalDialog>
  );
};
