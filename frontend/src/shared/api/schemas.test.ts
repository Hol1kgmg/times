import { describe, expect, it } from "vitest";
import { article, item, itemId, newArticle } from "./schemas";

describe("schemas", () => {
  it("rejects a non-uuid id", () => {
    expect(itemId.safeParse("1").success).toBeFalsy();
    expect(
      item.safeParse({ id: "1", title: "t", createdAt: "2026-01-01T00:00:00Z" }).success,
    ).toBeFalsy();
  });

  it("rejects a category outside the fixed set", () => {
    const base = {
      id: "b3b2b6e0-1c8e-4b6a-9f1e-3b8d0d0a1c2d",
      title: "t",
      url: "https://x.example",
    };
    expect(article.safeParse({ ...base, category: "その他" }).success).toBeTruthy();
    expect(article.safeParse({ ...base, category: "未知" }).success).toBeFalsy();
  });

  it("accepts only http(s) URLs for a new article", () => {
    const base = { category: "その他", title: "t" };
    expect(newArticle.safeParse({ ...base, url: "https://x.example/a" }).success).toBeTruthy();
    expect(newArticle.safeParse({ ...base, url: "http://x.example/a" }).success).toBeTruthy();
    // eslint-disable-next-line no-script-url -- 弾く対象の文字列そのもの
    expect(newArticle.safeParse({ ...base, url: "javascript:alert(1)" }).success).toBeFalsy();
    expect(newArticle.safeParse({ ...base, url: "data:text/html,x" }).success).toBeFalsy();
  });
});
