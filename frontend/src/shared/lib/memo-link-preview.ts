import type { LinkPreview } from "./parse-link-preview";

const FAILURE_TTL_MS = 3_600_000;

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
    // 表示中は描画ごとに呼ばれるので、解決してすぐ消すと取り直し続ける。サーバーが失敗を覚える 1 時間にそろえる (adr/frontend/0002)
    void p.then((preview) => {
      if (preview === null) {
        setTimeout(() => {
          previews.delete(url);
        }, FAILURE_TTL_MS);
      }
      return preview;
    });
    return p;
  };
};
