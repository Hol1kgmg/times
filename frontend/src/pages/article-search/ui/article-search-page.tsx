import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { useId, useState } from "react";
import type { ReactNode } from "react";
import { Button, Link, Menu, MenuItem, MenuTrigger, Popover } from "react-aria-components";
import type { z } from "zod";
import type { articleSearchHit, articleSearchResult } from "#/shared/api";
import { ARTICLE_SEARCH_LIMIT, loadAnyLinkPreview } from "#/shared/api";
import { formatEntryDate } from "#/shared/lib/entry-date";
import { categoryIcons } from "#/shared/ui/category-icons";
import { Favicon } from "#/shared/ui/favicon";
import { Ellipsis } from "#/shared/ui/icons/ellipsis";
import { Flame } from "#/shared/ui/icons/flame";
import { Repeat } from "#/shared/ui/icons/repeat";
import { ModalDialog } from "#/shared/ui/modal";
import { RouterLink } from "#/shared/ui/router-link";
import { useLinkPreview } from "#/shared/ui/use-link-preview";
import styles from "./article-search-page.module.css";

const route = getRouteApi("/_shell/_admin/admin/articles/search");

type Hit = z.infer<typeof articleSearchHit>;

const Count = ({
  label,
  count,
  children,
}: {
  label: string;
  count: number;
  children: ReactNode;
}) => (
  // 0 回を空けると列に穴が空いて見えるので、薄くして出す
  <span className={count === 0 ? `${styles.badge} ${styles.zero}` : styles.badge}>
    {children}
    <span aria-hidden>{count}</span>
    <span className={styles.srOnly}>{` ${label} ${count} 回`}</span>
  </span>
);

const HitRow = ({ hit, onOpenHistory }: { hit: Hit; onOpenHistory: () => void }) => {
  const CategoryIcon = categoryIcons[hit.category];
  const navigate = useNavigate();
  const title = hit.title === "" ? new URL(hit.url).hostname : hit.title;
  const { show, dismissed, card } = useLinkPreview({
    url: hit.url,
    title,
    className: styles.preview,
    load: loadAnyLinkPreview,
  });
  return (
    <div className={styles.row}>
      <span className={styles.main}>
        {hit.parent !== undefined && (
          <span className={styles.parent}>
            <Favicon className={styles.parentFavicon} url={hit.parent.url} />
            <span className={styles.parentTitle} title={hit.parent.title}>
              {hit.parent.title}
            </span>
          </span>
        )}
        <span
          className={
            hit.parent === undefined ? styles.titleLine : `${styles.titleLine} ${styles.child}`
          }
        >
          <Favicon url={hit.url} />
          <Link
            className={styles.title}
            data-dismissed={dismissed ? "" : undefined}
            href={hit.url}
            rel="noopener noreferrer"
            target="_blank"
            onFocus={show}
            onHoverStart={show}
          >
            {/* カードの上でネイティブのツールチップまで重ならないよう、title は文字にだけ付ける */}
            <span title={title}>{title}</span>
          </Link>
          {card}
        </span>
      </span>
      <span className={styles.badge} title={hit.category}>
        <CategoryIcon role="none" size={16} />
        <span className={styles.srOnly}>{` ${hit.category}`}</span>
      </span>
      <Count count={hit.hotOn.length} label="HOT">
        <Flame role="none" size={16} />
      </Count>
      <Count count={hit.repostedOn.length} label="再掲載">
        <Repeat role="none" size={16} />
      </Count>
      <span className={styles.date}>{formatEntryDate(hit.firstPublishedOn)}</span>
      <MenuTrigger>
        <Button aria-label={`${title} の操作`} className={styles.menu}>
          <Ellipsis role="none" size={16} />
        </Button>
        <Popover className={styles.menuPopover} placement="bottom end">
          <Menu
            className={styles.menuList}
            onAction={(key) => {
              if (key === "history") {
                onOpenHistory();
              } else {
                void navigate({
                  to: "/admin/digests/$date/edit",
                  params: { date: hit.firstPublishedOn },
                });
              }
            }}
          >
            <MenuItem className={styles.menuItem} id="edit">
              初回掲載の編集画面を開く
            </MenuItem>
            <MenuItem className={styles.menuItem} id="history">
              掲載履歴を見る
            </MenuItem>
          </Menu>
        </Popover>
      </MenuTrigger>
    </div>
  );
};

