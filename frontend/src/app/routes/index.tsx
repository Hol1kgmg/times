import { createFileRoute } from "@tanstack/react-router";
import { HomePage } from "#/pages/home";
import { getLatestDigest } from "#/shared/api";
import { SITE_URL } from "#/shared/config/site";
import { RootLayout } from "../layout/root-layout";

// loader でサーバー関数を呼ぶ。SSR は既定の true
export const Route = createFileRoute("/")({
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
