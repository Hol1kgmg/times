import { describe, expect, it } from "vitest";
import { rowRejectionOf } from "./row-rejection";

const repostable = (url: string) => ({
  url,
  title: url,
  category: "その他" as const,
  firstPublishedOn: "2026-01-01",
});

describe("保存を断られた行の印", () => {
  it("marks registered articles that could not become reposts, and the converted ones apart", () => {
    const rows = rowRejectionOf({
      reason: "url-already-registered",
      duplicateUrls: ["https://a.example/", "https://b.example/"],
      repostable: [repostable("https://b.example/")],
    });
    expect(rows).toStrictEqual({
      registered: new Set(["https://a.example/"]),
      converted: new Set(["https://b.example/"]),
      unavailable: new Set(),
    });
  });

  it("marks every article as unavailable when reposting itself was refused", () => {
    const rows = rowRejectionOf({
      reason: "repost-unavailable",
      duplicateUrls: ["https://a.example/"],
    });
    expect(rows.unavailable).toStrictEqual(new Set(["https://a.example/"]));
    expect(rows.registered.size + rows.converted.size).toBe(0);
  });
});
