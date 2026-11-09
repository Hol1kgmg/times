import type { ArticleId } from "./schemas";

// sendBeacon は Chrome で ping 種別になりブロッカーのルールに当たるので、fetch の keepalive で送る
export const reportArticleOpen =
  (entryDate: string) => (article: { id: ArticleId; url: string }) => {
    fetch("/open", {
      method: "POST",
      keepalive: true,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ articleId: article.id, url: article.url, entryDate }),
    }).catch(() => {
      // 計測の失敗は読み手に関係なく、再送もしない (specs/013 FR-003)
    });
  };
