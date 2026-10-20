import { getRouteApi } from "@tanstack/react-router";
import { Suspense, use, useCallback, useRef, useState } from "react";
import { category } from "#/shared/api/schemas";
import type { Article, Category, ChildArticle } from "#/shared/api/schemas";
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
    <img alt="" className={styles.avatar} height={36} src="/favicon.svg" width={36} />
    <div className={styles.content}>
      <span className={styles.author}>z_times.dev</span>
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
    </div>
  </article>
);

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

// トップはシェルの外の入り口ページ。Slack の構造は投稿 1 件分だけ借りる (adr/frontend/0003)
export const HomePage = () => {
  const digest = route.useLoaderData();
  const [expanded, setExpanded] = useState(false);
  const fadeRef = useRef<HTMLDivElement>(null);
  // null は未計測 (SSR とハイドレーション直後)
  const [overflowing, setOverflowing] = useState<boolean | null>(null);
  // 枠の高さは画面で、中身の高さはフォントの到着で変わるので両方を見る
  const observeOverflow = useCallback((el: HTMLDivElement) => {
    const ro = new ResizeObserver(() => {
      setOverflowing(el.scrollHeight > el.clientHeight);
    });
    ro.observe(el);
    for (const child of el.children) {
      ro.observe(child);
    }
    return () => {
      ro.disconnect();
    };
  }, []);
  const expand = () => {
    setExpanded(true);
  };
  return (
    <div className={styles.page}>
      <div className={styles.fit} data-collapsed={expanded ? undefined : ""}>
        <h1 className={styles.site}>
          <Logo hero />
        </h1>
        <p className={styles.intro}>
          管理者が見かけた技術や趣味などの記事やサイトを日々投稿しています
        </p>
        <div className={styles.panel}>
          <div
            ref={observeOverflow}
            className={styles.body}
            // Tab で隠れた・フェードにかかった記事に入ったら、読めないリンクを操作させないよう展開する
            onFocus={(e) => {
              const fadeTop = fadeRef.current?.getBoundingClientRect().top ?? Infinity;
              if (e.target.getBoundingClientRect().bottom > fadeTop) {
                expand();
              }
            }}
          >
            <section aria-label="最新の Digest">
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
          {!expanded && (
            <div
              ref={fadeRef}
              className={styles.fade}
              data-hidden={overflowing === false ? "" : undefined}
            />
          )}
          {!expanded && overflowing === true && (
            <div className={styles.more}>
              <button
                aria-label="すべて表示"
                className={styles.expand}
                type="button"
                onClick={expand}
              >
                {/* lucide の chevrons-up-down (ISC)。上下に開く動きは CSS で付ける */}
                <svg
                  fill="none"
                  height={20}
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                  width={20}
                >
                  <path d="m7 15 5 5 5-5" />
                  <path d="m7 9 5-5 5 5" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>
      <About />
    </div>
  );
};
