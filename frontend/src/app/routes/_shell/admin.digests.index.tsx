import { createFileRoute } from "@tanstack/react-router";
import { resolveDigestEditorPage } from "#/pages/digest-editor";
import { DigestListPage } from "#/pages/digest-list";
import { listDigests } from "#/shared/api";

// admin.digests.tsx にすると new と $date.edit の親レイアウトになり、Outlet が無いと子が出ない
export const Route = createFileRoute("/_shell/admin/digests/")({
  beforeLoad: async () => await resolveDigestEditorPage(),
  loader: async () => await listDigests(),
  component: DigestListPage,
});
