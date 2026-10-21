import { Suspense, useState } from "react";
import type { Article, ChildArticle } from "#/shared/api/schemas";
import { groupByCategory } from "../model/group-by-category";
import styles from "./digest.module.css";
import { Favicon, PreviewCard } from "./preview-card";

const ArticleLink = ({ article }: { article: ChildArticle }) => {
  const [hovered, setHovered] = useState(false);
  const show = () => {
    setHovered(true);
  };
  return (
    <div className={styles.row}>
      <Favicon className={styles.favicon} url={article.url} />
      <span className={styles.text}>
        <a
          className={styles.title}
          href={article.url}
          rel="noopener noreferrer"
          target="_blank"
          onFocus={show}
          onMouseEnter={show}
        >
          {article.title}
        </a>
        {hovered && (
          <Suspense fallback={null}>
            <PreviewCard className={styles.preview} title={article.title} url={article.url} />
          </Suspense>
        )}
      </span>
    </div>
  );
};

// <li> は呼び出し側に置く。markuplint はコンポーネントの中を追わず、<ul> 直下を不正と判定する
const Entry = ({ article }: { article: Article }) => (
  <>
    <ArticleLink article={article} />
    {article.children.length > 0 && (
      <ul className={styles.children}>
        {article.children.map((c) => (
          <li key={c.id}>
            <ArticleLink article={c} />
          </li>
        ))}
      </ul>
    )}
  </>
);

export const Digest = ({ items }: { items: readonly Article[] }) => (
  <ul className={styles.sections}>
    {groupByCategory(items).map(([name, articles]) => (
      <li key={name} className={styles.section}>
        <h3 className={styles.label}>{name}</h3>
        <ul className={styles.list}>
          {articles.map((a) => (
            <li key={a.id}>
              <Entry article={a} />
            </li>
          ))}
        </ul>
      </li>
    ))}
  </ul>
);
