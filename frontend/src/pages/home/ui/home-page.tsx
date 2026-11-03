import { getRouteApi } from "@tanstack/react-router";
import { useHovered } from "#/shared/lib/use-hovered";
import { LineIcon } from "#/shared/ui/icons/line-icon";
import { Logo } from "#/shared/ui/logo";
import { About } from "./about";
import { DigestCard } from "./digest-card";
import styles from "./home-page.module.css";

// getRouteApi でルート定義 (app 層) を import せずに loader の型を得る
const route = getRouteApi("/");

// tabler の rss (MIT)
const rssIcon = "M5 19m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0M4 4a16 16 0 0 1 16 16M4 11a9 9 0 0 1 9 9";

// トップはシェルの外の入り口ページ (adr/frontend/0003)
export const HomePage = () => {
  const digest = route.useLoaderData();
  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        <div className={styles.fit}>
          <h1 className={styles.site}>
            <Logo variant="hero" />
          </h1>
          <p className={styles.intro}>
            見かけて気になった技術や趣味の記事を、日ごとにゆるくまとめてます。
          </p>
          <DigestCard digest={digest} />
          <p className={styles.hint}>記事にカーソルを合わせると中身をちょっと覗けます</p>
        </div>
      </div>
      <About />
      <footer className={styles.footer}>
        <Logo />
        {/* /feed.xml は server route なので、router の Link だと画面として描こうとする */}
        <a className={styles.feed} href="/feed.xml" {...useHovered()}>
          <LineIcon d={rssIcon} size={16} />
          RSS
        </a>
      </footer>
    </div>
  );
};
