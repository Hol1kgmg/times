import { createServerOnlyFn } from "@tanstack/react-start";
import type { z } from "zod";

// Cloud Run は Cloudflare の proxy 配下にないので fetch の cf.cacheTtl は効かず、Cache API に自分で載せる (adr/frontend/0002)
// vite dev (Node) には caches が無いので素通しにする
const openCache = async () => await (globalThis as { caches?: CacheStorage }).caches?.open("times");

// Workers Logs で集計する (docs/cache-metrics.md)。プレビューのキーは記事 URL を含むので先頭 2 段に丸める
const logCache = (key: string, cache: "hit" | "miss", startedAt?: number) => {
  const endpoint = new URL(key).pathname.split("/").slice(0, 3).join("/");
  console.log({
    cache,
    endpoint,
    ms: startedAt === undefined ? undefined : Date.now() - startedAt,
  });
};

export const cachedJson = createServerOnlyFn(
  async <S extends z.ZodType>(
    key: string,
    schema: S,
    ttlSeconds: number | ((value: z.output<S>) => number),
    load: () => Promise<z.output<S>>,
  ): Promise<z.output<S>> => {
    const cache = await openCache();
    const req = new Request(key);
    const hit = await cache?.match(req);
    const cached = hit === undefined ? undefined : schema.safeParse(await hit.json());
    // 形を変えたデプロイの直後は旧形が残っているので、読めなければ取り直して上書きする
    if (cached?.success === true) {
      logCache(key, "hit");
      return cached.data;
    }
    const startedAt = Date.now();
    const value = await load();
    logCache(key, "miss", startedAt);
    const ttl = typeof ttlSeconds === "function" ? ttlSeconds(value) : ttlSeconds;
    await cache?.put(
      req,
      Response.json(value, { headers: { "cache-control": `public, max-age=${ttl}` } }),
    );
    return value;
  },
);

// 画像などバイナリの応答を載せる。200 以外は載せず、毎回 load に任せる
export const cachedResponse = createServerOnlyFn(
  async (key: string, ttlSeconds: number, load: () => Promise<Response>): Promise<Response> => {
    const cache = await openCache();
    const req = new Request(key);
    const hit = await cache?.match(req);
    if (hit !== undefined) {
      logCache(key, "hit");
      return hit;
    }
    const startedAt = Date.now();
    const res = await load();
    logCache(key, "miss", startedAt);
    if (res.status !== 200) {
      return res;
    }
    const stored = new Response(res.body, res);
    stored.headers.set("cache-control", `public, max-age=${ttlSeconds}`);
    await cache?.put(req, stored.clone());
    return stored;
  },
);
