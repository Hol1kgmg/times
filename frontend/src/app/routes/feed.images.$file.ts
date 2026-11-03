import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { backendFetchRaw, cachedResponse, isInFeed, loadFeedXml } from "#/shared/api/index.server";

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
        return await cachedResponse(
          `https://cache.times.invalid/feed/images/${date}`,
          300,
          async () => await backendFetchRaw(`/feed/images/${date}`),
        );
      },
    },
  },
});
