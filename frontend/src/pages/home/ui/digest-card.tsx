import { useCallback, useRef, useState } from "react";
import type { Digest as DigestData } from "#/shared/api/schemas";
import { Digest } from "./digest";
import styles from "./digest-card.module.css";

// 日付ピル + bot の 1 投稿という Slack の構造はトップでだけ借りる (adr/frontend/0003)
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
                <span className={styles.date}>{digest.entryDate}</span>
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
          <button aria-label="すべて表示" className={styles.expand} type="button" onClick={expand}>
            {/* lucide の chevrons-up-down (ISC)。上下に開く動きは CSS で付ける */}
            <svg
              fill="none"
              height={20}
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              viewBox="0 0 24 24"
              width={20}
            >
              <path d="m7 15 5 5 5-5" />
              <path d="m7 9 5-5 5 5" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
};
