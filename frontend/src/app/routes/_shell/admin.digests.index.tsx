import { createFileRoute } from "@tanstack/react-router";
import { resolveDigestNewPage } from "#/pages/digest-new";
import { DigestListPage, listDigests } from "#/pages/digest-list";

// admin.digests.tsx にすると new と $date.edit の親レイアウトになり、Outlet が無いと子が出ない
export const Route = createFileRoute("/_shell/admin/digests/")({
  beforeLoad: async () => await resolveDigestNewPage(),
  loader: async () => await listDigests(),
  component: DigestListPage,
});
