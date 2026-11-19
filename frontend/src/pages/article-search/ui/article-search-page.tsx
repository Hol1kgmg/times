import { getRouteApi } from "@tanstack/react-router";
import { Button, Dialog, DialogTrigger, Popover } from "react-aria-components";
import type { z } from "zod";
import type { articleSearchHit } from "#/shared/api";
import { ARTICLE_SEARCH_LIMIT } from "#/shared/api";
import { formatEntryDate } from "#/shared/lib/entry-date";
import styles from "./article-search-page.module.css";

const route = getRouteApi("/_shell/admin/articles/search");

const Reposts = ({ hit }: { hit: z.infer<typeof articleSearchHit> }) => (
  <DialogTrigger>
    <Button className={styles.menuButton}>再掲載 {hit.repostedOn.length} 回</Button>
    <Popover className={styles.popover} placement="bottom end">
      <Dialog aria-label={`${hit.title} の再掲載の日付`} className={styles.dialog}>
        <ul className={styles.dates}>
          {hit.repostedOn.map((d) => (
            <li key={d}>{formatEntryDate(d)}</li>
          ))}
        </ul>
      </Dialog>
    </Popover>
  </DialogTrigger>
);

export const ArticleSearchPage = () => {
  const { q } = route.useSearch();
  const result = route.useLoaderData();
  const navigate = route.useNavigate();
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
            void navigate({ search: { q: value } });
          }
        }}
      >
        <input
          key={q}
          aria-label="タイトルか URL"
          className={styles.input}
          defaultValue={q}
          maxLength={100}
          name="q"
          pattern=".*\S.*"
          required
          title="空白だけでは探せないです"
          type="search"
        />
        <button className={styles.submit} type="submit">
          検索
        </button>
      </form>
      {result !== undefined &&
        (result.articles.length === 0 ? (
          <p className={styles.empty}>見つからなかったです</p>
        ) : (
          <ul className={styles.list}>
            {result.articles.map((hit) => (
              <li key={hit.id} className={styles.row}>
                <div className={styles.main}>
                  <a className={styles.title} href={hit.url} rel="noreferrer" target="_blank">
                    {hit.title}
                  </a>
                  <span className={styles.meta}>
                    {hit.category} · {hit.url}
                    {hit.parentUrl !== undefined && ` · 親 ${hit.parentUrl}`}
                  </span>
                </div>
                <span className={styles.date}>{formatEntryDate(hit.firstPublishedOn)}</span>
                {hit.repostedOn.length > 0 && <Reposts hit={hit} />}
              </li>
            ))}
          </ul>
        ))}
      {result !== undefined && result.articles.length >= ARTICLE_SEARCH_LIMIT && (
        <p className={styles.empty}>
          新しい {ARTICLE_SEARCH_LIMIT} 件だけ出してます。言葉を足すと古い記事まで届きます
        </p>
      )}
    </div>
  );
};
