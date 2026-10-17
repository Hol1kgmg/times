import { getRouteApi } from "@tanstack/react-router";
import { groupByCategory } from "../model/group-by-category";
import styles from "./home-page.module.css";

// getRouteApi でルート定義 (app 層) を import せずに loader の型を得る
const route = getRouteApi("/");

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
              <li key={a.id} className={styles.card}>
                <a
                  className={styles.cardLink}
                  href={a.url}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {a.title}
                </a>
                {a.children.length > 0 && (
                  <ul className={styles.children}>
                    {a.children.map((c) => (
                      <li key={c.id}>
                        <a
                          className={styles.childLink}
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
