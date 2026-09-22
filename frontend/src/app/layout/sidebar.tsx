import { Link } from "@tanstack/react-router";
import styles from "./sidebar.module.css";

interface Props {
  onNavigate?: () => void;
}

// サイドバー: サイトタイトル + 縦ナビ。モバイルではオーバーレイとして表示される
export const Sidebar = ({ onNavigate }: Props) => (
  <div className={styles.sidebar}>
    <Link className={styles.title} to="/" onClick={onNavigate}>
      times
    </Link>
    <nav aria-label="サイドナビゲーション" className={styles.nav}>
      <Link className={styles.link} to="/" onClick={onNavigate}>
        Home
      </Link>
      <Link className={styles.link} params={{ id: "1" }} to="/items/$id" onClick={onNavigate}>
        Item 1
      </Link>
      <Link className={styles.link} to="/client" onClick={onNavigate}>
        Client only
      </Link>
    </nav>
  </div>
);
