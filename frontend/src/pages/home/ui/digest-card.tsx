import { useCallback, useRef, useState } from "react";
import type { Digest as DigestData } from "#/shared/api/schemas";
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
export const DigestCard = ({ digest }: { digest: DigestData | null }) => {
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
    <div className={styles.panel} data-collapsed={expanded ? undefined : ""}>
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
                <time className={styles.date} dateTime={digest.entryDate}>
                  {dateFormat.format(new Date(digest.entryDate))}
                </time>
                <span className={styles.count}>
                  {digest.items.reduce((n, a) => n + 1 + a.children.length, 0)} 件
                </span>
              </div>
              <article className={styles.post}>
                <img alt="" className={styles.avatar} height={36} src="/favicon.svg" width={36} />
                <div className={styles.content}>
                  <span className={styles.author}>z_times.dev</span>
                  <Digest items={digest.items} />
                </div>
              </article>
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
          <button className={styles.expand} type="button" onClick={expand}>
            すべて表示
            {/* lucide の chevron-down (ISC) */}
            <svg
              aria-hidden="true"
              fill="none"
              height={14}
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              viewBox="0 0 24 24"
              width={14}
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
};
