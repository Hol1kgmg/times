import { createFileRoute, stripSearchParams } from "@tanstack/react-router";
import { z } from "zod";
import { HomePage, listItems } from "#/pages/home";

// 検索パラメータを検証 (?q=...)、loader でサーバー関数を呼ぶ。SSR は既定の true。
export const Route = createFileRoute("/")({
  validateSearch: z.object({ q: z.string().default("") }),
  // 既定値を URL に補うと `/` が `/?q=` へ 307 し初回表示が 1 往復遅れるので URL から落とす
  search: { middlewares: [stripSearchParams({ q: "" })] },
  loaderDeps: ({ search }) => ({ q: search.q }),
  loader: async ({ deps }) => await listItems({ data: deps }),
  component: HomePage,
});
