import { createFileRoute } from "@tanstack/react-router";
import { DigestNewPage, resolveDigestEditorPage } from "#/pages/digest-editor";
import { listDigests } from "#/shared/api";

export const Route = createFileRoute("/_shell/admin/digests/new")({
  beforeLoad: async () => await resolveDigestEditorPage(),
  loader: async () => await listDigests(),
  component: DigestNewPage,
});
