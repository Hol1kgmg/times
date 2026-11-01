import { createServerFn } from "@tanstack/react-start";
import { requireAdminToken } from "#/shared/auth/session.server";
import { backendFetch } from "./backend.server";
import { digestList } from "./schemas";

// 保存した日付がすぐ一覧に出るよう、トップと違ってキャッシュを通さない
export const listDigests = createServerFn({ method: "GET" }).handler(async () => {
  const res = await backendFetch("/digests", undefined, { token: requireAdminToken() });
  return digestList.parse(await res.json());
});
