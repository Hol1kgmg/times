import { createServerFn } from "@tanstack/react-start";
import { backendFetchRaw, cachedJson, digest } from "#/shared/api";

// Digest は管理者が手動で登録したときしか変わらないので 5 分の遅れを許容する (adr/frontend/0002)
const TTL_SECONDS = 300;

// Digest が 1 件もないときは 404 が返る。エラーではなく「まだ記事がない」表示にするので null に写す
export const getLatestDigest = createServerFn({ method: "GET" }).handler(
  async () =>
    await cachedJson("https://cache.times.invalid/digests/latest", TTL_SECONDS, async () => {
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
