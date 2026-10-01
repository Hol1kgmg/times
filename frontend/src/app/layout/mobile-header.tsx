import { Link } from "@tanstack/react-router";
import type { RefObject } from "react";
import menuIcon from "./menu.svg";
import styles from "./mobile-header.module.css";

interface Props {
  menuRef: RefObject<HTMLButtonElement | null>;
  open: boolean;
  onMenuClick: () => void;
}

// モバイル用ヘッダー: メニューボタン + サイトタイトル
export const MobileHeader = ({ menuRef, open, onMenuClick }: Props) => (
  <header className={styles.header}>
    <button
      ref={menuRef}
      aria-expanded={open}
      aria-label="メニューを開く"
      className={styles.menuButton}
      type="button"
      onClick={onMenuClick}
    >
      <img alt="" height={24} src={menuIcon} width={24} />
    </button>
    <Link className={styles.title} to="/">
      times
    </Link>
  </header>
);
