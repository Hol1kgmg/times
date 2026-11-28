import { useCallback, useRef, useState } from "react";
import type { ReactNode } from "react";
import { flushSync } from "react-dom";
import { Button } from "react-aria-components";
import { Chevron } from "#/shared/ui/chevron";
import styles from "./collapsible-panel.module.css";

// 高さの上限は親が [data-collapsed] を見て決める (home-page.module.css の .fit)
export const CollapsiblePanel = ({ children }: { children: ReactNode }) => {
  const [expanded, setExpanded] = useState(false);
  const fadeRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  // null は未計測 (SSR とハイドレーション直後)
  const [overflowing, setOverflowing] = useState<boolean | null>(null);
  // 枠の高さは画面で、中身の高さはフォントの到着で変わるので両方を見る
  const observeOverflow = useCallback((el: HTMLDivElement) => {
    bodyRef.current = el;
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
  const underFade = (el: Element) =>
    el.getBoundingClientRect().bottom > (fadeRef.current?.getBoundingClientRect().top ?? Infinity);
  return (
    <div className={styles.panel} data-collapsed={expanded ? undefined : ""}>
      <div
        ref={observeOverflow}
        className={styles.body}
        // Tab で隠れた・フェードにかかった記事に入ったら、読めないリンクを操作させないよう展開する
        onFocus={(e) => {
          if (underFade(e.target)) {
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
          <Button
            className={styles.expand}
            onPress={(e) => {
              // 押したボタンが消えてフォーカスを失うので、隠れていた最初の要素へ移す。位置は展開で変わるので先に測る
              const hidden = [
                ...(bodyRef.current?.querySelectorAll<HTMLElement>("a[href], button") ?? []),
              ].find(underFade);
              flushSync(expand);
              // マウスとタッチで記事にフォーカスすると、押していない記事のカードが開く
              if (e.pointerType === "keyboard" || e.pointerType === "virtual") {
                hidden?.focus();
              }
            }}
          >
            すべて表示
            <Chevron size={14} />
          </Button>
        </div>
      )}
    </div>
  );
};
