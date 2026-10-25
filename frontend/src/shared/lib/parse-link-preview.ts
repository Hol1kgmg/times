export interface LinkPreview {
  title: string | null;
  description: string | null;
  image: string | null;
}

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
  try {
    const u = new URL(raw, base);
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : null;
  } catch {
    return null;
  }
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
