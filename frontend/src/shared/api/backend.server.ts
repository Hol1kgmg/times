import { notFound } from "@tanstack/react-router";
import { createServerOnlyFn } from "@tanstack/react-start";
import { SESSION_EXPIRED } from "#/shared/auth/errors";

// backend は frontend のサーバー関数からだけ呼ぶ (adr/backend/0003)。
// URL はサーバー側環境変数から読み、クライアントバンドルに出さない。
const baseUrl = () => process.env.BACKEND_URL ?? "http://localhost:8080";

interface Auth {
  token?: string;
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
    if (auth?.token !== undefined && auth.token !== "") {
      headers.set("Authorization", `Bearer ${auth.token}`);
    }
    return await fetch(new URL(path, baseUrl()), { ...init, headers });
  },
);

const isUnauthorizedProblem = async (res: Response) => {
  if (!(res.headers.get("content-type") ?? "").includes("application/problem+json")) {
    return false;
  }
  try {
    const body: unknown = await res.json();
    return (
      typeof body === "object" &&
      body !== null &&
      "type" in body &&
      body.type === "/problems/unauthorized"
    );
  } catch {
    return false;
  }
};

// 2xx 以外は例外。トークン付きの要求が 401 (unauthorized) なら notFound(SESSION_EXPIRED) に写す。
// 呼び出し側は isNotFound(e) && e.data.reason === SESSION_EXPIRED で期限切れ・失効を判別する
export const backendFetch = createServerOnlyFn(
  async (path: string, init?: RequestInit, auth?: Auth) => {
    const res = await backendFetchRaw(path, init, auth);
    if (res.ok) {
      return res;
    }
    if (auth?.token !== undefined && res.status === 401 && (await isUnauthorizedProblem(res))) {
      throw notFound({ data: { reason: SESSION_EXPIRED } });
    }
    throw new Error(`backend ${res.status}: ${init?.method ?? "GET"} ${path}`);
  },
);
