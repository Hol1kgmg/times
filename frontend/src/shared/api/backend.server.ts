import { Result } from "@praha/byethrow";
import { notFound } from "@tanstack/react-router";
import { createServerOnlyFn } from "@tanstack/react-start";
// #/shared/auth は get-current-admin 経由でこのファイルに戻ってきて循環するので、errors を直接取る
import type { AdminToken } from "#/shared/auth/admin-token";
import { SESSION_EXPIRED } from "#/shared/auth/errors";
import { readBackendEnv } from "./backend-env.server";
import { BackendProblemError } from "./backend-problem-error";
import { problem } from "./schemas";
import { SessionExpiredError } from "./session-expired-error";

// backend は frontend のサーバー関数からだけ呼ぶ (adr/backend/0003)。
// URL はサーバー側環境変数から読み、クライアントバンドルに出さない。
const env = () => readBackendEnv(process.env, import.meta.env.DEV);

interface Auth {
  token?: AdminToken;
}

// 応答をそのまま返す。ステータスで分岐したい呼び出し側 (ログインの 403 / 502) が使う
export const backendFetchRaw = createServerOnlyFn(
  async (path: string, init?: RequestInit, auth?: Auth) => {
    // 共有シークレットで backend の到達を制限する。値は Workers の secret (wrangler secret put BACKEND_TOKEN)
    const { BACKEND_URL, BACKEND_TOKEN } = env();
    const headers = new Headers(init?.headers);
    if (BACKEND_TOKEN !== "") {
      headers.set("X-Backend-Token", BACKEND_TOKEN);
    }
    // 管理者の session トークン。照合は backend が行う (adr/backend/0007)
    if (auth?.token !== undefined) {
      headers.set("Authorization", `Bearer ${auth.token}`);
    }
    return await fetch(new URL(path, BACKEND_URL), { ...init, headers });
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

export type BackendError = SessionExpiredError | BackendProblemError;

// 期限切れ (session・logout) と Problem (登録の拒否) を呼び出し側が個別に扱うので Result で返す

export const backendFetch = createServerOnlyFn(
  async (
    path: string,
    init?: RequestInit,
    auth?: Auth,
  ): Promise<Result.Result<Response, BackendError>> => {
    const res = await backendFetchRaw(path, init, auth);
    if (res.ok) {
      return Result.succeed(res);
    }
    const message = `backend ${res.status}: ${init?.method ?? "GET"} ${path}`;
    const body = problem.safeParse(await problemBody(res)).data;
    if (
      auth?.token !== undefined &&
      res.status === 401 &&
      body?.type === "/problems/unauthorized"
    ) {
      return Result.fail(new SessionExpiredError(message));
    }
    return Result.fail(new BackendProblemError(message, res.status, body));
  },
);

// 失敗を区別しない呼び出し側の境界。期限切れは Router が isNotFound で判別できる notFound にして投げる
export const unwrapBackend = (result: Result.Result<Response, BackendError>): Response => {
  if (Result.isFailure(result) && result.error instanceof SessionExpiredError) {
    throw notFound({ data: { reason: SESSION_EXPIRED } });
  }
  return Result.unwrap(result);
};
