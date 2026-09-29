import { isNotFound, redirect } from "@tanstack/react-router";
import { backendFetch } from "#/shared/api";
import { clearAdminToken, readAdminToken } from "#/shared/auth";
import { loginConfig } from "./login-config.server";

// 冪等: Cookie がなくても、backend の session が既に無くても (401) 成功扱いで / へ
export const runLogout = async (path: string) => {
  loginConfig(path);
  const token = readAdminToken();
  if (token !== undefined && token !== "") {
    try {
      await backendFetch("/auth/sessions/current", { method: "DELETE" }, { token });
    } catch (error) {
      if (!isNotFound(error)) {
        // ログアウトは Cookie を消せば成立する。backend 側の行は期限切れで掃除される
        console.error("logout: failed to delete the backend session", error);
      }
    }
  }
  clearAdminToken();
  throw redirect({ to: "/" });
};
