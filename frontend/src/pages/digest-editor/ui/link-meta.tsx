import styles from "./link-meta.module.css";

interface LinkMetaProps {
  host: string;
  loading: boolean;
  untitled: boolean;
  suggested: boolean;
  registered: boolean;
}

export const LinkMeta = ({ host, loading, untitled, suggested, registered }: LinkMetaProps) => (
  <span className={styles.meta}>
    <span className={styles.host}>{host}</span>
    {loading && <span className={styles.loading}>タイトルを取得してます</span>}
    {untitled && <span className={styles.warn}>タイトルを入れてください</span>}
    {suggested && <span className={styles.suggested}>AI が振り分けました</span>}
    {registered && <span className={styles.error}>既に登録済みです</span>}
  </span>
);
