import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { narrowQuery } from "#/shared/lib/narrow";
import { MobileHeader } from "./mobile-header";
import styles from "./root-layout.module.css";
import { Sidebar } from "./sidebar";

interface Props {
  children: ReactNode;
}

// 広い画面: サイドバー常時表示 / 狭い画面: ヘッダーを伸ばしたメニューで出す
export const RootLayout = ({ children }: Props) => {
  const [open, setOpen] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  const close = () => {
    setOpen(false);
    menuRef.current?.focus();
  };

  // 開いている間だけ Escape を拾い、フォーカスをメニュー内へ移す
  useEffect(() => {
    if (open) {
      navRef.current?.querySelector("a")?.focus();
    }
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        setOpen(false);
        menuRef.current?.focus();
      }
    };
    // 開いたまま広い幅に変わるとヘッダーが消え、inert の main だけが残って操作できなくなる
    const narrow = narrowQuery();
    const onWide = () => {
      if (!narrow.matches) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    narrow.addEventListener("change", onWide);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      narrow.removeEventListener("change", onWide);
    };
  }, [open]);

  return (
    <div className={styles.layout}>
      <MobileHeader
        menuRef={menuRef}
        navRef={navRef}
        open={open}
        onMenuClick={() => {
          setOpen(!open);
        }}
        onNavigate={close}
      />
      {/* 閉じる操作はヘッダーのボタンと Escape で足りるので、ポインター専用にする */}
      <div aria-hidden="true" className={styles.overlay} data-open={open} onClick={close} />
      <aside className={styles.sidebar}>
        <Sidebar />
      </aside>
      <main className={styles.main} inert={open}>
        {children}
      </main>
    </div>
  );
};
