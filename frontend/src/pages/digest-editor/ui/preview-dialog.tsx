import { useId } from "react";
import type { DigestContent } from "#/shared/api";
import { DigestPost } from "#/shared/ui/digest-post";
import { HoverButton } from "#/shared/ui/hover-button";
import { useModal } from "#/shared/ui/modal";
import { loadDraftPreview } from "../api/load-draft-preview";
import styles from "./preview-dialog.module.css";

export const PreviewDialog = ({
  digest,
  onClose,
}: {
  digest: DigestContent;
  onClose: () => void;
}) => {
  const { dialogProps, close } = useModal(onClose);
  const headingId = useId();
  return (
    <dialog {...dialogProps} aria-labelledby={headingId} className={styles.dialog}>
      <div className={styles.dialogHeader}>
        <h2 className={styles.dialogHeading} id={headingId}>
          プレビュー
        </h2>
        <HoverButton
          className={styles.button}
          type="button"
          onClick={() => {
            close();
          }}
        >
          閉じる
        </HoverButton>
      </div>
      <DigestPost digest={digest} loadPreview={loadDraftPreview} />
    </dialog>
  );
};
