import type { Digest, DigestContent, NewChildArticle } from "#/shared/api";
import { groupByCategory } from "#/shared/lib/group-by-category";

const link = (a: NewChildArticle) => {
  const title = a.title.trim();
  return title === "" ? a.url : `[${title.replaceAll(/[[\]]/gu, "\\$&")}](${a.url})`;
};

const section = (name: string, articles: DigestContent["articles"]) =>
  [
    name,
    ...articles.flatMap((a) => [`- ${link(a)}`, ...a.children.map((c) => `  - ${link(c)}`)]),
  ].join("\n");

// HOT は本来のカテゴリから抜いて先頭にまとめる。同じ記事が 2 か所に出ないようにするため
export const digestMarkdown = (digest: DigestContent) => {
  const hot = digest.articles.filter((a) => a.hot);
  const sections = groupByCategory(digest.articles.filter((a) => !a.hot)).map(([name, articles]) =>
    section(name, articles),
  );
  return (hot.length > 0 ? [section("ホットトピック", hot), ...sections] : sections).join("\n\n");
};

export const latestDigestMarkdown = (digest: Digest | null) =>
  digest === null ? "まだ記事がありません" : `${digest.entryDate}\n\n${digestMarkdown(digest)}`;
