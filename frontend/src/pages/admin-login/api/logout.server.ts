import { Result } from "@praha/byethrow";
import { redirect } from "@tanstack/react-router";
import { SessionExpiredError, backendFetch } from "#/shared/api/index.server";
import { clearAdminToken, readAdminToken } from "#/shared/auth/index.server";
import { loginConfig } from "./login-config.server";

// 冪等: Cookie がなくても、backend の session が既に無くても (401) 成功扱いで / へ
export const runLogout = async (path: string) => {
  loginConfig(path);
  const token = readAdminToken();
  if (token !== undefined) {
    // ログアウトは Cookie を消せば成立する。backend 側の行は期限切れで掃除される
    const result = await backendFetch(
      "/auth/sessions/current",
      { method: "DELETE" },
      { token },
    ).catch((error: unknown) => Result.fail(error));
    if (Result.isFailure(result) && !(result.error instanceof SessionExpiredError)) {
      console.error("logout: failed to delete the backend session", result.error);
    }
  }
  clearAdminToken();
  throw redirect({ to: "/" });
};
