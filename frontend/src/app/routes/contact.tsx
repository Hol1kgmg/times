import { createFileRoute } from "@tanstack/react-router";
import { ContactPage, SITE_INFO_TITLES } from "#/pages/site-info";
import { SITE_NAME, SITE_URL } from "#/shared/config/site";
import { RootLayout } from "../layout/root-layout";

// _shell の noindex を避けるため、トップと同じくシェルの外で RootLayout に入れる
export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: `${SITE_INFO_TITLES.contact} | ${SITE_NAME}` },
      { property: "og:url", content: `${SITE_URL}/contact` },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/contact` }],
  }),
  component: () => (
    <RootLayout>
      <ContactPage />
    </RootLayout>
  ),
});
