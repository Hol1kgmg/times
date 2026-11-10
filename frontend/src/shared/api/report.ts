import { anonymousId } from "#/shared/lib/anonymous-id";
import type { ArticleId } from "./schemas";

// sendBeacon は Chrome で ping 種別になりブロッカーのルールに当たるので、fetch の keepalive で送る
const post = (body: object) => {
  fetch("/open", {
    method: "POST",
    keepalive: true,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...body, clientId: anonymousId() }),
  }).catch(() => {
    // 計測の失敗は読み手に関係なく、再送もしない (specs/013 FR-003)
  });
};

export const reportArticleOpen =
  (entryDate: string) => (article: { id: ArticleId; url: string }) => {
    post({ event: "article_click", articleId: article.id, url: article.url, entryDate });
  };

export const reportPageView = () => {
  post({
    event: "page_view",
    location: location.origin + location.pathname,
    title: document.title,
  });
};
