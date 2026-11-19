import { createFileRoute } from "@tanstack/react-router";
import { ArticleSearchPage } from "#/pages/article-search";
import { resolveDigestEditorPage } from "#/pages/digest-editor";
import { articleSearchQuery, searchArticles } from "#/shared/api";

const searchParams = articleSearchQuery.partial();

// API の結果を確かめる検証用。サイドバーにタブは出さない (issue #170)
export const Route = createFileRoute("/_shell/admin/articles/search")({
  validateSearch: (raw: Record<string, unknown>) => searchParams.safeParse(raw).data ?? {},
  beforeLoad: async () => await resolveDigestEditorPage(),
  loaderDeps: ({ search }) => search,
  loader: async ({ deps: { q } }) =>
    q === undefined ? undefined : await searchArticles({ data: { q } }),
  component: ArticleSearchPage,
});
