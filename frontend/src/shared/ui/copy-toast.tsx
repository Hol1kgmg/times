import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import styles from "./copy-toast.module.css";

export const useCopyToast = () => {
  const [shown, setShown] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(
    () => () => {
      clearTimeout(timer.current);
    },
    [],
  );
  const show = () => {
    clearTimeout(timer.current);
    setShown(true);
    timer.current = setTimeout(() => {
      setShown(false);
    }, 2000);
  };
  return { shown, show };
};

// 先頭の子 (ボタン) をアンカーにして、その上に出す
export const CopyToast = ({
  shown,
  className,
  children,
}: {
  shown: boolean;
  className?: string;
  children: ReactNode;
}) => (
  <span className={className === undefined ? styles.wrap : `${styles.wrap} ${className}`}>
    {children}
    {/* 中身の差し替えで読み上げさせるため、領域は常に置いて文字だけ出し入れする */}
    <output className={styles.toast}>
      {shown && <span className={styles.toastText}>コピーしました</span>}
    </output>
  </span>
);
