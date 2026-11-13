import { getRouteApi } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button } from "react-aria-components";
import { flushSync } from "react-dom";
import { listPublishedDigests, loadAnyLinkPreview, reportArticleOpen } from "#/shared/api";
import { AiToggle } from "#/shared/ui/ai-toggle";
import { DigestPost } from "#/shared/ui/digest-post";
import { PAGE_SIZE, prependPage } from "../model/timeline";
import styles from "./timeline-page.module.css";

const route = getRouteApi("/_shell/timeline");

// ponytail: 全件を DOM に積む。数百件で重くなったら仮想化する
export const TimelinePage = () => {
  const fetchPage = useServerFn(listPublishedDigests);
  const first = route.useLoaderData();
  const [timeline, setTimeline] = useState(() => prependPage([], first.digests));
  const { digests, done } = timeline;
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [aiShown, setAiShown] = useState(false);
  const edgeRef = useRef<HTMLOutputElement>(null);

  useLayoutEffect(() => {
    window.scrollTo(0, document.documentElement.scrollHeight);
  }, []);

  const loadOlder = useCallback(async () => {
    setStatus("loading");
    try {
      const page = await fetchPage({ data: { before: digests[0]?.entryDate, limit: PAGE_SIZE } });
      const gap = document.documentElement.scrollHeight - window.scrollY;
      flushSync(() => {
        setTimeline(prependPage(digests, page.digests));
      });
      // Safari は overflow-anchor に未対応で、上に足すと読んでいた投稿が下へずれる
      window.scrollTo(0, document.documentElement.scrollHeight - gap);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }, [digests, fetchPage]);

  // 読み込むたびに作り直す。作り直した直後の通知で、中身が画面より短ければ続けて読む
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        void loadOlder();
      }
    });
    if (status === "idle" && !done && edgeRef.current !== null) {
      observer.observe(edgeRef.current);
    }
    return () => {
      observer.disconnect();
    };
  }, [status, done, loadOlder]);

  if (digests.length === 0) {
    return (
      <div className={styles.page}>
        <p className={styles.empty}>まだ記事がないです</p>
      </div>
    );
  }
  return (
    <div className={styles.page}>
      <output
        ref={edgeRef}
        className={styles.edge}
        data-error={status === "error" ? "" : undefined}
      >
        {status === "loading" && "読み込み中"}
        {status === "error" && "読み込めませんでした"}
        <Button
          className={styles.retry}
          onPress={() => {
            void loadOlder();
          }}
        >
          再試行
        </Button>
      </output>
      {digests.map((d) => (
        <section key={d.id} aria-labelledby={`digest-${d.id}`}>
          <DigestPost
            action={<AiToggle isSelected={aiShown} onChange={setAiShown} />}
            ai={{ shown: aiShown }}
            digest={d}
            headingId={`digest-${d.id}`}
            loadPreview={loadAnyLinkPreview}
            stickyDate
            onOpen={reportArticleOpen(d.entryDate)}
          />
        </section>
      ))}
    </div>
  );
};
