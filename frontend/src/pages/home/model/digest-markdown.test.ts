import { describe, expect, it } from "vitest";
import { digest as digestSchema } from "#/shared/api";
import { digestMarkdown } from "./digest-markdown";

let seq = 0;
const id = () => {
  seq += 1;
  return `00000000-0000-4000-8000-${String(seq).padStart(12, "0")}`;
};
const make = (articles: ({ category: string; children: object[] } & Record<string, unknown>)[]) =>
  digestSchema.parse({
    id: id(),
    entryDate: "2026-10-20",
    status: "published",
    articles: articles.map((a) => ({
      id: id(),
      hot: false,
      repost: false,
      hidden: false,
      originalStatus: "published",
      ...a,
      children: a.children.map((c) => ({
        category: a.category,
        repost: false,
        originalStatus: "published",
        ...c,
      })),
    })),
  });

describe(digestMarkdown, () => {
  it("gathers hot articles with their children first and drops categories left empty", () => {
    const digest = make([
      { category: "その他", title: "b", url: "https://x.example/b", children: [] },
      {
        category: "セキュリティ",
        hot: true,
        title: "a",
        url: "https://x.example/a",
        children: [{ id: id(), hot: true, title: "a1", url: "https://x.example/a1" }],
      },
    ]);
    expect(digestMarkdown(digest)).toBe(
      [
        "ホットトピック",
        "- [a](https://x.example/a)",
        "  - [a1](https://x.example/a1)",
        "",
        "その他",
        "- [b](https://x.example/b)",
      ].join("\n"),
    );
  });

  it("marks a visible repost and gathers a parent with a hot child into the hot topics", () => {
    const digest = make([
      {
        category: "IT系",
        repost: true,
        firstPublishedOn: "2026-10-03",
        title: "a",
        url: "https://x.example/a",
        children: [{ id: id(), hot: true, title: "a1", url: "https://x.example/a1" }],
      },
      { category: "IT系", repost: true, title: "b", url: "https://x.example/b", children: [] },
    ]);
    expect(digestMarkdown(digest)).toBe(
      [
        "ホットトピック",
        "- 再掲載 [a](https://x.example/a)",
        "  - [a1](https://x.example/a1)",
        "",
        "IT系",
        "- [b](https://x.example/b)",
      ].join("\n"),
    );
  });

  it("writes a concealed parent without its content", () => {
    const digest = make([
      {
        category: "IT系",
        repost: true,
        concealed: true,
        children: [{ id: id(), hot: false, title: "a1", url: "https://x.example/a1" }],
      },
    ]);
    expect(digestMarkdown(digest)).toBe(
      ["IT系", "- 非公開記事", "  - [a1](https://x.example/a1)"].join("\n"),
    );
  });

  it("escapes brackets in titles and falls back to the URL for a blank title", () => {
    const digest = make([
      { category: "その他", title: "[PR] x", url: "https://x.example/a", children: [] },
    ]);
    const blank = { ...digest.articles[0], title: " " };
    expect(digestMarkdown(digest)).toBe("その他\n- [\\[PR\\] x](https://x.example/a)");
    expect(digestMarkdown({ ...digest, articles: [blank] })).toBe("その他\n- https://x.example/a");
  });
});
