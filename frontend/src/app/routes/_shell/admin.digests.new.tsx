import { createFileRoute } from "@tanstack/react-router";
import { DigestNewPage } from "#/pages/digest-editor";
import { listDigests } from "#/shared/api";

export const Route = createFileRoute("/_shell/admin/digests/new")({
  loader: async () => await listDigests(),
  component: DigestNewPage,
});
