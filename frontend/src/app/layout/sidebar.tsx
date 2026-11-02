import { Link, useMatchRoute, useRouteContext } from "@tanstack/react-router";
import type { AdminViewer } from "#/shared/auth";
import { HoverLink } from "#/shared/ui/hover-link";
import { Logo } from "#/shared/ui/logo";
import styles from "./sidebar.module.css";

interface Props {
  onNavigate?: () => void;
}

const AdminTabs = ({ admin, onNavigate }: Props & { admin: AdminViewer }) => {
  const matchRoute = useMatchRoute();
  return (
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
      {admin.loginPath !== undefined && (
        <HoverLink
          className={styles.link}
          params={{ loginPath: admin.loginPath }}
          to="/$loginPath/auth/login"
          onClick={onNavigate}
        >
          <span className={styles.hash}>#</span>ログアウト
        </HoverLink>
      )}
    </>
  );
};

export const ChannelNav = ({ onNavigate }: Props) => {
  const { viewer } = useRouteContext({ from: "__root__" });
  return (
    <nav aria-label="チャンネル" className={styles.nav}>
      <span className={styles.group}>Channels</span>
      <HoverLink className={styles.link} to="/" onClick={onNavigate}>
        <span className={styles.hash}>#</span>general
      </HoverLink>
      {viewer.kind === "admin" && <AdminTabs admin={viewer} onNavigate={onNavigate} />}
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
