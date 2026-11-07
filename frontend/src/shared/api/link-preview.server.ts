import { createServerOnlyFn } from "@tanstack/react-start";
import type { LinkPreview } from "#/shared/lib/parse-link-preview";
import {
  linkPreview,
  parseLinkPreview,
  parseOEmbed,
  youTubeId,
  youTubeThumbnail,
} from "#/shared/lib/parse-link-preview";
import { cachedJson } from "./cache.server";

// 外部サイトの HTML を Workers 側で取りに行く。ブラウザからは CORS で読めないため
const MAX_BYTES = 1024 * 1024;
// 失敗 (タイムアウト等) は一時的なことが多いので短くしか覚えない
const ttlOf = (preview: LinkPreview | null) => (preview === null ? 3600 : 86_400);
const latin1 = new TextDecoder("latin1");
const hasOg = (text: string) => /<meta[^>]+["']og:/iu.test(text);

// 相手先に繋がらない・遅いのは取れなかっただけなので null にする。パースのバグまで隠さないよう、ほかは再送出する
const unlessUnreachable = (error: unknown): null => {
  if (
    error instanceof TypeError ||
    (error instanceof DOMException && error.name === "TimeoutError")
  ) {
    return null;
  }
  throw error;
};

const charsetOf = (contentType: string, latin1Head: string) =>
  /charset=["']?(?<cs>[\w-]+)/iu.exec(contentType)?.groups?.cs ??
  /<meta[^>]+charset=["']?(?<cs>[\w-]+)/iu.exec(latin1Head)?.groups?.cs ??
  "utf-8";

const decode = (bytes: Uint8Array, charset: string) => {
  try {
    return new TextDecoder(charset).decode(bytes);
  } catch {
    return new TextDecoder().decode(bytes);
  }
};

// Shift_JIS などのページを UTF-8 として読むと説明文が化けるので、文字コードを決めてから復号する
const readHead = async (res: Response) => {
  if (res.body === null) {
    return "";
  }
  const chunks: Uint8Array[] = [];
  let size = 0;
  let headEnded = false;
  let ogSeen = false;
  for await (const chunk of res.body) {
    chunks.push(chunk);
    size += chunk.length;
    const text = latin1.decode(chunk);
    headEnded ||= text.includes("</head>");
    ogSeen ||= hasOg(text);
    // Next.js のストリーミング SSR は og タグを </head> の後ろの body に流すので、見つかるまで読み進める
    if (size >= MAX_BYTES || (headEnded && ogSeen)) {
      break;
    }
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  const contentType = res.headers.get("content-type") ?? "";
  return decode(bytes, charsetOf(contentType, new TextDecoder("latin1").decode(bytes)));
};

// YouTube は bot の UA に og タグのないページを返すので、画像は動画 ID から作り、文字だけ oEmbed から取る
// oEmbed が断られてもサムネイルは出せるので、文字なしで返す
const loadYouTube = async (url: string, id: string): Promise<LinkPreview> => {
  let json: unknown = null;
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (res.ok) {
      json = await res.json();
    }
  } catch (error) {
    unlessUnreachable(error);
  }
  return { ...parseOEmbed(json), image: youTubeThumbnail(id) };
};

// リダイレクト後のページにある相対 og:image は最終 URL 基準で解決するので、最終 URL も返す
const fetchHead = async (url: string) => {
  try {
    const res = await fetch(url, {
      headers: { accept: "text/html", "user-agent": "times-link-preview" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok || !(res.headers.get("content-type") ?? "").includes("text/html")) {
      return null;
    }
    return { html: await readHead(res), url: res.url || url };
  } catch (error) {
    return unlessUnreachable(error);
  }
};

// 任意の URL を外部 fetch するので、呼び出し側が URL を絞る (公開側は digest 内、管理側は管理者のみ)
export const loadLinkPreviewCached = createServerOnlyFn(
  async (url: string): Promise<LinkPreview | null> =>
    // 利用者 URL をそのままキーにすると digest の固定キーを上書きできてしまう
    await cachedJson(
      // v2: title を足した。旧形のキャッシュを読まないためにキーを変える
      `https://cache.times.invalid/preview/v2/${encodeURIComponent(url)}`,
      linkPreview.nullable(),
      ttlOf,
      async () => {
        const id = youTubeId(url);
        if (id !== null) {
          return await loadYouTube(url, id);
        }
        const head = await fetchHead(url);
        return head === null ? null : parseLinkPreview(head.html, head.url);
      },
    ),
);
