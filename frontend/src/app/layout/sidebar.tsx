import { Link, useMatchRoute, useRouteContext } from "@tanstack/react-router";
import type { AdminViewer } from "#/shared/auth";
import { RouterLink } from "#/shared/ui/router-link";
import { Logo } from "#/shared/ui/logo";
import styles from "./sidebar.module.css";

interface Props {
  onNavigate?: () => void;
}

const AdminTabs = ({ admin, onNavigate }: Props & { admin: AdminViewer }) => {
  const matchRoute = useMatchRoute();
  return (
    <>
      <RouterLink className={styles.link} to="/admin/digests/new" onClick={onNavigate}>
        <span className={styles.hash}>+</span>記事を登録
      </RouterLink>
      <RouterLink
        activeOptions={{ exact: Boolean(matchRoute({ to: "/admin/digests/new" })) }}
        className={styles.link}
        to="/admin/digests"
        onClick={onNavigate}
      >
        <span className={styles.hash}>#</span>記事を編集
      </RouterLink>
      {admin.loginPath !== undefined && (
        <RouterLink
          className={styles.link}
          params={{ loginPath: admin.loginPath }}
          to="/$loginPath/auth/login"
          onClick={onNavigate}
        >
          <span className={styles.hash}>#</span>ログアウト
        </RouterLink>
      )}
    </>
  );
};

export const ChannelNav = ({ onNavigate }: Props) => {
  const { viewer } = useRouteContext({ from: "__root__" });
  return (
    <nav aria-label="チャンネル" className={styles.nav}>
      <span className={styles.group}>Channels</span>
      <RouterLink className={styles.link} to="/" onClick={onNavigate}>
        <span className={styles.hash}>#</span>general
      </RouterLink>
      {viewer.kind === "admin" && (
        <>
          {/* 既定では遷移後に router が先頭へ戻し、画面が出した最下段の位置を上書きする */}
          <RouterLink
            className={styles.link}
            resetScroll={false}
            to="/timeline"
            onClick={onNavigate}
          >
            <span className={styles.hash}>#</span>timeline
          </RouterLink>
          <AdminTabs admin={viewer} onNavigate={onNavigate} />
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
