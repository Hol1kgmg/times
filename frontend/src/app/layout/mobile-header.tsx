import type { RefObject } from "react";
import styles from "./mobile-header.module.css";
import { ChannelNav } from "./sidebar";

interface Props {
  menuRef: RefObject<HTMLButtonElement | null>;
  navRef: RefObject<HTMLDivElement | null>;
  open: boolean;
  onMenuClick: () => void;
  onNavigate: () => void;
}

// 狭い画面用ヘッダー: バー全体が開閉ボタンで、開くとそのまま下へ伸びてチャンネル一覧のメニューになる
export const MobileHeader = ({ menuRef, navRef, open, onMenuClick, onNavigate }: Props) => (
  <header className={styles.header} data-open={open}>
    <button
      ref={menuRef}
      aria-expanded={open}
      aria-label="メニュー"
      className={styles.bar}
      type="button"
      onClick={onMenuClick}
    >
      <svg
        className={styles.close}
        fill="none"
        height={24}
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth={2}
        viewBox="0 0 24 24"
        width={24}
      >
        <path d="M18 6 6 18M6 6l12 12" />
      </svg>
      <img alt="" height={32} src="/favicon.svg" width={32} />
    </button>
    <div ref={navRef} className={styles.menu} inert={!open}>
      <div className={styles.menuInner}>
        <div className={styles.menuBody}>
          <ChannelNav onNavigate={onNavigate} />
        </div>
      </div>
    </div>
  </header>
);
