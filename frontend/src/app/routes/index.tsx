import { createFileRoute } from "@tanstack/react-router";
import { getLatestDigest, HomePage } from "#/pages/home";
import { SITE_URL } from "#/shared/config/site";
import { RootLayout } from "../layout/root-layout";

// loader でサーバー関数を呼ぶ。SSR は既定の true
export const Route = createFileRoute("/")({
  loader: async () => await getLatestDigest(),
  head: () => ({ meta: [{ property: "og:url", content: `${SITE_URL}/` }] }),
  component: () => (
    <RootLayout>
      <HomePage />
    </RootLayout>
  ),
});
