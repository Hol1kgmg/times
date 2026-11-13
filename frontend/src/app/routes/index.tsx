import { createFileRoute } from "@tanstack/react-router";
import { HomePage, latestDigestMarkdown } from "#/pages/home";
import { getLatestDigest } from "#/shared/api";
import { loadLatestDigest } from "#/shared/api/index.server";
import { SITE_URL } from "#/shared/config/site";
import { RootLayout } from "../layout/root-layout";

// loader でサーバー関数を呼ぶ。SSR は既定の true
export const Route = createFileRoute("/")({
  server: {
    handlers: {
      // TanStack Start はページのルートで HTML 以外の Accept を 406 にするので、Markdown はここで先に返す
      GET: async ({ request, next }) =>
        (request.headers.get("accept") ?? "").includes("text/markdown")
          ? new Response(latestDigestMarkdown(await loadLatestDigest()), {
              headers: {
                "content-type": "text/markdown; charset=utf-8",
                "cache-control": "public, max-age=300",
                vary: "Accept",
              },
            })
          : next(),
    },
  },
  loader: async () => await getLatestDigest(),
  head: () => ({
    meta: [{ property: "og:url", content: `${SITE_URL}/` }],
    links: [{ rel: "canonical", href: `${SITE_URL}/` }],
  }),
  component: () => (
    <RootLayout>
      <HomePage />
    </RootLayout>
  ),
});
