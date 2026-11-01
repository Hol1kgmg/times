import { useCallback, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Chevron } from "#/shared/ui/chevron";
import { HoverButton } from "#/shared/ui/hover-button";
import styles from "./collapsible-panel.module.css";

// 高さの上限は親が [data-collapsed] を見て決める (home-page.module.css の .fit)
export const CollapsiblePanel = ({ children }: { children: ReactNode }) => {
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
        {children}
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
          <HoverButton className={styles.expand} type="button" onClick={expand}>
            すべて表示
            <Chevron size={14} />
          </HoverButton>
        </div>
      )}
    </div>
  );
};
