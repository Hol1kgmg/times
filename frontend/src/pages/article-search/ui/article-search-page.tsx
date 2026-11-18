import { getRouteApi } from "@tanstack/react-router";
import { Button, Dialog, DialogTrigger, Popover } from "react-aria-components";
import type { z } from "zod";
import type { articleSearchHit } from "#/shared/api";
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
  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>記事を検索</h1>
      <form className={styles.form} method="get">
        <input
          aria-label="タイトルか URL"
          className={styles.input}
          defaultValue={q}
          maxLength={100}
          name="q"
          required
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
    </div>
  );
};
