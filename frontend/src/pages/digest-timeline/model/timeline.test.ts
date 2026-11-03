import { describe, expect, it } from "vitest";
import { digest } from "#/shared/api";
import { PAGE_SIZE, prependPage } from "./timeline";

const day = (n: number) =>
  digest.parse({
    id: `0b2a2f3e-0000-4000-8000-${String(n).padStart(12, "0")}`,
    entryDate: `2026-10-${String(n).padStart(2, "0")}`,
    status: "published",
    articles: [],
  });

describe(prependPage, () => {
  it("puts a full page oldest first above the current posts and expects more", () => {
    const page = Array.from({ length: PAGE_SIZE }, (_, i) => day(PAGE_SIZE - i));
    const current = [day(20)];
    expect(prependPage(current, page)).toStrictEqual({
      digests: [...page.toReversed(), ...current],
      done: false,
    });
  });

  it("stops when a page is shorter than the page size", () => {
    expect(prependPage([day(20)], [day(2), day(1)])).toStrictEqual({
      digests: [day(1), day(2), day(20)],
      done: true,
    });
  });
});
