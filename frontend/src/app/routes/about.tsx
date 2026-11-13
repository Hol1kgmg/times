import { createFileRoute } from "@tanstack/react-router";
import { AboutPage, SITE_INFO_TITLES } from "#/pages/site-info";
import { SITE_NAME, SITE_URL } from "#/shared/config/site";
import { RootLayout } from "../layout/root-layout";

// _shell の noindex を避けるため、トップと同じくシェルの外で RootLayout に入れる
export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: `${SITE_INFO_TITLES.about} | ${SITE_NAME}` },
      { property: "og:url", content: `${SITE_URL}/about` },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/about` }],
  }),
  component: () => (
    <RootLayout>
      <AboutPage />
    </RootLayout>
  ),
});