const HitDialog = ({ hit, onClose }: { hit: Hit; onClose: () => void }) => {
  const headingId = useId();
  const dates = [hit.firstPublishedOn, ...hit.repostedOn].toReversed();
  return (
    <ModalDialog className={styles.modal} labelledBy={headingId} onClose={onClose}>
      {({ close }) => (
        <div className={styles.modalBody}>
          <h2 className={styles.modalTitle} id={headingId}>
            掲載履歴
          </h2>
          {/* ModalDialog は DOM 順で最初の要素にフォーカスするので、編集へのリンクを先に置く */}
          <ul className={styles.dates}>
            {dates.map((d) => (
              <li key={d}>
                <RouterLink
                  className={styles.dateLink}
                  params={{ date: d }}
                  to="/admin/digests/$date/edit"
                >
                  <span>{formatEntryDate(d)}</span>
                  {hit.hotOn.includes(d) && (
                    <span className={styles.badge}>
                      <Flame role="none" size={16} />
                      <span className={styles.srOnly}> HOT</span>
                    </span>
                  )}
                  <span className={styles.edit}>編集</span>
                </RouterLink>
              </li>
            ))}
          </ul>
          <Button className={styles.button} onPress={close}>
            閉じる
          </Button>
        </div>
      )}
    </ModalDialog>
  );
};

interface ViewProps {
  q: string | undefined;
  result: z.infer<typeof articleSearchResult> | undefined;
  onSearch: (q: string) => Promise<void>;
}

// Storybook は Router を載せないので、route の hook を使わない形で描く
export const ArticleSearchView = ({ q, result, onSearch }: ViewProps) => {
  const [opened, setOpened] = useState<Hit>();
  const [text, setText] = useState(q ?? "");
  // 戻る・進むで q が変わったときだけ欄を合わせる。key で作り直すと検索するたびに欄のフォーカスが外れる
  const [shownQ, setShownQ] = useState(q);
  if (q !== shownQ) {
    setShownQ(q);
    setText(q ?? "");
  }
  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>記事を検索</h1>
      <form
        className={styles.form}
        method="get"
        onSubmit={(e) => {
          e.preventDefault();
          const value = new FormData(e.currentTarget).get("q");
          if (typeof value === "string") {
            void onSearch(value);
          }
        }}
      >
        <input
          aria-label="タイトルか URL"
          className={styles.input}
          maxLength={100}
          name="q"
          pattern=".*\S.*"
          required
          title="空白だけでは探せないです"
          type="search"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
          }}
        />
        <Button className={styles.submit} type="submit">
          検索
        </Button>
      </form>
      {result !== undefined &&
        (result.articles.length === 0 ? (
          <p className={styles.empty}>見つからなかったです</p>
        ) : (
          <ul className={styles.list}>
            {result.articles.map((hit) => (
              <li key={hit.id} className={styles.item}>
                <HitRow
                  hit={hit}
                  onOpenHistory={() => {
                    setOpened(hit);
                  }}
                />
              </li>
            ))}
          </ul>
        ))}
      {result !== undefined && result.articles.length >= ARTICLE_SEARCH_LIMIT && (
        <p className={styles.empty}>
          新しい {ARTICLE_SEARCH_LIMIT} 件だけ出してます。言葉を足すと古い記事まで届きます
        </p>
      )}
      {opened !== undefined && (
        <HitDialog
          hit={opened}
          onClose={() => {
            setOpened(undefined);
          }}
        />
      )}
    </div>
  );
};

export const ArticleSearchPage = () => {
  const navigate = route.useNavigate();
  return (
    <ArticleSearchView
      q={route.useSearch().q}
      result={route.useLoaderData()}
      onSearch={async (q) => {
        await navigate({ search: { q } });
      }}
    />
  );
};
