import { describe, expect, it } from "vitest";
import { BackendProblemError } from "#/shared/api/backend-problem-error";
import type { Problem } from "#/shared/api";
import { rejectionOf } from "./rejection-of";

const failed = (type: Problem["type"], extra?: Partial<Problem>) =>
  new BackendProblemError("backend 400: POST /digests", 400, {
    type,
    title: "Bad Request",
    status: 400,
    ...extra,
  });

describe(rejectionOf, () => {
  it("returns the already registered urls and the articles they can be reposted as", () => {
    const repostable = [
      { url: "https://a.example", title: "a", category: "IT系", firstPublishedOn: "2026-10-03" },
    ] satisfies Problem["repostable"];
    const err = failed("/problems/url-already-registered", {
      duplicateUrls: ["https://a.example", "https://b.example"],
      repostable,
    });
    expect(rejectionOf(err)).toStrictEqual({
      reason: "url-already-registered",
      duplicateUrls: ["https://a.example", "https://b.example"],
      repostable,
    });
  });

  it("returns the reposts that have nothing to point to so the page can mark those cards", () => {
    const err = failed("/problems/repost-unavailable", { duplicateUrls: ["https://a.example"] });
    expect(rejectionOf(err)).toStrictEqual({
      reason: "repost-unavailable",
      duplicateUrls: ["https://a.example"],
    });
  });

  it("tells the page that the entry date is already taken", () => {
    expect(rejectionOf(failed("/problems/digest-already-exists"))).toStrictEqual({
      reason: "digest-already-exists",
    });
  });

  it("tells the page that a future date cannot be published", () => {
    expect(rejectionOf(failed("/problems/future-publish"))).toStrictEqual({
      reason: "future-publish",
    });
  });

  it("leaves other failures to the generic error message", () => {
    expect(rejectionOf(failed("/problems/validation-failed"))).toBeUndefined();
  });
});
