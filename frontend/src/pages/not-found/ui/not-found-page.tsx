import { useCallback, useEffect, useRef, useState } from "react";
import { getLatestDigest } from "#/shared/api";
import { RouterLink } from "#/shared/ui/router-link";
import { CubePile } from "./cube-pile";
import styles from "./not-found-page.module.css";
import { SandPile } from "./sand-pile";

export const NotFoundPage = () => {
  // 取れる前に山を作ると、取れたときに WebGL の文脈から作り直すことになるため
  const [urls, setUrls] = useState<readonly string[] | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const content = useRef<HTMLDivElement>(null);
  const fail = useCallback(() => {
    setFailed(true);
  }, []);

  // root の notFound は loader を通らないので、表示してから取る
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const digest = await getLatestDigest();
        const all = (digest?.articles ?? []).flatMap((a) => [
          ...(a.concealed === true ? [] : [a.url]),
          ...a.children.map((c) => c.url),
        ]);
        if (active) {
          setUrls([...new Map(all.map((u) => [new URL(u).hostname, u])).values()]);
        }
      } catch {
        // 粒は飾りで、取れなくても 404 の案内は成り立つ
        if (active) {
          setUrls([]);
        }
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className={styles.page}>
      {urls !== undefined && failed && <SandPile urls={urls} />}
      {urls !== undefined && !failed && <CubePile ceiling={content} urls={urls} onFail={fail} />}
      <div ref={content} className={styles.content}>
        <p className={styles.code}>404</p>
        <h1 className={styles.heading}>このページは見つからなかったみたいです。</h1>
        <p className={styles.body}>URL が変わったか、なくなったみたいです。</p>
        <RouterLink className={styles.link} to="/">
          最新の Digest を見に行く
        </RouterLink>
      </div>
    </div>
  );
};
