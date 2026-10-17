import { createFileRoute } from "@tanstack/react-router";
import { DigestNewPage, resolveDigestNewPage } from "#/pages/digest-new";

// 管理者専用。未ログイン・期限切れは Router 既定の 404 (specs/003 と同じ)
export const Route = createFileRoute("/admin/digests/new")({
  beforeLoad: async () => await resolveDigestNewPage(),
  component: DigestNewPage,
});
