import { SITE_URL } from "#/shared/config/site";
import { formatEntryDateWithoutYear } from "#/shared/lib/entry-date";
import styles from "./digest-share-page.module.css";

// 題名はフィードの item と同じ形にする。fixed-chars の対象外に置き、表示しない字でトップのサブセットを太らせない
export const digestShareHead = (date: string) => {
  const label = formatEntryDateWithoutYear(date);
  return {
    meta: [
      { httpEquiv: "refresh", content: "0; url=/" },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: `${label}の times 投稿が公開されました` },
      // v は backend の feed.go の imageVersion と揃える。フィードの画像 URL と同じものを指すため
      { property: "og:image", content: `${SITE_URL}/feed/images/${date}.png?v=1` },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: label },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/` }],
  };
};

// refresh を止めている人には移動が起きないので、案内の中にリンクを置く
// RouterLink だと refresh の読み込み中に押されたとき、SPA 遷移の後に文書ごと / へ置き換わって page_view が二重になる
export const DigestSharePage = () => (
  <main className={styles.page}>
    <span aria-hidden="true" className={styles.spinner} />
    <p className={styles.message}>
      トップへ移動してます。移らないときは
      <a className={styles.link} href="/">
        トップへ
      </a>
    </p>
  </main>
);
