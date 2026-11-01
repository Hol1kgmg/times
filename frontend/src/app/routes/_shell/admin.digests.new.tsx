import { createFileRoute } from "@tanstack/react-router";
import { DigestNewPage, resolveDigestNewPage } from "#/pages/digest-editor";
import { listDigests } from "#/shared/api";

export const Route = createFileRoute("/_shell/admin/digests/new")({
  beforeLoad: async () => await resolveDigestNewPage(),
  loader: async () => await listDigests(),
  component: DigestNewPage,
});
