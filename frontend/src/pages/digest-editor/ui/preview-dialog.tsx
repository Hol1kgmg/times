import { useId } from "react";
import { Button } from "react-aria-components";
import { loadAnyLinkPreview } from "#/shared/api";
import type { DigestContent } from "#/shared/api";
import { DigestPost } from "#/shared/ui/digest-post";
import { useModal } from "#/shared/ui/modal";
import styles from "./preview-dialog.module.css";

export const PreviewDialog = ({
  digest,
  onClose,
}: {
  digest: DigestContent;
  onClose: () => void;
}) => {
  const { dialogProps, close } = useModal(onClose, { closeOnOutside: true });
  const headingId = useId();
  return (
    <dialog {...dialogProps} aria-labelledby={headingId} className={styles.dialog}>
      <div className={styles.dialogHeader}>
        <h2 className={styles.dialogHeading} id={headingId}>
          プレビュー
        </h2>
        <Button
          className={styles.button}
          onPress={() => {
            close();
          }}
        >
          閉じる
        </Button>
      </div>
      <DigestPost digest={digest} loadPreview={loadAnyLinkPreview} />
    </dialog>
  );
};
