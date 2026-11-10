import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { handleOpen } from "./open.server";

const DESKTOP = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130.0";
const MOBILE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148";

const open = async (body: unknown, userAgent = DESKTOP) =>
  await handleOpen(
    new Request("https://z-times.dev/open", {
      method: "POST",
      headers: { "content-type": "application/json", "user-agent": userAgent },
      body: JSON.stringify(body),
    }),
  );

const clientId = "5f1d7c2a-3b4e-4f6a-8c9d-0e1f2a3b4c5d";

const valid = {
  event: "article_click",
  clientId,
  articleId: "0b6c2f4e-8a1d-4c3b-9e5f-7a2d1c0b9e8f",
  url: "https://example.com/post",
  entryDate: "2026-11-09",
};

const pageView = {
  event: "page_view",
  clientId,
  location: "https://z-times.dev/timeline?utm_source=x#top",
  title: "#timeline | z_times.dev",
};

const sent = z.object({
  client_id: z.string(),
  device: z.object({ category: z.string() }),
  events: z.tuple([z.object({ params: z.record(z.string(), z.union([z.string(), z.number()])) })]),
});

const sentEvent = (fetch: ReturnType<typeof vi.fn<typeof globalThis.fetch>>) =>
  sent.parse(JSON.parse(z.string().parse(fetch.mock.calls[0]?.[1]?.body)));

describe("閲覧と記事を開いた記録の受付", () => {
  let fetch: ReturnType<typeof vi.fn<typeof globalThis.fetch>>;
  beforeEach(() => {
    fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(null));
    vi.stubGlobal("fetch", fetch);
    vi.stubEnv("GA_MEASUREMENT_ID", "G-TEST");
    vi.stubEnv("GA_API_SECRET", "secret");
  });

  it("rejects a body whose entryDate is not a date without forwarding it", async () => {
    const res = await open({ ...valid, entryDate: "11/09" });
    expect(res.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects a clientId that is not a UUID", async () => {
    const res = await open({ ...valid, clientId: "x".repeat(36) });
    expect(res.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects an event name outside article_click and page_view", async () => {
    const res = await open({ ...pageView, event: "scroll" });
    expect(res.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects a body larger than 4 KB", async () => {
    const res = await open({ ...pageView, title: "a".repeat(5000) });
    expect(res.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("drops a request from a bot user agent", async () => {
    const res = await open(valid, "Mozilla/5.0 HeadlessChrome/130.0");
    expect(res.status).toBe(204);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("forwards the browser's anonymous id as the GA4 client id", async () => {
    await open(valid);
    expect(sentEvent(fetch).client_id).toBe(clientId);
  });

  it("classifies a mobile user agent as mobile", async () => {
    await open(valid, MOBILE);
    expect(sentEvent(fetch).device.category).toBe("mobile");
  });

  it("cuts article_url to the 100 characters GA4 accepts", async () => {
    await open({ ...valid, url: `https://example.com/${"a".repeat(200)}` });
    expect(sentEvent(fetch).events[0].params.article_url).toHaveLength(100);
  });

  it("drops the query string and fragment from page_location", async () => {
    await open(pageView);
    expect(sentEvent(fetch).events[0].params.page_location).toBe("https://z-times.dev/timeline");
  });
});
