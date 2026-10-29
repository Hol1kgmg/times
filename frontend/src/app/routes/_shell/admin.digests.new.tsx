import { createFileRoute } from "@tanstack/react-router";
import { DigestNewPage, resolveDigestNewPage } from "#/pages/digest-new";
import { listDigests } from "#/shared/api/list-digests";

export const Route = createFileRoute("/_shell/admin/digests/new")({
  beforeLoad: async () => await resolveDigestNewPage(),
  loader: async () => await listDigests(),
  component: DigestNewPage,
});
