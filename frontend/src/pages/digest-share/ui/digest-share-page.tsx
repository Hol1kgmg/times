import { SITE_URL } from "#/shared/config/site";
import { formatEntryDateWithoutYear } from "#/shared/lib/entry-date";
import { RouterLink } from "#/shared/ui/router-link";
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
export const DigestSharePage = () => (
  <main className={styles.page}>
    <span aria-hidden="true" className={styles.spinner} />
    <p>
      トップへ移動してます。移らないときは
      <RouterLink className={styles.link} to="/">
        こちら
      </RouterLink>
    </p>
  </main>
);
