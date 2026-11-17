import { formatFirstPublished } from "#/shared/lib/entry-date";
import styles from "./link-meta.module.css";

interface LinkMetaProps {
  host: string;
  untitled: boolean;
  suggested: boolean;
  registered: boolean;
  firstPublishedOn?: string;
  reposted: boolean;
  needsChild: boolean;
}

export const LinkMeta = ({
  host,
  untitled,
  suggested,
  registered,
  firstPublishedOn,
  reposted,
  needsChild,
}: LinkMetaProps) => (
  <span className={styles.meta}>
    <span className={styles.host}>{host}</span>
    {firstPublishedOn !== undefined && (
      <span className={styles.firstPublished}>{formatFirstPublished(firstPublishedOn)}</span>
    )}
    {untitled && <span className={styles.warn}>タイトルを入れてください</span>}
    {suggested && <span className={styles.suggested}>AI が振り分けました</span>}
    {reposted && <span className={styles.suggested}>再掲載として登録しました</span>}
    {registered && <span className={styles.error}>既に登録済みです</span>}
    {needsChild && <span className={styles.error}>再掲載には新しい記事を子に付けてください</span>}
  </span>
);
