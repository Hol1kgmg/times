import fallbackFavicon from "./fallback-favicon.svg";
import styles from "./favicon.module.css";

// sz=32 は 16px 表示を高密度画面でぼかさないため
const faviconUrl = (url: string) =>
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
    // lazy にすると、折りたたみで読まれずに残った画像を Chrome が待ち続け、load イベントが来ないことがある
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
