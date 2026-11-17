import { describe, expect, it } from "vitest";
import { digest } from "#/shared/api";
import { digestHasUrl } from "./digest-urls";

const latest = digest.parse({
  id: "0b2a2f3e-0000-4000-8000-000000000001",
  entryDate: "2026-10-21",
  status: "published",
  articles: [
    {
      id: "0b2a2f3e-0000-4000-8000-000000000002",
      category: "その他",
      hot: false,
      repost: false,
      title: "parent",
      url: "https://x.example/parent",
      children: [
        {
          id: "0b2a2f3e-0000-4000-8000-000000000003",
          hot: false,
          title: "child",
          url: "https://x.example/child",
        },
      ],
    },
  ],
});

describe(digestHasUrl, () => {
  it("accepts urls of both articles and child articles in the digest", () => {
    expect(digestHasUrl(latest, "https://x.example/parent")).toBeTruthy();
    expect(digestHasUrl(latest, "https://x.example/child")).toBeTruthy();
  });

  it("rejects urls outside the digest so previews cannot fetch arbitrary sites", () => {
    expect(digestHasUrl(latest, "https://evil.example/")).toBeFalsy();
    expect(digestHasUrl(null, "https://x.example/parent")).toBeFalsy();
  });
});
