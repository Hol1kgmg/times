import { notFound } from "@tanstack/react-router";
import { createServerOnlyFn } from "@tanstack/react-start";
// #/shared/auth は get-current-admin 経由でこのファイルに戻ってきて循環するので、errors を直接取る
import type { AdminToken } from "#/shared/auth/admin-token";
import { SESSION_EXPIRED } from "#/shared/auth/errors";

// backend は frontend のサーバー関数からだけ呼ぶ (adr/backend/0003)。
// URL はサーバー側環境変数から読み、クライアントバンドルに出さない。
const baseUrl = () => process.env.BACKEND_URL ?? "http://localhost:8080";

interface Auth {
  token?: AdminToken;
}

// 応答をそのまま返す。ステータスで分岐したい呼び出し側 (ログインの 403 / 502) が使う
export const backendFetchRaw = createServerOnlyFn(
  async (path: string, init?: RequestInit, auth?: Auth) => {
    // 共有シークレットで backend の到達を制限する。値は Workers の secret (wrangler secret put BACKEND_TOKEN)
    const headers = new Headers(init?.headers);
    const shared = process.env.BACKEND_TOKEN ?? "";
    if (shared !== "") {
      headers.set("X-Backend-Token", shared);
    }
    // 管理者の session トークン。照合は backend が行う (adr/backend/0007)
    if (auth?.token !== undefined) {
      headers.set("Authorization", `Bearer ${auth.token}`);
    }
    return await fetch(new URL(path, baseUrl()), { ...init, headers });
  },
);

const problemBody = async (res: Response): Promise<unknown> => {
  if (!(res.headers.get("content-type") ?? "").includes("application/problem+json")) {
    return undefined;
  }
  try {
    return await res.json();
  } catch {
    return undefined;
  }
};

const isUnauthorized = (body: unknown) =>
  typeof body === "object" &&
  body !== null &&
  "type" in body &&
  body.type === "/problems/unauthorized";

// 2xx 以外は例外。トークン付きの要求が 401 (unauthorized) なら notFound(SESSION_EXPIRED) に写す。
// 呼び出し側は isNotFound(e) && e.data.reason === SESSION_EXPIRED で期限切れ・失効を判別する
// それ以外は Problem の本文を未検証のまま cause に載せる。使う側が problem.safeParse で読む
export const backendFetch = createServerOnlyFn(
  async (path: string, init?: RequestInit, auth?: Auth) => {
    const res = await backendFetchRaw(path, init, auth);
    if (res.ok) {
      return res;
    }
    const body = await problemBody(res);
    if (auth?.token !== undefined && res.status === 401 && isUnauthorized(body)) {
      throw notFound({ data: { reason: SESSION_EXPIRED } });
    }
    throw new Error(`backend ${res.status}: ${init?.method ?? "GET"} ${path}`, { cause: body });
  },
);
