import { describe, expect, it } from "vitest";
import { article } from "#/shared/api";
import { groupByCategory } from "./group-by-category";

const make = (id: string, category: string, title: string) =>
  article.parse({ id, category, title, url: `https://x.example/${title}` });

describe(groupByCategory, () => {
  it("orders categories by the fixed order and drops empty ones", () => {
    const items = [
      make("0b2a2f3e-0000-4000-8000-000000000001", "その他", "c"),
      make("0b2a2f3e-0000-4000-8000-000000000002", "セキュリティ", "a"),
      make("0b2a2f3e-0000-4000-8000-000000000003", "その他", "d"),
    ];
    expect(
      groupByCategory(items).map(([name, articles]) => [name, articles.map((a) => a.title)]),
    ).toStrictEqual([
      ["セキュリティ", ["a"]],
      ["その他", ["c", "d"]],
    ]);
  });

  it("returns nothing for no articles", () => {
    expect(groupByCategory([])).toStrictEqual([]);
  });
});
