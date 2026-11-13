import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SITE_URL } from "./site";

const robots = readFileSync("public/robots.txt", "utf-8");
const sitemap = readFileSync("public/sitemap.xml", "utf-8");

describe("crawl control", () => {
  it("lists only the top page and the site info pages in the sitemap", () => {
    const locs = [...sitemap.matchAll(/<loc>(?<loc>.*?)<\/loc>/gu)].map((m) => m.groups?.loc);
    expect(locs).toStrictEqual(
      ["/", "/about", "/contact", "/privacy"].map((path) => `${SITE_URL}${path}`),
    );
  });

  it("points robots.txt at the sitemap", () => {
    expect(robots).toMatch(new RegExp(`^Sitemap: ${SITE_URL}/sitemap\\.xml$`, "mu"));
  });

  it("does not block noindex pages so crawlers can read their noindex", () => {
    const disallowed = [...robots.matchAll(/^Disallow:\s*(?<path>\S+)/gmu)].map(
      (m) => m.groups?.path ?? "",
    );
    for (const path of ["/timeline", "/health", "/digest/2026-01-01"]) {
      expect(disallowed.filter((prefix) => path.startsWith(prefix))).toStrictEqual([]);
    }
  });
});
