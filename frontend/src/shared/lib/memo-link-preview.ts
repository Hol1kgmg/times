import type { LinkPreview } from "./parse-link-preview";

export const memoLinkPreview = (
  fetchPreview: (opts: { data: string }) => Promise<LinkPreview | null>,
): ((url: string) => Promise<LinkPreview | null>) => {
  const previews = new Map<string, Promise<LinkPreview | null>>();
  // oxlint-disable-next-line typescript/promise-function-async -- async にすると毎 render 新しい Promise になり use() が再サスペンドし続ける
  return (url) => {
    const cached = previews.get(url);
    if (cached !== undefined) {
      return cached;
    }
    // use() は reject を throw するので、失敗は「プレビューなし」に畳む
    const p = fetchPreview({ data: url }).catch(() => null);
    previews.set(url, p);
    return p;
  };
};
