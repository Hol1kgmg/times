import { Result } from "@praha/byethrow";
import { notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { deleteCookie, getCookie, setCookie } from "@tanstack/react-start/server";
import { z } from "zod";
import type { ApiResponse } from "#/shared/api";
import { SessionExpiredError, backendFetch } from "#/shared/api/index.server";
import type { AdminToken } from "./admin-token";
import { adminToken } from "./admin-token";
import { SESSION_EXPIRED } from "./errors";

// Cookie は backend の不透明トークンと OAuth の state を運ぶだけ (specs/003 data-model.md)
export const ADMIN_COOKIE = "times_admin";
export const LOGIN_COOKIE = "times_login";
const attrs = { httpOnly: true, secure: true, sameSite: "lax", path: "/" } as const;
// 実効期限は backend の expires_at
const ADMIN_MAX_AGE = 30 * 24 * 60 * 60;
const LOGIN_MAX_AGE = 10 * 60;

export const readAdminToken = () => adminToken.safeParse(getCookie(ADMIN_COOKIE)).data;
export const writeAdminToken = (token: AdminToken) => {
  setCookie(ADMIN_COOKIE, token, { ...attrs, maxAge: ADMIN_MAX_AGE });
};
export const clearAdminToken = () => {
  deleteCookie(ADMIN_COOKIE, attrs);
};

export const writeLoginState = (state: string) => {
  setCookie(LOGIN_COOKIE, state, { ...attrs, maxAge: LOGIN_MAX_AGE });
};
// 読んで削除。照合の成否を問わず 1 回で使い捨てる
export const takeLoginState = () => {
  const state = getCookie(LOGIN_COOKIE);
  if (state !== undefined) {
    deleteCookie(LOGIN_COOKIE, attrs);
  }
  return state;
};

const adminUser = z.object({ id: z.number(), login: z.string() });
// openapi.yaml と乖離したら typecheck で落ちる
const session = z.object({ user: adminUser }) satisfies z.ZodType<
  Pick<ApiResponse<"getCurrentSession">, "user">
>;
export type AdminUser = z.infer<typeof adminUser>;

// Cookie のトークンを backend に照合する。有効なら user、無効 (401) なら Cookie を消して undefined
export const currentAdmin = async (): Promise<AdminUser | undefined> => {
  const token = readAdminToken();
  if (token === undefined) {
    return undefined;
  }
  const result = await backendFetch("/auth/sessions/current", {}, { token });
  if (Result.isFailure(result) && result.error instanceof SessionExpiredError) {
    clearAdminToken();
    return undefined;
  }
  return session.parse(await Result.unwrap(result).json()).user;
};

// 管理者専用ページの beforeLoad で呼ぶ。未ログイン・期限切れ・失効はすべて 404
export const requireAdminPage = createServerFn({ method: "GET" }).handler(async () => {
  const user = await currentAdmin();
  if (!user) {
    throw notFound();
  }
  return { user };
});

// middleware にしないのは、.server.ts 由来の middleware はクライアントから呼ぶサーバー関数に付けると import-protection に弾かれるため
// Cookie の有無だけ見る。照合は backendFetch(path, init, { token }) で backend が行う
export const requireAdminToken = () => {
  const token = readAdminToken();
  if (token === undefined) {
    throw notFound({ data: { reason: SESSION_EXPIRED } });
  }
  return token;
};
