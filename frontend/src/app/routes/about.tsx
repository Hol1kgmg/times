import { createFileRoute } from "@tanstack/react-router";
import { AboutPage, siteInfoHead } from "#/pages/site-info";
import { RootLayout } from "../layout/root-layout";

// _shell の noindex を避けるため、トップと同じくシェルの外で RootLayout に入れる
export const Route = createFileRoute("/about")({
  head: () => siteInfoHead("about"),
  component: () => (
    <RootLayout>
      <AboutPage />
    </RootLayout>
  ),
});
