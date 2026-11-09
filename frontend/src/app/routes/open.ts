import { createFileRoute } from "@tanstack/react-router";
import { handleArticleOpen } from "#/shared/api/article-open.server";

// 計測らしいパス名 (track / collect など) は広告ブロッカーのフィルタに当たる (specs/013 research R4)
export const Route = createFileRoute("/open")({
  server: {
    handlers: {
      POST: async ({ request }) => await handleArticleOpen(request),
    },
  },
});
