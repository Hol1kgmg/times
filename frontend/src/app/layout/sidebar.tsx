import { Link, useRouteContext } from "@tanstack/react-router";
import { Logo } from "#/shared/ui/logo";
import styles from "./sidebar.module.css";

interface Props {
  onNavigate?: () => void;
}

export const ChannelNav = ({ onNavigate }: Props) => {
  const { user } = useRouteContext({ from: "__root__" });
  return (
    <nav aria-label="チャンネル" className={styles.nav}>
      <span className={styles.group}>Channels</span>
      <Link className={styles.link} to="/" onClick={onNavigate}>
        <span className={styles.hash}>#</span>general
      </Link>
      {user && (
        <>
          <Link className={styles.link} to="/admin/digests/new" onClick={onNavigate}>
            <span className={styles.hash}>+</span>記事を登録
          </Link>
          <span className={styles.group}>Dev</span>
          <Link className={styles.link} params={{ id: "1" }} to="/items/$id" onClick={onNavigate}>
            <span className={styles.hash}>#</span>item-1
          </Link>
          <Link className={styles.link} to="/client" onClick={onNavigate}>
            <span className={styles.hash}>#</span>client-only
          </Link>
        </>
      )}
    </nav>
  );
};

export const Sidebar = () => (
  <div className={styles.sidebar}>
    <Link className={styles.title} to="/">
      <Logo variant="hover" />
    </Link>
    <ChannelNav />
  </div>
);
