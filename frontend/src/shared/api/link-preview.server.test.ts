import { describe, expect, it, vi } from "vitest";
import { loadLinkPreviewCached } from "./link-preview.server";

const htmlResponse = (...chunks: string[]) => {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
  return new Response(body, { headers: { "content-type": "text/html; charset=utf-8" } });
};

describe(loadLinkPreviewCached, () => {
  it("reads og tags streamed into the body after </head>", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          htmlResponse(
            "<html><head><title>shell</title></head><body>",
            '<meta property="og:title" content="streamed"/></body></html>',
          ),
        ),
    );
    await expect(loadLinkPreviewCached("https://example.test/a")).resolves.toMatchObject({
      title: "streamed",
    });
  });

  it("gives no preview when the site cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockRejectedValue(new TypeError("fetch failed")));
    await expect(loadLinkPreviewCached("https://example.test/b")).resolves.toBeNull();
  });

  it("does not hide unexpected errors as a missing preview", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockRejectedValue(new RangeError("bug")));
    await expect(loadLinkPreviewCached("https://example.test/c")).rejects.toThrow("bug");
  });
});
