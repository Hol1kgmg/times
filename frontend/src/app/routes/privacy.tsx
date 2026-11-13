import { createFileRoute } from "@tanstack/react-router";
import { PrivacyPage, siteInfoHead } from "#/pages/site-info";
import { RootLayout } from "../layout/root-layout";

// _shell の noindex を避けるため、トップと同じくシェルの外で RootLayout に入れる
export const Route = createFileRoute("/privacy")({
  head: () => siteInfoHead("privacy"),
  component: () => (
    <RootLayout>
      <PrivacyPage />
    </RootLayout>
  ),
});
