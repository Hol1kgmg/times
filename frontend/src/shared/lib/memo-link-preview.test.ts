import { describe, expect, it, vi } from "vitest";
import { memoLinkPreview } from "./memo-link-preview";

const preview = { title: "A", description: null, image: null };

describe(memoLinkPreview, () => {
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
    vi.useRealTimers();
  });
});
