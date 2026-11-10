import fallbackFavicon from "./fallback-favicon.svg";
import styles from "./favicon.module.css";

export { default as fallbackFavicon } from "./fallback-favicon.svg";

// sz=32 は 16px 表示を高密度画面でぼかさないため
export const faviconUrl = (url: string) =>
  `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=32`;

export const Favicon = ({
  url,
  className,
  alt,
}: {
  url: string;
  className?: string;
  alt?: string;
}) => (
  <img
    alt={alt ?? new URL(url).hostname}
    className={className === undefined ? styles.favicon : `${styles.favicon} ${className}`}
    height={16}
    loading="lazy"
    src={faviconUrl(url)}
    width={16}
    onError={(e) => {
      e.currentTarget.src = fallbackFavicon;
    }}
    // Google は favicon 無しに 16px の既定画像を返す。代替 SVG も 16px なので除かないと差し替えが無限に続く
    onLoad={(e) => {
      if (
        e.currentTarget.naturalWidth < 32 &&
        e.currentTarget.getAttribute("src") !== fallbackFavicon
      ) {
        e.currentTarget.src = fallbackFavicon;
      }
    }}
  />
);
