import { getRouteApi } from "@tanstack/react-router";
import { Logo } from "#/shared/ui/logo";
import { About } from "./about";
import { DigestCard } from "./digest-card";
import styles from "./home-page.module.css";

// getRouteApi でルート定義 (app 層) を import せずに loader の型を得る
const route = getRouteApi("/");

// トップはシェルの外の入り口ページ (adr/frontend/0003)
export const HomePage = () => {
  const digest = route.useLoaderData();
  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        <div className={styles.fit}>
          <h1 className={styles.site}>
            <Logo hero />
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
        <a href="https://github.com/Hol1kgmg" rel="noopener noreferrer" target="_blank">
          GitHub
        </a>
      </footer>
    </div>
  );
};
