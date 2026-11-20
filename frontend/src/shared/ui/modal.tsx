import { useEffect, useRef } from "react";
import type { PointerEvent, SyntheticEvent } from "react";
import { FocusScope } from "react-aria";
import { Dialog, Modal, ModalOverlay } from "react-aria-components";
import type { DialogProps } from "react-aria-components";
import styles from "./modal.module.css";

const settle = async (element: Element, onClose: () => void) => {
  await Promise.allSettled(element.getAnimations().map(async (a) => await a.finished));
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

export const useModal = (onClose: () => void, { closeOnOutside = true } = {}) => {
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

export const ModalDialog = ({
  className,
  labelledBy,
  closeOnOutside = true,
  onClose,
  children,
}: {
  className: string;
  labelledBy: string;
  closeOnOutside?: boolean;
  onClose: () => void;
  children: DialogProps["children"];
}) => (
  <ModalOverlay
    className={styles.overlay}
    defaultOpen
    isDismissable={closeOnOutside}
    // 呼び出し側は onClose で外すので、フェードアウトを見せ終えてから呼ぶ
    onExit={async (element) => {
      await settle(element, onClose);
    }}
  >
    <Modal className={className}>
      <Dialog aria-labelledby={labelledBy} className={styles.dialog}>
        {(renderProps) => (
          // RAC の Dialog は自身にフォーカスするので、showModal と同じく最初の要素に置く
          <FocusScope autoFocus>
            {typeof children === "function" ? children(renderProps) : children}
          </FocusScope>
        )}
      </Dialog>
    </Modal>
  </ModalOverlay>
);
