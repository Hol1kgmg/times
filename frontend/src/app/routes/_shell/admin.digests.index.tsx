import { createFileRoute } from "@tanstack/react-router";
import { DigestListPage } from "#/pages/digest-list";
import { listDigests } from "#/shared/api";
import { requireAdminViewer } from "#/shared/auth";

// admin.digests.tsx にすると new と $date.edit の親レイアウトになり、Outlet が無いと子が出ない
export const Route = createFileRoute("/_shell/admin/digests/")({
  beforeLoad: ({ context }) => {
    requireAdminViewer(context.viewer);
  },
  loader: async () => await listDigests(),
  component: DigestListPage,
});
