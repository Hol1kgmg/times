import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  backendFetchRaw,
  cacheKey,
  cachedResponse,
  isInFeed,
  loadFeedXml,
} from "#/shared/api/index.server";

const file = z.string().regex(/^\d{4}-\d{2}-\d{2}\.png$/u);

export const Route = createFileRoute("/feed/images/$file")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const parsed = file.safeParse(params.file);
        const date = parsed.data?.slice(0, -".png".length);
        // 載っていない日付の連打を backend に届けない (specs/010 research R7)
        if (date === undefined || !isInFeed(await loadFeedXml(), date)) {
          return new Response(null, { status: 404 });
        }
        // 版のクエリ (?v=) はキーに入れない。版を上げるのはデプロイと同時で、キャッシュも 300 秒で入れ替わる
        const cached = await cachedResponse(
          cacheKey.feedImage(date),
          300,
          async () => await backendFetchRaw(`/feed/images/${date}`),
        );
        // 編集で同じ URL の画像が変わるので、ブラウザには持たせない (adr/frontend/0002)
        const res = new Response(cached.body, cached);
        res.headers.set("cache-control", "no-cache");
        return res;
      },
    },
  },
});
