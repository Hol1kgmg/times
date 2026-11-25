import { isSessionExpired } from "#/shared/auth";
import type { LinkPreview } from "./parse-link-preview";

const FAILURE_TTL_MS = 3_600_000;
// ログインし直したら出るよう短くする。0 だと解決後の描画で取り直し続ける
const SESSION_EXPIRED_TTL_MS = 60_000;

export const memoLinkPreview = (
  fetchPreview: (opts: { data: string }) => Promise<LinkPreview | null>,
): ((url: string) => Promise<LinkPreview | null>) => {
  const previews = new Map<string, Promise<LinkPreview | null>>();
  const expiresAt = new Map<string, number>();
  // 表示中は描画ごとに呼ばれるので、失敗をすぐ忘れると取り直し続ける。サーバーが失敗を覚える 1 時間にそろえる (adr/frontend/0002)
  const forget = (url: string, ttl: number) => {
    expiresAt.set(url, Date.now() + ttl);
    return null;
  };
  const fetchOnce = async (url: string) => {
    try {
      return (await fetchPreview({ data: url })) ?? forget(url, FAILURE_TTL_MS);
    } catch (error) {
      // use() は reject を throw するので、失敗は「プレビューなし」に畳む
      return forget(url, isSessionExpired(error) ? SESSION_EXPIRED_TTL_MS : FAILURE_TTL_MS);
    }
  };
  // oxlint-disable-next-line typescript/promise-function-async -- async にすると毎 render 新しい Promise になり use() が再サスペンドし続ける
  return (url) => {
    const cached = previews.get(url);
    if (cached !== undefined && Date.now() < (expiresAt.get(url) ?? Infinity)) {
      return cached;
    }
    expiresAt.delete(url);
    const p = fetchOnce(url);
    previews.set(url, p);
    return p;
  };
};
