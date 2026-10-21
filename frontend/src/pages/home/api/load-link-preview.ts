import type { LinkPreview } from "../model/parse-link-preview";
import { getLinkPreview } from "./get-link-preview";

// use() は reject を throw するので、失敗は「プレビューなし」に畳む
const fetchPreview = async (url: string): Promise<LinkPreview | null> => {
  try {
    return await getLinkPreview({ data: url });
  } catch {
    return null;
  }
};

const previews = new Map<string, Promise<LinkPreview | null>>();
// oxlint-disable-next-line typescript/promise-function-async -- async にすると毎 render 新しい Promise になり use() が再サスペンドし続ける
export const loadLinkPreview = (url: string): Promise<LinkPreview | null> => {
  const cached = previews.get(url);
  if (cached !== undefined) {
    return cached;
  }
  const p = fetchPreview(url);
  previews.set(url, p);
  return p;
};
