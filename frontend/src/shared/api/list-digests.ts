import { createServerFn } from "@tanstack/react-start";
import { requireAdminToken } from "#/shared/auth/index.server";
import { backendFetch, unwrapBackend } from "./backend.server";
import { digestList } from "./schemas";

// 保存した日付がすぐ一覧に出るよう、トップと違ってキャッシュを通さない
export const listDigests = createServerFn({ method: "GET" }).handler(async () => {
  const res = unwrapBackend(
    await backendFetch("/digests", undefined, { token: requireAdminToken() }),
  );
  return digestList.parse(await res.json());
});
