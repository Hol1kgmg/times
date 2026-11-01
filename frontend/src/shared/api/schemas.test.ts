import { describe, expect, it } from "vitest";
import { article, digestId, digestSummary, digestUpdate, newArticle } from "./schemas";

describe("schemas", () => {
  it("rejects a non-uuid id", () => {
    expect(digestId.safeParse("1").success).toBeFalsy();
    expect(
      digestSummary.safeParse({ id: "1", entryDate: "2026-10-17", status: "published" }).success,
    ).toBeFalsy();
  });

  it("rejects a category outside the fixed set", () => {
    const base = {
      id: "b3b2b6e0-1c8e-4b6a-9f1e-3b8d0d0a1c2d",
      hot: false,
      title: "t",
      url: "https://x.example",
      children: [],
    };
    expect(article.safeParse({ ...base, category: "その他" }).success).toBeTruthy();
    expect(article.safeParse({ ...base, category: "未知" }).success).toBeFalsy();
    // ホットトピックはカテゴリではなく hot で表す (specs/004)
    expect(article.safeParse({ ...base, category: "ホットトピック" }).success).toBeFalsy();
  });

  it("accepts only http(s) URLs for a new article", () => {
    const base = { category: "その他", title: "t", children: [] };
    expect(newArticle.safeParse({ ...base, url: "https://x.example/a" }).success).toBeTruthy();
    expect(newArticle.safeParse({ ...base, url: "http://x.example/a" }).success).toBeTruthy();
    // eslint-disable-next-line no-script-url -- 弾く対象の文字列そのもの
    expect(newArticle.safeParse({ ...base, url: "javascript:alert(1)" }).success).toBeFalsy();
    expect(newArticle.safeParse({ ...base, url: "data:text/html,x" }).success).toBeFalsy();
  });

  it("rejects returning a digest to draft on update", () => {
    const base = {
      entryDate: "2026-10-17",
      articles: [{ category: "その他", title: "t", url: "https://x.example", children: [] }],
    };
    expect(digestUpdate.safeParse(base).success).toBeTruthy();
    expect(digestUpdate.safeParse({ ...base, status: "private" }).success).toBeTruthy();
    expect(digestUpdate.safeParse({ ...base, status: "draft" }).success).toBeFalsy();
  });
});
