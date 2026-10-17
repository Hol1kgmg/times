import { createServerFn } from "@tanstack/react-start";
import { backendFetchRaw, digest } from "#/shared/api";

// Digest が 1 件もないときは 404 が返る。エラーではなく「まだ記事がない」表示にするので null に写す
export const getLatestDigest = createServerFn({ method: "GET" }).handler(async () => {
  const res = await backendFetchRaw("/digests/latest");
  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    throw new Error(`backend ${res.status}: GET /digests/latest`);
  }
  return digest.parse(await res.json());
});
