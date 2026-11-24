import { createFileRoute } from "@tanstack/react-router";
import { ArticleSearchPage } from "#/pages/article-search";
import { articleSearchQuery, searchArticles } from "#/shared/api";

const searchParams = articleSearchQuery.partial();

// API の結果を確かめる検証用。サイドバーにタブは出さない (issue #170)
export const Route = createFileRoute("/_shell/_admin/admin/articles/search")({
  validateSearch: (raw: Record<string, unknown>) => searchParams.safeParse(raw).data ?? {},
  loaderDeps: ({ search }) => search,
  loader: async ({ deps: { q } }) =>
    q === undefined ? undefined : await searchArticles({ data: { q } }),
  component: ArticleSearchPage,
});
