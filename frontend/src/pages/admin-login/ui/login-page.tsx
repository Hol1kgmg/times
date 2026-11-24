import { getRouteApi, useRouteContext } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "react-aria-components";
import { toast } from "#/shared/ui/toast";
import { logout } from "../api/logout";
import type { LoginError } from "../api/pick-login-error";
import { startGitHubLogin } from "../api/start-github-login";
import styles from "./login-page.module.css";

const route = getRouteApi("/_shell/$loginPath/auth/login");

const messages: Record<LoginError, string> = {
  forbidden: "このアカウントは管理者として許可されていません",
  cancelled: "GitHub での承認がキャンセルされました",
  failed: "GitHub との通信に失敗しました。もう一度お試しください",
};

// 秘匿パスのページ。未ログイン: ログインカード / ログイン済み: ログイン中表示とログアウト (FR-009 / FR-010)
export const LoginPage = () => {
  const { loginPath } = route.useParams();
  const { error } = route.useSearch();
  const user = useRouteContext({ from: "__root__" }).viewer.admin?.user;
  const start = useServerFn(startGitHubLogin);
  const end = useServerFn(logout);
  const goToGitHub = async () => {
    const { url } = await start({ data: { path: loginPath } });
    window.location.assign(url);
  };
  const signOut = async () => {
    try {
      // redirect は Router が処理して / へ遷移し、遷移し終えてから戻る
      await end({ data: { path: loginPath } });
      toast.success("ログアウトしました");
    } catch {
      toast.error("ログアウトできませんでした。時間をおいてもう一度試してください");
    }
  };

  if (user) {
    return (
      <div className={styles.page}>
        <section className={styles.card}>
          <p className={styles.status}>
            <span aria-hidden="true" className={styles.dot} />
            ログイン中: {user.login}
          </p>
          <Button
            className={styles.secondary}
            onPress={() => {
              void signOut();
            }}
          >
            ログアウト
          </Button>
        </section>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <section className={styles.card}>
        <h1 className={styles.heading}>管理者ログイン</h1>
        {error && <p className={styles.message}>{messages[error]}</p>}
        <Button
          className={styles.button}
          onPress={() => {
            void goToGitHub();
          }}
        >
          GitHub でログイン
        </Button>
      </section>
    </div>
  );
};
