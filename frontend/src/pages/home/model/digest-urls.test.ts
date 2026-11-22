import { describe, expect, it } from "vitest";
import { digest } from "#/shared/api";
import { digestHasUrl } from "./digest-urls";

const meta = {
  category: "その他",
  hot: false,
  repost: false,
  hidden: false,
  listed: true,
  originalStatus: "published",
} as const;

const latest = digest.parse({
  id: "0b2a2f3e-0000-4000-8000-000000000001",
  entryDate: "2026-10-21",
  status: "published",
  articles: [
    {
      ...meta,
      id: "0b2a2f3e-0000-4000-8000-000000000002",
      title: "parent",
      url: "https://x.example/parent",
      children: [
        {
          ...meta,
          id: "0b2a2f3e-0000-4000-8000-000000000003",
          title: "child",
          url: "https://x.example/child",
        },
      ],
    },
    {
      ...meta,
      id: "0b2a2f3e-0000-4000-8000-000000000004",
      title: "second",
      url: "https://x.example/second",
      children: [
        {
          ...meta,
          id: "0b2a2f3e-0000-4000-8000-000000000005",
          title: "second-child-a",
          url: "https://x.example/second-child-a",
        },
        {
          ...meta,
          id: "0b2a2f3e-0000-4000-8000-000000000006",
          title: "second-child-b",
          url: "https://x.example/second-child-b",
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

  it("accepts a url that only one of several articles and children has", () => {
    expect(digestHasUrl(latest, "https://x.example/second-child-b")).toBeTruthy();
  });

  it("rejects urls outside the digest so previews cannot fetch arbitrary sites", () => {
    expect(digestHasUrl(latest, "https://evil.example/")).toBeFalsy();
    expect(digestHasUrl(null, "https://x.example/parent")).toBeFalsy();
  });
});
