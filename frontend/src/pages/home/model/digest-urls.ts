import type { Digest } from "#/shared/api/schemas";

export const digestHasUrl = (digest: Digest | null, url: string) =>
  digest?.articles.some((a) => a.url === url || a.children.some((c) => c.url === url)) ?? false;
