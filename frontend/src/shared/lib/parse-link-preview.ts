import { z } from "zod";

export const linkPreview = z.object({
  title: z.string().nullable(),
  description: z.string().nullable(),
  image: z.string().nullable(),
});
export type LinkPreview = z.infer<typeof linkPreview>;

const entities: Record<string, string> = {
  "&amp;": "&",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&lt;": "<",
  "&gt;": ">",
};
const decode = (s: string) =>
  s.replaceAll(/&(?:amp|quot|#39|apos|lt|gt);/gu, (m) => entities[m] ?? m);

const metaTags = (html: string) => {
  const out = new Map<string, string>();
  for (const tag of html.matchAll(/<meta\b(?<attrs>[^>]*)>/giu)) {
    let key: string | undefined;
    let content: string | undefined;
    const attrs = tag.groups?.attrs ?? "";
    for (const attr of attrs.matchAll(
      /(?<name>[\w:-]+)\s*=\s*(?:"(?<dq>[^"]*)"|'(?<sq>[^']*)')/gu,
    )) {
      const value = attr.groups?.dq ?? attr.groups?.sq ?? "";
      const lower = (attr.groups?.name ?? "").toLowerCase();
      if (lower === "property" || lower === "name") {
        key = value.toLowerCase();
      } else if (lower === "content") {
        content = value;
      }
    }
    if (key !== undefined && content !== undefined && !out.has(key)) {
      out.set(key, decode(content).trim());
    }
  }
  return out;
};

const nonEmpty = (s: string | undefined) => (s === undefined || s === "" ? null : s);

const httpUrl = (raw: string | undefined, base: string) => {
  if (raw === undefined || raw === "") {
    return null;
  }
  const u = URL.parse(raw, base);
  return u?.protocol === "https:" || u?.protocol === "http:" ? u.href : null;
};

export const parseLinkPreview = (html: string, pageUrl: string): LinkPreview | null => {
  const meta = metaTags(html);
  const title =
    nonEmpty(meta.get("og:title")) ??
    nonEmpty(decode(/<title[^>]*>(?<t>[^<]*)<\/title>/iu.exec(html)?.groups?.t ?? "").trim());
  const description = nonEmpty(meta.get("og:description")) ?? nonEmpty(meta.get("description"));
  const image = httpUrl(meta.get("og:image") ?? meta.get("twitter:image"), pageUrl);
  return title === null && description === null && image === null
    ? null
    : { title, description, image };
};

const youtubeHosts = new Set(["youtube.com", "www.youtube.com", "m.youtube.com"]);
const videoId = /^[\w-]{11}$/u;

export const youTubeId = (url: string): string | null => {
  const u = URL.parse(url);
  if (u === null) {
    return null;
  }
  let id: string | undefined;
  if (u.hostname === "youtu.be") {
    id = u.pathname.slice(1);
  } else if (youtubeHosts.has(u.hostname)) {
    id =
      u.pathname === "/watch"
        ? (u.searchParams.get("v") ?? undefined)
        : /^\/(?:shorts|live|embed)\/(?<id>[^/]+)/u.exec(u.pathname)?.groups?.id;
  }
  return id !== undefined && videoId.test(id) ? id : null;
};

// maxresdefault は無い動画で 404 の灰色画像を返し onError で拾えないので、必ずある hqdefault にする
export const youTubeThumbnail = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

const oEmbed = z.object({
  title: z.string().optional(),
  author_name: z.string().optional(),
});

// oEmbed には概要文がないので、チャンネル名を説明の代わりにする
export const parseOEmbed = (json: unknown): Pick<LinkPreview, "title" | "description"> => {
  const parsed = oEmbed.safeParse(json);
  return {
    title: nonEmpty(parsed.data?.title?.trim()),
    description: nonEmpty(parsed.data?.author_name?.trim()),
  };
};
