import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { cachedJson } from "#/shared/api";
import type { LinkPreview } from "../model/parse-link-preview";
import { parseLinkPreview } from "../model/parse-link-preview";

// 外部サイトの HTML を Workers 側で取りに行く。ブラウザからは CORS で読めないため
// YouTube は og タグの手前に 750KB 超のスクリプトを置くので、</head> が出るまで読む
const MAX_BYTES = 1024 * 1024;
// 失敗 (タイムアウト等) は一時的なことが多いので短くしか覚えない
const ttlOf = (preview: LinkPreview | null) => (preview === null ? 3600 : 86_400);
const latin1 = new TextDecoder("latin1");
const endsHead = (chunk: Uint8Array) => latin1.decode(chunk).includes("</head>");

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
  for await (const chunk of res.body) {
    chunks.push(chunk);
    size += chunk.length;
    if (size >= MAX_BYTES || endsHead(chunk)) {
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

export const getLinkPreview = createServerFn({ method: "GET" })
  .validator(z.url({ protocol: /^https?$/u }).max(2000))
  .handler(
    async ({ data: url }): Promise<LinkPreview | null> =>
      // 利用者 URL をそのままキーにすると digest の固定キーを上書きできてしまう
      await cachedJson(
        `https://cache.times.invalid/preview/${encodeURIComponent(url)}`,
        ttlOf,
        async () => {
          try {
            const res = await fetch(url, {
              headers: { accept: "text/html", "user-agent": "times-link-preview" },
              signal: AbortSignal.timeout(5000),
            });
            if (!res.ok || !(res.headers.get("content-type") ?? "").includes("text/html")) {
              return null;
            }
            // リダイレクト後のページにある相対 og:image は最終 URL 基準で解決する
            return parseLinkPreview(await readHead(res), res.url || url);
          } catch {
            return null;
          }
        },
      ),
  );
