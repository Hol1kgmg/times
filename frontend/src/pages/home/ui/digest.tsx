import { Suspense, use, useState } from "react";
import type { Article, ChildArticle } from "#/shared/api/schemas";
import { getLinkPreview } from "../api/get-link-preview";
import { groupByCategory } from "../model/group-by-category";
import type { LinkPreview } from "../model/parse-link-preview";
import fallbackFavicon from "./fallback-favicon.svg";
import styles from "./digest.module.css";

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

// use() は reject を throw するので、失敗は「プレビューなし」に畳む
const fetchPreview = async (url: string): Promise<LinkPreview | null> => {
  try {
    return await getLinkPreview({ data: url });
  } catch {
    return null;
  }
};

const previews = new Map<string, Promise<LinkPreview | null>>();
// oxlint-disable-next-line typescript/promise-function-async -- async にすると毎 render 新しい Promise になり use() が再サスペンドし続ける
const loadPreview = (url: string): Promise<LinkPreview | null> => {
  const cached = previews.get(url);
  if (cached !== undefined) {
    return cached;
  }
  const p = fetchPreview(url);
  previews.set(url, p);
  return p;
};

const Preview = ({ url, title }: { url: string; title: string }) => {
  const meta = use(loadPreview(url)) ?? { title: null, description: null, image: null };
  return (
    <div className={styles.preview}>
      <div className={styles.previewText}>
        <p className={styles.previewTitle}>{meta.title ?? title}</p>
        {meta.description !== null && <p className={styles.previewBody}>{meta.description}</p>}
        <span className={styles.previewSource}>
          <Favicon url={url} />
          {new URL(url).hostname}
        </span>
      </div>
      {meta.image === null ? (
        <div className={styles.previewNoImage}>no image</div>
      ) : (
        <img alt="" className={styles.previewImage} height={136} src={meta.image} width={320} />
      )}
    </div>
  );
};

const ArticleLink = ({ article }: { article: ChildArticle }) => {
  const [hovered, setHovered] = useState(false);
  const show = () => {
    setHovered(true);
  };
  return (
    <div className={styles.row}>
      <Favicon url={article.url} />
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
            <Preview title={article.title} url={article.url} />
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
