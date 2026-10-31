import { describe, expect, it } from "vitest";
import { newDigest } from "#/shared/api";
import { digestMarkdown } from "./digest-markdown";

const make = (articles: unknown[]) => newDigest.parse({ entryDate: "2026-10-20", articles });

describe(digestMarkdown, () => {
  it("gathers hot articles with their children first and drops categories left empty", () => {
    const digest = make([
      { category: "その他", title: "b", url: "https://x.example/b", children: [] },
      {
        category: "セキュリティ",
        hot: true,
        title: "a",
        url: "https://x.example/a",
        children: [{ title: "a1", url: "https://x.example/a1" }],
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

  it("escapes brackets in titles and falls back to the URL for a blank title", () => {
    const digest = make([
      { category: "その他", title: "[PR] x", url: "https://x.example/a", children: [] },
    ]);
    const blank = { ...digest.articles[0], title: " " };
    expect(digestMarkdown(digest)).toBe("その他\n- [\\[PR\\] x](https://x.example/a)");
    expect(digestMarkdown({ ...digest, articles: [blank] })).toBe("その他\n- https://x.example/a");
  });
});
