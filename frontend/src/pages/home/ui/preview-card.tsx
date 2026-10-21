import { use } from "react";
import { loadLinkPreview } from "../api/load-link-preview";
import fallbackFavicon from "./fallback-favicon.svg";
import styles from "./preview-card.module.css";

// sz=32 は 16px 表示を高密度画面でぼかさないため
const faviconUrl = (url: string) =>
  `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=32`;

export const Favicon = ({ url, className }: { url: string; className?: string }) => (
  <img
    alt=""
    className={className === undefined ? styles.favicon : `${styles.favicon} ${className}`}
    height={16}
    loading="lazy"
    src={faviconUrl(url)}
    width={16}
    onError={(e) => {
      e.currentTarget.src = fallbackFavicon;
    }}
    // Google は favicon 無しのドメインに 200 で 16px の既定画像を返すため、実寸で判定する
    onLoad={(e) => {
      if (e.currentTarget.naturalWidth < 32) {
        e.currentTarget.src = fallbackFavicon;
      }
    }}
  />
);

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
  return (
    <div className={`${styles.card} ${className}`}>
      <div className={styles.text}>
        <p className={styles.title}>{meta.title ?? title}</p>
        {meta.description !== null && <p className={styles.body}>{meta.description}</p>}
        <span className={styles.source}>
          <Favicon url={url} />
          {new URL(url).hostname}
        </span>
      </div>
      {meta.image === null ? (
        <div className={styles.noImage}>no image</div>
      ) : (
        <img alt="" className={styles.image} height={136} src={meta.image} width={320} />
      )}
    </div>
  );
};
