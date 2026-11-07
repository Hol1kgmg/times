import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { cachedJson, cachedResponse } from "./cache.server";

const stubCaches = () => {
  const cache = {
    match: vi.fn<(req: Request) => Promise<Response | undefined>>(),
    put: vi.fn<(req: Request, res: Response) => Promise<void>>().mockResolvedValue(),
  };
  vi.stubGlobal("caches", { open: vi.fn<() => Promise<typeof cache>>().mockResolvedValue(cache) });
  return cache;
};

const counter = z.object({ n: z.number() });
const nothing = z.null();

describe(cachedJson, () => {
  it("loads once and serves the second call from the cache with the ttl", async () => {
    const cache = stubCaches();
    const load = vi.fn<() => Promise<{ n: number }>>().mockResolvedValue({ n: 1 });
    await expect(cachedJson("https://example.test/a", counter, 300, load)).resolves.toStrictEqual({
      n: 1,
    });

    const [req, stored] = cache.put.mock.calls[0] ?? [];
    expect(req?.url).toBe("https://example.test/a");
    expect(stored?.headers.get("cache-control")).toBe("public, max-age=300");

    cache.match.mockResolvedValue(stored);
    await expect(cachedJson("https://example.test/a", counter, 300, load)).resolves.toStrictEqual({
      n: 1,
    });
    expect(load).toHaveBeenCalledOnce();
  });

  it("reloads when the cached value does not match the schema", async () => {
    const cache = stubCaches();
    cache.match.mockResolvedValue(Response.json({ old: true }));
    const load = vi.fn<() => Promise<{ n: number }>>().mockResolvedValue({ n: 1 });
    await expect(cachedJson("https://example.test/a", counter, 300, load)).resolves.toStrictEqual({
      n: 1,
    });
    expect(cache.put).toHaveBeenCalledOnce();
  });

  it("derives the ttl from the loaded value when given a function", async () => {
    const cache = stubCaches();
    const maybeText = z.string().nullable();
    const ttl = vi.fn<(v: null | string) => number>((v) => (v === null ? 3600 : 86_400));
    await cachedJson(
      "https://example.test/a",
      maybeText,
      ttl,
      vi.fn<() => Promise<null>>().mockResolvedValue(null),
    );
    await cachedJson(
      "https://example.test/b",
      maybeText,
      ttl,
      vi.fn<() => Promise<string>>().mockResolvedValue("ok"),
    );

    const headers = cache.put.mock.calls.map(([, res]) => res.headers.get("cache-control"));
    expect(headers).toStrictEqual(["public, max-age=3600", "public, max-age=86400"]);
  });

  it("serves a cached null without reloading", async () => {
    const cache = stubCaches();
    cache.match.mockResolvedValue(Response.json(null));
    const load = vi.fn<() => Promise<null>>().mockResolvedValue(null);
    await expect(cachedJson("https://example.test/a", nothing, 300, load)).resolves.toBeNull();
    expect(load).not.toHaveBeenCalled();
  });

  it("does not store anything when load throws", async () => {
    const cache = stubCaches();
    const load = vi.fn<() => Promise<null>>().mockRejectedValue(new Error("boom"));
    await expect(cachedJson("https://example.test/a", nothing, 300, load)).rejects.toThrow("boom");
    expect(cache.put).not.toHaveBeenCalled();
  });

  it("passes through when the runtime has no caches", async () => {
    vi.stubGlobal("caches", null);
    const load = vi.fn<() => Promise<null>>().mockResolvedValue(null);
    await expect(cachedJson("https://example.test/a", nothing, 300, load)).resolves.toBeNull();
    await expect(cachedJson("https://example.test/a", nothing, 300, load)).resolves.toBeNull();
    expect(load).toHaveBeenCalledTimes(2);
  });
});

describe(cachedResponse, () => {
  it("serves a 200 from the cache on the second call but reloads a 404 every time", async () => {
    const cache = stubCaches();
    const ok = vi.fn<() => Promise<Response>>().mockResolvedValue(new Response("png"));
    await cachedResponse("https://example.test/ok", 300, ok);
    cache.match.mockResolvedValue(cache.put.mock.calls[0]?.[1]);
    const second = await cachedResponse("https://example.test/ok", 300, ok);
    expect(ok).toHaveBeenCalledOnce();
    expect(second.headers.get("cache-control")).toBe("public, max-age=300");

    cache.match.mockReset();
    const missing = vi
      .fn<() => Promise<Response>>()
      .mockResolvedValue(new Response(null, { status: 404 }));
    await cachedResponse("https://example.test/missing", 300, missing);
    await cachedResponse("https://example.test/missing", 300, missing);
    expect(missing).toHaveBeenCalledTimes(2);
  });
});
