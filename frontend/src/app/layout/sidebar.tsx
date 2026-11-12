import { Link, useMatchRoute, useRouteContext } from "@tanstack/react-router";
import type { AdminViewer } from "#/shared/auth";
import type { Channel } from "#/shared/config/channels";
import { adminChannels, publicChannels } from "#/shared/config/channels";
import { RouterLink } from "#/shared/ui/router-link";
import { Logo } from "#/shared/ui/logo";
import styles from "./sidebar.module.css";

interface Props {
  onNavigate?: () => void;
}

const ChannelLink = ({ channel, onNavigate }: Props & { channel: Channel }) => {
  const matchRoute = useMatchRoute();
  return (
    <RouterLink
      // 登録の画面は編集の一覧の下にあるので、登録中は編集を選択中にしない
      activeOptions={
        channel.to === "/admin/digests"
          ? { exact: Boolean(matchRoute({ to: "/admin/digests/new" })) }
          : undefined
      }
      className={styles.link}
      resetScroll={channel.resetScroll}
      to={channel.to}
      onClick={onNavigate}
    >
      <span className={styles.hash}>{channel.mark}</span>
      {channel.label}
    </RouterLink>
  );
};

const AdminTabs = ({ admin, onNavigate }: Props & { admin: AdminViewer }) => (
  <>
    {adminChannels(admin.user).map((channel) => (
      <ChannelLink key={channel.to} channel={channel} onNavigate={onNavigate} />
    ))}
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

export const ChannelNav = ({ onNavigate }: Props) => {
  const { viewer } = useRouteContext({ from: "__root__" });
  return (
    <nav aria-label="チャンネル" className={styles.nav}>
      <span className={styles.group}>Channels</span>
      <RouterLink className={styles.link} to="/" onClick={onNavigate}>
        <span className={styles.hash}>#</span>general
      </RouterLink>
      {publicChannels(viewer).map((channel) => (
        <ChannelLink key={channel.to} channel={channel} onNavigate={onNavigate} />
      ))}
      {viewer.admin && <AdminTabs admin={viewer.admin} onNavigate={onNavigate} />}
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
