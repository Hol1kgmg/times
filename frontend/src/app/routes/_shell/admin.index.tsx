import { createFileRoute, notFound } from "@tanstack/react-router";

// 無いと /admin が親ルート admin.tsx だけに一致し、404 ではなく空の Outlet になる
export const Route = createFileRoute("/_shell/admin/")({
  beforeLoad: () => {
    throw notFound();
  },
});
