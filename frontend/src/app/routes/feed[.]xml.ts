import { createFileRoute } from "@tanstack/react-router";
import { loadFeedXml } from "#/shared/api/index.server";

export const Route = createFileRoute("/feed.xml")({
  server: {
    handlers: {
      GET: async () =>
        new Response(await loadFeedXml(), {
          headers: {
            "content-type": "application/rss+xml; charset=utf-8",
            "cache-control": "no-cache",
          },
        }),
    },
  },
});
