import { createServerFn } from "@tanstack/react-start";
import { backendFetchRaw, digestList } from "#/shared/api";

// 保存した日付がすぐ一覧に出るよう、トップと違ってキャッシュを通さない
export const listDigests = createServerFn({ method: "GET" }).handler(async () => {
  const res = await backendFetchRaw("/digests");
  if (!res.ok) {
    throw new Error(`backend ${res.status}: GET /digests`);
  }
  return digestList.parse(await res.json());
});
