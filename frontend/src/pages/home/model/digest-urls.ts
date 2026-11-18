import type { Digest } from "#/shared/api";

export const digestHasUrl = (digest: Digest | null, url: string) =>
  digest?.articles.some(
    (a) => (a.concealed !== true && a.url === url) || a.children.some((c) => c.url === url),
  ) ?? false;
