import { useEffect, useState } from "react";
import { getLatestDigest } from "#/shared/api";
import { RouterLink } from "#/shared/ui/router-link";
import styles from "./not-found-page.module.css";
import { SandPile } from "./sand-pile";

export const NotFoundPage = () => {
  const [urls, setUrls] = useState<readonly string[]>([]);

  // root の notFound は loader を通らないので、表示してから取る
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const digest = await getLatestDigest();
        if (!active || digest === null) {
          return;
        }
        const all = digest.articles.flatMap((a) => [a.url, ...a.children.map((c) => c.url)]);
        setUrls([...new Map(all.map((u) => [new URL(u).hostname, u])).values()]);
      } catch {
        // 粒は飾りで、取れなくても 404 の案内は成り立つ
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className={styles.page}>
      <SandPile urls={urls} />
      <div className={styles.content}>
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
