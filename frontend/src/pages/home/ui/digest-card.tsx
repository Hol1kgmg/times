import type { Digest as DigestData } from "#/shared/api/schemas";
import { CollapsiblePanel } from "./collapsible-panel";
import { Digest } from "./digest";
import styles from "./digest-card.module.css";

// entryDate は日付だけの ISO で UTC の 0 時として読まれるため、UTC で書式化しないと前日になりうる
const dateFormat = new Intl.DateTimeFormat("ja-JP", {
  month: "long",
  day: "numeric",
  weekday: "short",
  timeZone: "UTC",
});

// bot の 1 投稿という Slack の構造はトップでだけ借りる。チャンネル名は出さない (adr/frontend/0003)
export const DigestCard = ({ digest }: { digest: DigestData | null }) => (
  <CollapsiblePanel>
    <section aria-label="最新の Digest">
      {digest ? (
        <>
          <div className={styles.divider}>
            <time className={styles.date} dateTime={digest.entryDate}>
              {dateFormat.format(new Date(digest.entryDate))}
            </time>
            <span className={styles.count}>
              {digest.items.reduce((n, a) => n + 1 + a.children.length, 0)} 件
            </span>
          </div>
          <article className={styles.post}>
            <img alt="" height={36} src="/favicon.svg" width={36} />
            <span className={styles.author}>z_times.dev</span>
            <div className={styles.body}>
              <Digest items={digest.items} />
            </div>
          </article>
        </>
      ) : (
        <p className={styles.empty}>まだ記事がありません</p>
      )}
    </section>
  </CollapsiblePanel>
);
