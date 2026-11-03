import { describe, expect, it } from "vitest";
import { isInFeed } from "./feed.server";

const xml =
  "<rss><channel><link>https://z-times.dev/</link><item><link>https://z-times.dev/digest/2026-10-20</link></item></channel></rss>";

describe(isInFeed, () => {
  it("accepts a date listed in the feed but not a prefix of one", () => {
    expect(isInFeed(xml, "2026-10-20")).toBeTruthy();
    expect(isInFeed(xml, "2026-10-2")).toBeFalsy();
  });
});
