import { Link } from "@tanstack/react-router";
import menuIcon from "./menu.svg";
import styles from "./mobile-header.module.css";

interface Props {
  onMenuClick: () => void;
}

// モバイル用ヘッダー: メニューボタン + サイトタイトル
export const MobileHeader = ({ onMenuClick }: Props) => (
  <header className={styles.header}>
    <button
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
