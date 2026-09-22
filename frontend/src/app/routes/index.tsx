import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { HomePage, listItems } from "#/pages/home";

// 検索パラメータを検証 (?q=...)、loader でサーバー関数を呼ぶ。SSR は既定の true。
export const Route = createFileRoute("/")({
  validateSearch: z.object({ q: z.string().default("") }),
  loaderDeps: ({ search }) => ({ q: search.q }),
  loader: async ({ deps }) => await listItems({ data: deps }),
  component: HomePage,
});
