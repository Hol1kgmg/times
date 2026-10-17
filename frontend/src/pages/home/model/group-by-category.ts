// barrel (#/shared/api) は .server.ts を再 export しており、クライアントで走るコードから import すると build が落ちる
import type { Article, Category } from "#/shared/api/schemas";
import { category } from "#/shared/api/schemas";

// カテゴリの固定順 (openapi.yaml の enum 順) に並べ、記事が 0 件のカテゴリは落とす。記事の順序は入力順のまま
export const groupByCategory = (items: readonly Article[]) =>
  category.options
    .map((name): [Category, Article[]] => [name, items.filter((a) => a.category === name)])
    .filter(([, articles]) => articles.length > 0);
