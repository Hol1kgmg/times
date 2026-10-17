import { createFileRoute } from "@tanstack/react-router";
import { DigestNewPage, resolveDigestNewPage } from "#/pages/digest-new";

export const Route = createFileRoute("/admin/digests/new")({
  beforeLoad: async () => await resolveDigestNewPage(),
  component: DigestNewPage,
});
