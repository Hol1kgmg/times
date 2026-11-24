import { createFileRoute } from "@tanstack/react-router";
import { DigestNewPage } from "#/pages/digest-editor";
import { listDigests } from "#/shared/api";
import { requireAdminViewer } from "#/shared/auth";

export const Route = createFileRoute("/_shell/admin/digests/new")({
  beforeLoad: ({ context }) => {
    requireAdminViewer(context.viewer);
  },
  loader: async () => await listDigests(),
  component: DigestNewPage,
});
