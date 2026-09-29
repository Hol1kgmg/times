import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { completeGitHubLogin } from "#/pages/admin-login";

// GitHub からの戻り先。サーバー関数が常に redirect か notFound を throw するので描画しない
export const Route = createFileRoute("/auth/github/callback")({
  validateSearch: z.object({
    code: z.string().optional(),
    state: z.string().optional(),
    error: z.string().optional(),
  }),
  beforeLoad: async ({ search }) => {
    await completeGitHubLogin({ data: search });
  },
  component: () => null,
});
