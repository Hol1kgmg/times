import type { Category } from "#/shared/api";
// バレルは server function も再エクスポートしていて、Storybook で Start のサーバー実装まで引き込むため
import { category } from "#/shared/api/schemas";

// 表示順はカテゴリの固定順 = openapi.yaml の enum 順 (specs/001 FR-007) なので category.options の並びをそのまま使う
export const groupByCategory = <T extends { category: Category }>(items: readonly T[]) =>
  category.options
    .map((name): [Category, T[]] => [name, items.filter((a) => a.category === name)])
    .filter(([, articles]) => articles.length > 0);

export const countArticles = (items: readonly { children: readonly unknown[] }[]) =>
  items.reduce((n, a) => n + 1 + a.children.length, 0);
