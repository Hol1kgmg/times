import { createFileRoute, Outlet } from "@tanstack/react-router";
import { RootLayout } from "../layout/root-layout";

// 検索対象はトップの最新 Digest だけにする (issue #129)
export const Route = createFileRoute("/_shell")({
  head: () => ({ meta: [{ name: "robots", content: "noindex" }] }),
  component: () => (
    <RootLayout>
      <Outlet />
    </RootLayout>
  ),
});
