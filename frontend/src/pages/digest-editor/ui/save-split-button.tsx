import { useId, useRef, useState } from "react";
import type { DigestStatus } from "#/shared/api";
import { Chevron } from "#/shared/ui/chevron";
import { HoverButton } from "#/shared/ui/hover-button";
import styles from "./save-split-button.module.css";

export interface SaveAction<S extends DigestStatus> {
  label: string;
  status: S;
}

interface SaveSplitButtonProps<S extends DigestStatus> {
  saveActions: readonly [SaveAction<S>, ...SaveAction<S>[]];
  submitLabel: string;
  disabled: boolean;
  describedBy: string | undefined;
  onSave: (status: S) => void;
}

export const SaveSplitButton = <S extends DigestStatus>({
  saveActions,
  submitLabel,
  disabled,
  describedBy,
  onSave,
}: SaveSplitButtonProps<S>) => {
  const saveMenuId = useId();
  const saveMenu = useRef<HTMLDivElement>(null);
  const [action, setAction] = useState(saveActions[0]);
  return (
    <div className={styles.split}>
      <HoverButton
        aria-describedby={describedBy}
        className={styles.button}
        disabled={disabled}
        type="button"
        onClick={() => {
          onSave(action.status);
        }}
      >
        {/* いちばん長いラベルの幅を普段から取り、選び直してもボタンの位置を動かさない */}
        <span className={styles.splitLabels}>
          {saveActions.map((a) => (
            <span
              key={a.status}
              className={a.status === action.status ? undefined : styles.splitLabelHidden}
            >
              {a.label}
            </span>
          ))}
        </span>
      </HoverButton>
      <HoverButton
        aria-label={`${submitLabel}方法を選ぶ`}
        className={`${styles.button} ${styles.splitMore}`}
        disabled={disabled}
        popoverTarget={saveMenuId}
        type="button"
      >
        <Chevron size={16} />
      </HoverButton>
      <div
        ref={saveMenu}
        className={styles.saveMenu}
        id={saveMenuId}
        popover="auto"
        onToggle={(e) => {
          if (e.newState === "open") {
            e.currentTarget.querySelector<HTMLElement>('[aria-pressed="true"]')?.focus();
          }
        }}
      >
        {saveActions.map((a) => (
          <HoverButton
            key={a.status}
            aria-pressed={a.status === action.status}
            className={styles.saveMenuItem}
            type="button"
            onClick={() => {
              saveMenu.current?.hidePopover();
              setAction(a);
            }}
          >
            {a.label}
          </HoverButton>
        ))}
      </div>
    </div>
  );
};
