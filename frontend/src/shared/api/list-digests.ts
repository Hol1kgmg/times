import { notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { SESSION_EXPIRED } from "#/shared/auth/errors";
import { readAdminToken } from "#/shared/auth/session.server";
import { backendFetch } from "./backend.server";
import { digestList } from "./schemas";

// 保存した日付がすぐ一覧に出るよう、トップと違ってキャッシュを通さない
export const listDigests = createServerFn({ method: "GET" }).handler(async () => {
  const token = readAdminToken();
  if (token === undefined || token === "") {
    throw notFound({ data: { reason: SESSION_EXPIRED } });
  }
  const res = await backendFetch("/digests", undefined, { token });
  return digestList.parse(await res.json());
});
