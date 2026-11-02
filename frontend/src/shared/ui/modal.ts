import { useEffect, useRef } from "react";
import type { PointerEvent, SyntheticEvent } from "react";

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

const closeOnBackdrop = (e: PointerEvent<HTMLDialogElement>) => {
  const r = e.currentTarget.getBoundingClientRect();
  const outside =
    e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
  // ::backdrop を押しても target は dialog 自身になるので、座標で枠の外かを見る。closedby は Safari が未対応
  if (e.target === e.currentTarget && outside) {
    e.currentTarget.close();
  }
};

export const useModal = (onClose: () => void, { closeOnOutside = false } = {}) => {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return {
    ref,
    dialogProps: {
      ref,
      onClose: afterFadeOut(onClose),
      onPointerDown: closeOnOutside ? closeOnBackdrop : undefined,
    },
    close: () => {
      ref.current?.close();
    },
  };
};
