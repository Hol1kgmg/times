import type { Digest } from "#/shared/api/schemas";

export const digestHasUrl = (digest: Digest | null, url: string) =>
  digest?.items.some((a) => a.url === url || a.children.some((c) => c.url === url)) ?? false;
