import type { ReactNode } from "react";
import { mergeProps, useFocusRing, useHover } from "react-aria";
import type { DigestContent, NewArticle, NewChildArticle } from "#/shared/api";
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
}: {
  article: NewChildArticle;
  hot?: boolean;
  loadPreview: LoadPreview;
}) => {
  const { show, dismissed, card } = useLinkPreview({
    url: article.url,
    title: article.title,
    className: styles.preview,
    load: loadPreview,
  });
  const { hoverProps, isHovered } = useHover({ onHoverStart: show });
  // タップでもフォーカスは来るので、動かすのはキーボードのフォーカスだけにする
  const { focusProps, isFocusVisible } = useFocusRing();
  const pointed = (isHovered || isFocusVisible) && !reducedMotion();
  return (
    <div className={styles.row}>
      <Favicon className={styles.favicon} url={article.url} />
      <span className={styles.text}>
        <a
          className={styles.title}
          data-dismissed={dismissed ? "" : undefined}
          data-hovered={isHovered ? "" : undefined}
          href={article.url}
          rel="noopener noreferrer"
          target="_blank"
          {...mergeProps(hoverProps, focusProps, { onFocus: show })}
        >
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
        </a>
        {card}
      </span>
    </div>
  );
};

// <li> は呼び出し側に置く。markuplint はコンポーネントの中を追わず、<ul> 直下を不正と判定する
const Entry = ({ article, loadPreview }: { article: NewArticle; loadPreview: LoadPreview }) => (
  <>
    <ArticleLink article={article} hot={article.hot} loadPreview={loadPreview} />
    {article.children.length > 0 && (
      <ul className={styles.children}>
        {article.children.map((c) => (
          <li key={c.url}>
            <ArticleLink article={c} loadPreview={loadPreview} />
          </li>
        ))}
      </ul>
    )}
  </>
);

// 下書きも描くので id のない登録の型で受ける。key の URL は UNIQUE (digest_id, url) で重ならない
export const DigestPost = ({
  digest,
  loadPreview,
  action,
}: {
  digest: DigestContent;
  loadPreview: LoadPreview;
  action?: ReactNode;
}) => (
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
                <Entry article={a} loadPreview={loadPreview} />
              </li>
            ))}
          </ul>
        </article>
      );
    })}
  </>
);
