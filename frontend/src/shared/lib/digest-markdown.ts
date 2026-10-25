import type { NewChildArticle, NewDigest } from "#/shared/api/schemas";
import { groupByCategory } from "#/shared/lib/group-by-category";

const link = (a: NewChildArticle) => {
  const title = a.title.trim();
  return title === "" ? a.url : `[${title.replaceAll(/[[\]]/gu, "\\$&")}](${a.url})`;
};

const section = (name: string, articles: NewDigest["items"]) =>
  [
    name,
    ...articles.flatMap((a) => [`- ${link(a)}`, ...a.children.map((c) => `  - ${link(c)}`)]),
  ].join("\n");

// HOT は本来のカテゴリから抜いて先頭にまとめる。同じ記事が 2 か所に出ないようにするため
export const digestMarkdown = (digest: NewDigest) => {
  const hot = digest.items.filter((a) => a.hot);
  const sections = groupByCategory(digest.items.filter((a) => !a.hot)).map(([name, articles]) =>
    section(name, articles),
  );
  return (hot.length > 0 ? [section("ホットトピック", hot), ...sections] : sections).join("\n\n");
};
