import { formatFirstPublished } from "#/shared/lib/entry-date";
import styles from "./link-meta.module.css";

interface LinkMetaProps {
  host: string;
  untitled: boolean;
  suggested: boolean;
  registered: boolean;
  repost: boolean;
  firstPublishedOn?: string;
  converted: boolean;
  unavailable: boolean;
  hidden?: boolean;
  unpublished?: boolean;
  categoryNote?: string | null | undefined;
}

export const LinkMeta = ({
  host,
  untitled,
  suggested,
  registered,
  repost,
  firstPublishedOn,
  converted,
  unavailable,
  hidden = false,
  unpublished = false,
  categoryNote,
}: LinkMetaProps) => (
  <span className={styles.meta}>
    <span className={styles.host}>{host}</span>
    {repost && (
      <span className={styles.firstPublished}>
        {firstPublishedOn === undefined ? "再掲載" : formatFirstPublished(firstPublishedOn)}
      </span>
    )}
    {untitled && <span className={styles.warn}>タイトルを入れてください</span>}
    {hidden && <span className={styles.warn}>子がほかの日にいるので、外す代わりに隠してます</span>}
    {unpublished && <span className={styles.warn}>元の Digest が公開されてないので出ません</span>}
    {typeof categoryNote === "string" && <span className={styles.warn}>{categoryNote}</span>}
    {suggested && <span className={styles.suggested}>AI が振り分けました</span>}
    {converted && <span className={styles.suggested}>再掲載にしました</span>}
    {registered && <span className={styles.error}>既に登録済みです</span>}
    {unavailable && <span className={styles.error}>この記事は再掲載できません</span>}
  </span>
);
