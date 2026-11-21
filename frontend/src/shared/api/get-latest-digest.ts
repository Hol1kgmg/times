import { createServerFn, createServerOnlyFn } from "@tanstack/react-start";
import { backendFetchRaw } from "./backend.server";
import { cacheKey, cachedJson } from "./cache.server";
import { digest } from "./schemas";

// 保存した地域では保存時に消すが、ほかの地域には 5 分の遅れを許容する (adr/frontend/0002)
const TTL_SECONDS = 300;

// Digest が 1 件もないときは 404 が返る。エラーではなく「まだ記事がない」表示にするので null に写す
// getLinkPreview からも呼ぶ。サーバー専用にしないと backend.server の import がクライアントに残る
export const loadLatestDigest = createServerOnlyFn(
  async () =>
    await cachedJson(cacheKey.latestDigest, digest.nullable(), TTL_SECONDS, async () => {
      const res = await backendFetchRaw("/digests/latest");
      if (res.status === 404) {
        return null;
      }
      if (!res.ok) {
        throw new Error(`backend ${res.status}: GET /digests/latest`);
      }
      return digest.parse(await res.json());
    }),
);

export const getLatestDigest = createServerFn({ method: "GET" }).handler(
  async () => await loadLatestDigest(),
);
