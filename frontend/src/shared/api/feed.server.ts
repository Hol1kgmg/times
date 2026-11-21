import { createServerOnlyFn } from "@tanstack/react-start";
import { z } from "zod";
import { backendFetch, unwrapBackend } from "./backend.server";
import { cacheKey, cachedJson } from "./cache.server";

// トップと同じく、ほかの地域には 5 分の遅れを許容する (adr/frontend/0002)
const TTL_SECONDS = 300;

export const loadFeedXml = createServerOnlyFn(
  async () =>
    await cachedJson(cacheKey.feed, z.string(), TTL_SECONDS, async () => {
      const res = unwrapBackend(await backendFetch("/feed"));
      return await res.text();
    }),
);

// XML は自分の backend が作るので、パースせず item の link の末尾で判定する (specs/010 research R7)
export const isInFeed = (xml: string, date: string): boolean =>
  xml.includes(`/digest/${date}</link>`);
