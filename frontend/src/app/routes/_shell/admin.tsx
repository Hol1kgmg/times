import { createFileRoute } from "@tanstack/react-router";
import { requireAdminViewer } from "#/shared/auth";

// /admin/* のガードをここに 1 つだけ置く。子ごとに書くと付け忘れたページを誰でも開ける
export const Route = createFileRoute("/_shell/admin")({
  beforeLoad: ({ context }) => requireAdminViewer(context.viewer),
});
