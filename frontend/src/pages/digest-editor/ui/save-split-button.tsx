import { useState } from "react";
import { Button, Menu, MenuItem, MenuTrigger, Popover } from "react-aria-components";
import type { DigestStatus } from "#/shared/api";
import { Chevron } from "#/shared/ui/chevron";
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
  const [action, setAction] = useState(saveActions[0]);
  return (
    <div className={styles.split}>
      <Button
        aria-describedby={describedBy}
        className={styles.button}
        isDisabled={disabled}
        onPress={() => {
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
      </Button>
      <MenuTrigger>
        <Button
          aria-label={`${submitLabel}方法を選ぶ`}
          className={`${styles.button} ${styles.splitMore}`}
          isDisabled={disabled}
        >
          <Chevron size={16} />
        </Button>
        <Popover className={styles.saveMenu} offset={0} placement="bottom end">
          <Menu
            className={styles.saveMenuList}
            disallowEmptySelection
            selectedKeys={[action.status]}
            selectionMode="single"
            // 既定では Space で選んだときに閉じず、Enter・クリックと振る舞いが分かれる
            shouldCloseOnSelect
            onAction={(key) => {
              setAction(saveActions.find((a) => a.status === key) ?? action);
            }}
          >
            {saveActions.map((a) => (
              <MenuItem key={a.status} className={styles.saveMenuItem} id={a.status}>
                {a.label}
              </MenuItem>
            ))}
          </Menu>
        </Popover>
      </MenuTrigger>
    </div>
  );
};
