import { createServerOnlyFn } from "@tanstack/react-start";

// Cloud Run は Cloudflare の proxy 配下にないので fetch の cf.cacheTtl は効かず、Cache API に自分で載せる (adr/frontend/0002)
// vite dev (Node) には caches が無いので素通しにする
const openCache = async () => await (globalThis as { caches?: CacheStorage }).caches?.open("times");

export const cachedJson = createServerOnlyFn(
  async <T>(
    key: string,
    ttlSeconds: number | ((value: T) => number),
    load: () => Promise<T>,
  ): Promise<T> => {
    const cache = await openCache();
    const req = new Request(key);
    const hit = await cache?.match(req);
    if (hit !== undefined) {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- 自分で put した JSON しか入っていない
      return (await hit.json()) as T;
    }
    const value = await load();
    const ttl = typeof ttlSeconds === "function" ? ttlSeconds(value) : ttlSeconds;
    await cache?.put(
      req,
      Response.json(value, { headers: { "cache-control": `public, max-age=${ttl}` } }),
    );
    return value;
  },
);
