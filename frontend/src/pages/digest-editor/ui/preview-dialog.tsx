import { useId } from "react";
import { Button } from "react-aria-components";
import { loadAnyLinkPreview } from "#/shared/api";
import { DigestPost } from "#/shared/ui/digest-post";
import type { DraftDigest } from "#/shared/ui/digest-post";
import { ModalDialog } from "#/shared/ui/modal";
import styles from "./preview-dialog.module.css";

export const PreviewDialog = ({
  digest,
  onClose,
}: {
  digest: DraftDigest;
  onClose: () => void;
}) => {
  const headingId = useId();
  return (
    <ModalDialog className={styles.dialog} closeOnOutside labelledBy={headingId} onClose={onClose}>
      {({ close }) => (
        <>
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
        </>
      )}
    </ModalDialog>
  );
};
