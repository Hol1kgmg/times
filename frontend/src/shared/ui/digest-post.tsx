import type { ReactNode } from "react";
import { Link } from "react-aria-components";
import type { ArticleId, Digest, DigestContent, NewArticle, NewChildArticle } from "#/shared/api";
import { countArticles, groupByCategory } from "#/shared/lib/group-by-category";
import type { LinkPreview } from "#/shared/lib/parse-link-preview";
import { categoryIcons } from "#/shared/ui/category-icons";
import { Favicon } from "#/shared/ui/favicon";
import { Flame } from "#/shared/ui/icons/flame";
import { HotBubble } from "#/shared/ui/icons/hot-bubble";
import { useLinkPreview } from "#/shared/ui/use-link-preview";
import styles from "./digest-post.module.css";

// 取得先は呼び出し側が決める。公開ページは Digest 内の URL に限り、管理画面は任意の URL を取る
type LoadPreview = (url: string) => Promise<LinkPreview | null>;
type Open = (url: string) => void;

// entryDate は日付だけの ISO で UTC の 0 時として読まれるため、UTC で書式化しないと前日になりうる
export const dateFormat = new Intl.DateTimeFormat("ja-JP", {
  month: "long",
  day: "numeric",
  weekday: "short",
  timeZone: "UTC",
});

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const ArticleLink = ({
  article,
  hot = false,
  loadPreview,
  open,
}: {
  article: NewChildArticle;
  hot?: boolean;
  loadPreview: LoadPreview;
  open?: Open;
}) => {
  const { show, dismissed, card } = useLinkPreview({
    url: article.url,
    title: article.title,
    className: styles.preview,
    load: loadPreview,
  });
  return (
    <div className={styles.row}>
      <Favicon className={styles.favicon} url={article.url} />
      <span className={styles.text}>
        <Link
          className={styles.title}
          data-dismissed={dismissed ? "" : undefined}
          href={article.url}
          rel="noopener noreferrer"
          target="_blank"
          onAuxClick={(e) => {
            // auxclick は右クリックでも来るので、中クリックだけに絞る
            if (e.button === 1) {
              open?.(article.url);
            }
          }}
          onFocus={show}
          onHoverStart={show}
          onPress={() => open?.(article.url)}
        >
          {({ isHovered, isFocusVisible }) => {
            // タップでもフォーカスは来るので、動かすのはキーボードのフォーカスだけにする
            const pointed = (isHovered || isFocusVisible) && !reducedMotion();
            return (
              <>
                {article.title.trim() === "" ? (
                  <span className={styles.untitled}>タイトルを入れてください</span>
                ) : (
                  article.title
                )}
                {hot && (
                  <span className={styles.hot}>
                    <Flame animate={pointed} role="none" size={16} />
                    {/* 炎にも名前を付けると HOT と二重に読まれるので、読み上げは吹き出しだけにする */}
                    <span className={styles.hotLabel}>
                      <HotBubble animate={pointed} />
                    </span>
                  </span>
                )}
              </>
            );
          }}
        </Link>
        {card}
      </span>
    </div>
  );
};

// <li> は呼び出し側に置く。markuplint はコンポーネントの中を追わず、<ul> 直下を不正と判定する
const Entry = ({
  article,
  loadPreview,
  open,
}: {
  article: NewArticle;
  loadPreview: LoadPreview;
  open?: Open;
}) => (
  <>
    <ArticleLink article={article} hot={article.hot} loadPreview={loadPreview} open={open} />
    {article.children.length > 0 && (
      <ul className={styles.children}>
        {article.children.map((c) => (
          <li key={c.url}>
            <ArticleLink article={c} loadPreview={loadPreview} open={open} />
          </li>
        ))}
      </ul>
    )}
  </>
);

type DigestPostProps = { loadPreview: LoadPreview; action?: ReactNode } & (
  | { digest: Digest; onOpen?: (article: { id: ArticleId; url: string }) => void }
  // 下書きの記事は id を持たず、数える記事として送れない (specs/013 FR-009)
  | { digest: DigestContent; onOpen?: never }
);

// URL は UNIQUE (digest_id, url) で親子をまたいでも重ならない
const opener = (props: DigestPostProps): Open | undefined => {
  if (props.onOpen === undefined) {
    return undefined;
  }
  const { onOpen } = props;
  const ids = new Map(
    props.digest.articles.flatMap((a) => [a, ...a.children]).map((a) => [a.url, a.id]),
  );
  return (url) => {
    const id = ids.get(url);
    if (id !== undefined) {
      onOpen({ id, url });
    }
  };
};

// 下書きも描くので id のない登録の型で受ける。key の URL は UNIQUE (digest_id, url) で重ならない
export const DigestPost = (props: DigestPostProps) => {
  const { digest, loadPreview, action } = props;
  const open = opener(props);
  return (
    <>
      <div className={styles.divider}>
        <span className={styles.center}>
          <time className={styles.date} dateTime={digest.entryDate}>
            {dateFormat.format(new Date(digest.entryDate))}
          </time>
          <span className={styles.count}>{countArticles(digest.articles)} 件</span>
        </span>
        <span className={styles.end}>{action}</span>
      </div>
      {groupByCategory(digest.articles).map(([name, articles]) => {
        const Icon = categoryIcons[name];
        return (
          <article key={name} className={styles.post}>
            <span className={styles.botIcon}>
              <Icon role="none" size={20} />
            </span>
            <h3 className={styles.author}>{name}</h3>
            <ul className={styles.entries}>
              {articles.map((a) => (
                <li key={a.url}>
                  <Entry article={a} loadPreview={loadPreview} open={open} />
                </li>
              ))}
            </ul>
          </article>
        );
      })}
    </>
  );
};
