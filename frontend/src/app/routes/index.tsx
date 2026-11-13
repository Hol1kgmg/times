import { createFileRoute } from "@tanstack/react-router";
import { setResponseHeader } from "@tanstack/react-start/server";
import { HomePage, latestDigestMarkdown } from "#/pages/home";
import { getLatestDigest } from "#/shared/api";
import { loadLatestDigest } from "#/shared/api/index.server";
import { FEED_PATH, SITE_URL } from "#/shared/config/site";
import { RootLayout } from "../layout/root-layout";

const LINK = [
  `</sitemap.xml>; rel="sitemap"`,
  `<${FEED_PATH}>; rel="alternate"; type="application/rss+xml"`,
  `</>; rel="alternate"; type="text/markdown"`,
].join(", ");

// loader でサーバー関数を呼ぶ。SSR は既定の true
export const Route = createFileRoute("/")({
  server: {
    handlers: {
      // TanStack Start はページのルートで HTML 以外の Accept を 406 にするので、Markdown はここで先に返す
      GET: async ({ request, next }) => {
        if (!(request.headers.get("accept") ?? "").includes("text/markdown")) {
          setResponseHeader("link", LINK);
          return next();
        }
        return new Response(latestDigestMarkdown(await loadLatestDigest()), {
          headers: {
            "content-type": "text/markdown; charset=utf-8",
            "cache-control": "public, max-age=300",
            vary: "Accept",
            link: LINK,
          },
        });
      },
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
