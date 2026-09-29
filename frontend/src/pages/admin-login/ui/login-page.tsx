import { getRouteApi } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { logout } from "../api/logout";
import type { LoginError } from "../api/pick-login-error";
import { startGitHubLogin } from "../api/start-github-login";
import styles from "./login-page.module.css";

const route = getRouteApi("/$loginPath/auth/login");

const messages: Record<LoginError, string> = {
  forbidden: "このアカウントは管理者として許可されていません",
  cancelled: "GitHub での承認がキャンセルされました",
  failed: "GitHub との通信に失敗しました。もう一度お試しください",
};

// 秘匿パスのページ。未ログイン: ログインカード / ログイン済み: ログイン中表示とログアウト (FR-009 / FR-010)
export const LoginPage = () => {
  const { loginPath } = route.useParams();
  const { error } = route.useSearch();
  const { user } = route.useRouteContext();
  const start = useServerFn(startGitHubLogin);
  const end = useServerFn(logout);
  const goToGitHub = async () => {
    const { url } = await start({ data: { path: loginPath } });
    window.location.assign(url);
  };

  if (user) {
    return (
      <div className={styles.page}>
        <section className={styles.card}>
          <p className={styles.status}>
            <span aria-hidden="true" className={styles.dot} />
            ログイン中: {user.login}
          </p>
          <button
            className={styles.secondary}
            type="button"
            onClick={() => {
              // redirect は Router が処理して / へ遷移する
              void end({ data: { path: loginPath } });
            }}
          >
            ログアウト
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <section className={styles.card}>
        <h1 className={styles.heading}>管理者ログイン</h1>
        {error && <p className={styles.message}>{messages[error]}</p>}
        <button
          className={styles.button}
          type="button"
          onClick={() => {
            void goToGitHub();
          }}
        >
          GitHub でログイン
        </button>
      </section>
    </div>
  );
};
