import { createFileRoute } from "@tanstack/react-router";
import { requireAdminViewer } from "#/shared/auth";

// 管理者専用のページはすべてこの下に置き、ガードを 1 つにする。子ごとに書くと付け忘れたページを誰でも開ける
export const Route = createFileRoute("/_shell/_admin")({
  beforeLoad: ({ context }) => {
    requireAdminViewer(context.viewer);
  },
});
