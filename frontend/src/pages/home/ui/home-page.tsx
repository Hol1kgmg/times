import { getRouteApi } from "@tanstack/react-router";
import { category } from "#/shared/api/schemas";
import type { Category } from "#/shared/api/schemas";
import { Logo } from "#/shared/ui/logo";
import { DigestCard } from "./digest-card";
import styles from "./home-page.module.css";

// getRouteApi でルート定義 (app 層) を import せずに loader の型を得る
const route = getRouteApi("/");

const categoryDescriptions = {
  ホットトピック: "その日いちばん話題になっていたもの",
  セキュリティ: "注意喚起や脆弱性の情報",
  IT系: "設計や開発全般の記事・スライド",
  UI系: "デザインやフロントエンドの表現",
  AI系: "AI やエージェントまわり",
  "面白そうなツール・サービス": "試してみたいツール",
  その他: "上のどれにも入らないもの",
} satisfies Record<Category, string>;

const About = () => (
  <section aria-labelledby="about" className={styles.about}>
    <h2 className={styles.aboutHeading} id="about">
      このサイトについて
    </h2>
    <dl className={styles.facts}>
      <dt className={styles.term}>目的</dt>
      <dd>
        管理者が日々見かけた技術記事や面白いサイトを、1 日 1 本の Digest にまとめて残しています。
      </dd>
      <dt className={styles.term}>カテゴリ</dt>
      <dd>
        <ul className={styles.categories}>
          {category.options.map((c) => (
            <li key={c}>
              <span className={styles.categoryName}>{c}</span>
              {categoryDescriptions[c]}
            </li>
          ))}
        </ul>
      </dd>
      <dt className={styles.term}>更新頻度</dt>
      <dd>毎日</dd>
      <dt className={styles.term}>運営者</dt>
      <dd>
        Hol1kgmg (
        <a href="https://github.com/Hol1kgmg" rel="noopener noreferrer" target="_blank">
          GitHub
        </a>
        )
      </dd>
    </dl>
  </section>
);

// トップはシェルの外の入り口ページ (adr/frontend/0003)
export const HomePage = () => {
  const digest = route.useLoaderData();
  return (
    <div className={styles.page}>
      <div className={styles.fit}>
        <h1 className={styles.site}>
          <Logo hero />
        </h1>
        <p className={styles.intro}>
          管理者が見かけた技術や趣味などの記事やサイトを日々投稿しています
        </p>
        <DigestCard digest={digest} />
      </div>
      <About />
    </div>
  );
};
