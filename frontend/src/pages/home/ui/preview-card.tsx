import { use, useState } from "react";
import { Favicon } from "#/shared/ui/favicon";
import { loadLinkPreview } from "../api/load-link-preview";
import styles from "./preview-card.module.css";

// 表示・位置は呼び出し側の className が決める。ホバー中のリンクの隣にだけ出すため
export const PreviewCard = ({
  url,
  title,
  className,
}: {
  url: string;
  title: string;
  className: string;
}) => {
  const meta = use(loadLinkPreview(url)) ?? { title: null, description: null, image: null };
  const [imageFailed, setImageFailed] = useState(false);
  return (
    <div className={`${styles.card} ${className}`}>
      <div className={styles.media}>
        {meta.image === null || imageFailed ? (
          <div className={styles.noImage}>
            <img alt="" height={48} src="/favicon.svg" width={48} />
          </div>
        ) : (
          <img
            alt=""
            className={styles.image}
            height={168}
            src={meta.image}
            width={320}
            onError={() => {
              setImageFailed(true);
            }}
          />
        )}
        <p className={styles.title}>{meta.title ?? title}</p>
      </div>
      <div className={styles.text}>
        {meta.description !== null && <p className={styles.body}>{meta.description}</p>}
        <span className={styles.source}>
          <Favicon alt="" url={url} />
          {new URL(url).hostname}
        </span>
      </div>
    </div>
  );
};
