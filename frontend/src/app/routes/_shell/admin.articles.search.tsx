import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { ArticleSearchPage } from "#/pages/article-search";
import { resolveDigestEditorPage } from "#/pages/digest-editor";
import { articleSearchQuery, searchArticles } from "#/shared/api";

// Router は search を JSON として読み、数字だけの q を number にするので文字列に戻す
const searchParams = z.object({ q: z.coerce.string().pipe(articleSearchQuery.shape.q).optional() });

// API の結果を確かめる検証用。サイドバーにタブは出さない (issue #170)
export const Route = createFileRoute("/_shell/admin/articles/search")({
  // 想定外の値は無視する (エラー画面にしない)
  validateSearch: (raw: Record<string, unknown>) => searchParams.safeParse(raw).data ?? {},
  beforeLoad: async () => await resolveDigestEditorPage(),
  loaderDeps: ({ search }) => search,
  loader: async ({ deps: { q } }) =>
    q === undefined ? undefined : await searchArticles({ data: { q } }),
  component: ArticleSearchPage,
});
