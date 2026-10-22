import { useRouteContext } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { MobileHeader } from "./mobile-header";
import styles from "./root-layout.module.css";
import { Sidebar } from "./sidebar";

interface Props {
  children: ReactNode;
}

// デスクトップ: サイドバー常時表示 / モバイル: ヘッダーのボタンでサイドバーをオーバーレイ表示
const Shell = ({ children }: Props) => {
  const [open, setOpen] = useState(false);
  const asideRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  const close = () => {
    setOpen(false);
    menuRef.current?.focus();
  };

  // 開いている間だけ Escape を拾い、フォーカスをメニュー内へ移す
  useEffect(() => {
    if (open) {
      asideRef.current?.querySelector("a")?.focus();
    }
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        setOpen(false);
        menuRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className={styles.layout}>
      <MobileHeader
        menuRef={menuRef}
        open={open}
        onMenuClick={() => {
          setOpen(true);
        }}
      />
      {open && (
        <button
          aria-label="メニューを閉じる"
          className={styles.overlay}
          type="button"
          onClick={close}
        />
      )}
      <aside ref={asideRef} className={styles.sidebar} data-open={open}>
        <Sidebar onNavigate={close} />
      </aside>
      {children}
    </div>
  );
};

// アプリ全体のレイアウト。シェル (sidebar + main) はログイン中だけ (adr/frontend/0003)
export const RootLayout = ({ children }: Props) => {
  const { user } = useRouteContext({ from: "__root__" });
  const main = <main className={user ? styles.main : undefined}>{children}</main>;
  return user ? <Shell>{main}</Shell> : main;
};
