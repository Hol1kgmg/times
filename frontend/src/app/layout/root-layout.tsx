import { Outlet } from "@tanstack/react-router";
import { useState } from "react";
import { MobileHeader } from "./mobile-header";
import styles from "./root-layout.module.css";
import { Sidebar } from "./sidebar";

// アプリ全体のレイアウト (sidebar + main)。ページ固有の要素は置かない
// デスクトップ: サイドバー常時表示 / モバイル: ヘッダーのボタンでサイドバーをオーバーレイ表示
export const RootLayout = () => {
  const [open, setOpen] = useState(false);
  const close = () => {
    setOpen(false);
  };

  return (
    <div className={styles.layout}>
      <MobileHeader
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
      <aside className={styles.sidebar} data-open={open}>
        <Sidebar onNavigate={close} />
      </aside>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
};
