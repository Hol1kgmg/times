import { getRouteApi } from "@tanstack/react-router";
import { Suspense, use, useState } from "react";
import type { Article, ChildArticle } from "#/shared/api/schemas";
import { getLinkPreview } from "../api/get-link-preview";
import { groupByCategory } from "../model/group-by-category";
import type { LinkPreview } from "../model/parse-link-preview";
import { Logo } from "#/shared/ui/logo";
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

const Body = ({ article }: { article: ChildArticle }) => {
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
    <Body article={article} />
    {article.children.length > 0 && (
      <ul className={styles.children}>
        {article.children.map((c) => (
          <li key={c.id}>
            <Body article={c} />
          </li>
        ))}
      </ul>
    )}
  </>
);

// 1 日分の Digest = bot の 1 投稿
const Post = ({ items }: { items: readonly Article[] }) => (
  <article className={styles.post}>
    <span aria-hidden className={styles.avatar} />
    <div className={styles.content}>
      <span className={styles.author}>z-times</span>
      {groupByCategory(items).map(([name, articles]) => (
        <section key={name} className={styles.section}>
          <h3 className={styles.label}>{name}</h3>
          <ul className={styles.list}>
            {articles.map((a) => (
              <li key={a.id}>
                <Entry article={a} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  </article>
);

// トップはシェルの外の入り口ページ。最新 Digest をチャンネルの切り抜きとして見せる (adr/frontend/0003)
export const HomePage = () => {
  const digest = route.useLoaderData();
  return (
    <div className={styles.page}>
      <h1 className={styles.site}>
        <Logo hero />
      </h1>
      <p className={styles.intro}>
        管理者が見かけた技術や趣味などの記事やサイトを日々投稿しています
      </p>
      <section aria-labelledby="channel" className={styles.panel}>
        <h2 className={styles.channel} id="channel">
          <span className={styles.hash}>#</span>general
        </h2>
        {digest ? (
          <>
            <div className={styles.divider}>
              <span className={styles.date}>{digest.entryDate}</span>
            </div>
            <Post items={digest.items} />
          </>
        ) : (
          <p className={styles.empty}>まだ記事がありません</p>
        )}
      </section>
    </div>
  );
};
