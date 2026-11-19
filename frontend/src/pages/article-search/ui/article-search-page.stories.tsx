import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { fn } from "storybook/test";
import { ARTICLE_SEARCH_LIMIT, articleSearchResult } from "#/shared/api";
import { ArticleSearchView } from "./article-search-page";

const hit = (
  n: number,
  extra: {
    title?: string;
    parent?: { url: string; title: string };
    repostedOn?: string[];
    hotOn?: string[];
  } = {},
) => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
  url: `https://example.com/articles/${n}`,
  title: `記事のタイトル ${n}`,
  category: "IT系",
  firstPublishedOn: "2026-10-03",
  repostedOn: [],
  hotOn: [],
  ...extra,
});

const meta = {
  component: ArticleSearchView,
  args: { q: "記事", result: undefined, onSearch: fn().mockResolvedValue(undefined) },
  // モーダルの編集へのリンクは RouterLink なので、行き先を持たない Router だけ載せる
  decorators: [
    (Story) => (
      <RouterProvider
        router={createRouter({
          routeTree: createRootRoute({ component: Story }),
          history: createMemoryHistory(),
        })}
      />
    ),
  ],
} satisfies Meta<typeof ArticleSearchView>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Initial: Story = { args: { q: undefined } };
export const NotFound: Story = { args: { result: articleSearchResult.parse({ articles: [] }) } };
export const Found: Story = {
  args: {
    result: articleSearchResult.parse({
      articles: [
        hit(1, { repostedOn: ["2026-10-20", "2026-11-02"], hotOn: ["2026-10-03", "2026-11-02"] }),
        hit(2, { parent: { url: "https://example.com/articles/1", title: "記事のタイトル 1" } }),
        hit(3, {
          title:
            "とても長いタイトルの記事は一覧の幅に収まらないので、折り返さずに末尾を省略して 1 行に収める",
        }),
      ],
    }),
  },
};
export const Truncated: Story = {
  args: {
    result: articleSearchResult.parse({
      articles: Array.from({ length: ARTICLE_SEARCH_LIMIT }, (_, i) => hit(i + 1)),
    }),
  },
};
