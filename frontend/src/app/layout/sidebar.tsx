import { Link, useMatchRoute, useRouteContext } from "@tanstack/react-router";
import { HoverLink } from "#/shared/ui/hover-link";
import { Logo } from "#/shared/ui/logo";
import styles from "./sidebar.module.css";

interface Props {
  onNavigate?: () => void;
}

export const ChannelNav = ({ onNavigate }: Props) => {
  const { user, loginPath } = useRouteContext({ from: "__root__" });
  const matchRoute = useMatchRoute();
  return (
    <nav aria-label="チャンネル" className={styles.nav}>
      <span className={styles.group}>Channels</span>
      <HoverLink className={styles.link} to="/" onClick={onNavigate}>
        <span className={styles.hash}>#</span>general
      </HoverLink>
      {user && (
        <>
          <HoverLink className={styles.link} to="/admin/digests/new" onClick={onNavigate}>
            <span className={styles.hash}>+</span>記事を登録
          </HoverLink>
          <HoverLink
            activeOptions={{ exact: Boolean(matchRoute({ to: "/admin/digests/new" })) }}
            className={styles.link}
            to="/admin/digests"
            onClick={onNavigate}
          >
            <span className={styles.hash}>#</span>記事を編集
          </HoverLink>
          {loginPath !== undefined && (
            <HoverLink
              className={styles.link}
              params={{ loginPath }}
              to="/$loginPath/auth/login"
              onClick={onNavigate}
            >
              <span className={styles.hash}>#</span>ログアウト
            </HoverLink>
          )}
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
