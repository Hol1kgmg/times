import { notFound } from "@tanstack/react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SESSION_EXPIRED } from "#/shared/auth";
import { memoLinkPreview } from "./memo-link-preview";

const preview = { title: "A", description: null, image: null };

describe(memoLinkPreview, () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the same promise for the same url so use() does not suspend again", () => {
    const load = memoLinkPreview(async () => await Promise.resolve(preview));
    expect(load("https://a.example")).toBe(load("https://a.example"));
  });

  it("resolves to no preview when the fetch fails", async () => {
    const load = memoLinkPreview(async () => await Promise.reject(new Error("boom")));
    await expect(load("https://a.example")).resolves.toBeNull();
  });

  it("fetches a failed preview again after the server forgets the failure", async () => {
    vi.useFakeTimers();
    const load = memoLinkPreview(async () => await Promise.resolve(null));
    const failed = load("https://a.example");
    await failed;
    expect(load("https://a.example")).toBe(failed);
    vi.advanceTimersByTime(3_600_000);
    expect(load("https://a.example")).not.toBe(failed);
  });

  it("fetches again a minute after the login expired so logging back in shows the preview", async () => {
    vi.useFakeTimers();
    const load = memoLinkPreview(
      vi.fn().mockRejectedValue(notFound({ data: { reason: SESSION_EXPIRED } })),
    );
    const expired = load("https://a.example");
    await expired;
    vi.advanceTimersByTime(60_000);
    expect(load("https://a.example")).not.toBe(expired);
  });
});
