// barrel (#/shared/api) は .server.ts を再 export しており、クライアントで走るコードから import すると build が落ちる
import type { Article, Category } from "#/shared/api/schemas";
import { category } from "#/shared/api/schemas";

// 表示順はカテゴリの固定順 = openapi.yaml の enum 順 (specs/001 FR-007) なので category.options の並びをそのまま使う
export const groupByCategory = (items: readonly Article[]) =>
  category.options
    .map((name): [Category, Article[]] => [name, items.filter((a) => a.category === name)])
    .filter(([, articles]) => articles.length > 0);
