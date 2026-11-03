import { useId } from "react";
import { loadAnyLinkPreview } from "#/shared/api";
import type { DigestContent } from "#/shared/api";
import { DigestPost } from "#/shared/ui/digest-post";
import { HoverButton } from "#/shared/ui/hover-button";
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
      <DigestPost digest={digest} loadPreview={loadAnyLinkPreview} />
    </dialog>
  );
};
