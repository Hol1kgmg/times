import { getRouteApi } from "@tanstack/react-router";
import { groupByCategory } from "../model/group-by-category";
import fallbackFavicon from "./fallback-favicon.svg";
import styles from "./home-page.module.css";

// getRouteApi でルート定義 (app 層) を import せずに loader の型を得る
const route = getRouteApi("/");

// sz=32 は 16px 表示を高密度画面でぼかさないため
const faviconUrl = (url: string) =>
  `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=32`;

const Favicon = ({ url }: { url: string }) => (
  <img
    alt=""
    className={styles.favicon}
    height={16}
    loading="lazy"
    src={faviconUrl(url)}
    width={16}
    onError={(e) => {
      e.currentTarget.src = fallbackFavicon;
    }}
    // Google は favicon 無しのドメインに 200 で 16px の既定画像を返すため、実寸で判定する
    onLoad={(e) => {
      if (e.currentTarget.naturalWidth < 32) {
        e.currentTarget.src = fallbackFavicon;
      }
    }}
  />
);

export const HomePage = () => {
  const digest = route.useLoaderData();
  if (!digest) {
    return (
      <div className={styles.page}>
        <p className={styles.empty}>まだ記事がありません</p>
      </div>
    );
  }
  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>{digest.entryDate}</h1>
      {groupByCategory(digest.items).map(([name, articles]) => (
        <section key={name} className={styles.section}>
          <h2 className={styles.label}>{name}</h2>
          <ul className={styles.list}>
            {articles.map((a) => (
              <li key={a.id}>
                <div className={styles.row}>
                  <Favicon url={a.url} />
                  <a
                    className={styles.title}
                    href={a.url}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {a.title}
                  </a>
                </div>
                {a.children.length > 0 && (
                  <ul className={styles.children}>
                    {a.children.map((c) => (
                      <li key={c.id} className={styles.row}>
                        <Favicon url={c.url} />
                        <a
                          className={styles.childTitle}
                          href={c.url}
                          rel="noopener noreferrer"
                          target="_blank"
                        >
                          {c.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
};
