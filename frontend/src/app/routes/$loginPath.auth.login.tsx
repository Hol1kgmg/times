import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { LoginPage, resolveLoginPage } from "#/pages/admin-login";

const search = z.object({ error: z.enum(["forbidden", "cancelled", "failed"]).optional() });

// 秘匿パス (/ADMIN_LOGIN_PATH/auth/login) のページ。照合はサーバー関数の中で行い、不一致は Router 既定の 404
export const Route = createFileRoute("/$loginPath/auth/login")({
  // 想定外の値は無視する (エラー画面にしない)
  validateSearch: (raw: Record<string, unknown>) => search.safeParse(raw).data ?? {},
  beforeLoad: async ({ params }) => await resolveLoginPage({ data: { path: params.loginPath } }),
  component: LoginPage,
});
