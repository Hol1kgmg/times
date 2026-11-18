import type { ChildArticle, Digest } from "#/shared/api";
import { groupByCategory } from "#/shared/lib/group-by-category";

const link = (a: Pick<ChildArticle, "title" | "url">) => {
  const title = a.title.trim();
  return title === "" ? a.url : `[${title.replaceAll(/[[\]]/gu, "\\$&")}](${a.url})`;
};

// 印は公開ページと同じく、閲覧者が見られる前の掲載があるときだけ付ける (specs/018 FR-010)
const parentLine = (a: Digest["articles"][number]) => {
  if (a.concealed === true) {
    return "- 非公開記事";
  }
  return `- ${a.firstPublishedOn === undefined ? "" : "再掲載 "}${link(a)}`;
};

const section = (name: string, articles: Digest["articles"]) =>
  [
    name,
    ...articles.flatMap((a) => [parentLine(a), ...a.children.map((c) => `  - ${link(c)}`)]),
  ].join("\n");

// HOT の子を持つ親も話題ごと先頭にまとめる。子だけ抜くと何の続報か分からなくなるため
const isHot = (a: Digest["articles"][number]) => a.hot || a.children.some((c) => c.hot);

// HOT は本来のカテゴリから抜いて先頭にまとめる。同じ記事が 2 か所に出ないようにするため
export const digestMarkdown = (digest: Digest) => {
  const hot = digest.articles.filter(isHot);
  const sections = groupByCategory(digest.articles.filter((a) => !isHot(a))).map(
    ([name, articles]) => section(name, articles),
  );
  return (hot.length > 0 ? [section("ホットトピック", hot), ...sections] : sections).join("\n\n");
};

export const latestDigestMarkdown = (digest: Digest | null) =>
  digest === null ? "まだ記事がありません" : `${digest.entryDate}\n\n${digestMarkdown(digest)}`;
