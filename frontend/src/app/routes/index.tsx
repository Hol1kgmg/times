import { createFileRoute } from "@tanstack/react-router";
import { getLatestDigest, HomePage } from "#/pages/home";
import { RootLayout } from "../layout/root-layout";

// loader でサーバー関数を呼ぶ。SSR は既定の true
export const Route = createFileRoute("/")({
  loader: async () => await getLatestDigest(),
  component: () => (
    <RootLayout>
      <HomePage />
    </RootLayout>
  ),
});
