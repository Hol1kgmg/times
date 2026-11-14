import { fallbackFavicon } from "#/shared/ui/favicon";

export const loadImage = async (src: string) => {
  const img = new Image();
  img.src = src;
  try {
    await img.decode();
    return img;
  } catch {
    // 読めない favicon は代替に替えるか描かないだけで、山は成り立つ
    return null;
  }
};

export const loadFallback = async () => await loadImage(fallbackFavicon);

export const proxiedFavicon = (url: string) => `/favicons/${new URL(url).hostname}`;

// Google は favicon 無しに 16px の既定画像を返すので、Favicon と同じく代替 SVG に替える
export const loadFavicon = async (src: string, fallback: HTMLImageElement | null) => {
  const img = await loadImage(src);
  return img !== null && img.naturalWidth >= 32 ? img : fallback;
};
