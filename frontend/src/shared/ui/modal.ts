import type { SyntheticEvent } from "react";

const settle = async (dialog: HTMLDialogElement, onClose: () => void) => {
  await Promise.allSettled(dialog.getAnimations().map(async (a) => await a.finished));
  onClose();
};

// close 直後に React が dialog を外すと、.modal のフェードアウトが途中で消える
export const afterFadeOut =
  (onClose: () => void) =>
  ({ currentTarget }: SyntheticEvent<HTMLDialogElement>) => {
    void settle(currentTarget, onClose);
  };
