import { decodeEntities } from "#/shared/lib/parse-link-preview";

const KEEP_OPEN = '<span translate="no" class="notranslate">';

const escapeHtml = (s: string) =>
  s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const escapeRegExp = (s: string) => s.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`);

const termPattern = (terms: string[]) => {
  const alternatives = terms.toSorted((a, b) => b.length - a.length).map(escapeRegExp);
  // 語の途中 (Google の中の Go) を囲まないよう、前後が文字・数字でない所だけを語とみなす
  return new RegExp(`(?<![\\p{L}\\p{N}])(${alternatives.join("|")})(?![\\p{L}\\p{N}])`, "u");
};

export const toHtml = (title: string, terms: string[]): string => {
  if (terms.length === 0) {
    return escapeHtml(title);
  }
  return title
    .split(termPattern(terms))
    .map((part, i) => (i % 2 === 1 ? `${KEEP_OPEN}${escapeHtml(part)}</span>` : escapeHtml(part)))
    .join("");
};

export const hasKanaOrKanji = (title: string) =>
  /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u.test(title);

export const hasWordsToTranslate = (title: string, terms: string[]) =>
  (terms.length === 0 ? [title] : title.split(termPattern(terms)).filter((_, i) => i % 2 === 0))
    .flatMap((part) => part.split(/[^\p{L}\p{N}'-]+/u))
    .some((w) => /^[A-Za-z]+(?:['-][A-Za-z]+)*$/u.test(w));

const LATIN_WORD = /[A-Za-z0-9](?:[A-Za-z0-9.+#-]*[A-Za-z0-9+#])?/gu;

const countWords = (s: string) => {
  const counts = new Map<string, number>();
  for (const w of s.match(LATIN_WORD) ?? []) {
    counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  return counts;
};

// span の直前以外に書き足された英単語は直し方が分からないので、崩れた訳として捨てる
const repeatsWords = (title: string, translated: string) => {
  const original = countWords(title);
  return [...countWords(translated)].some(([w, n]) => n > (original.get(w) ?? n));
};

export const fromHtml = (title: string, terms: string[], html: string): string | null => {
  const text = html
    // v2 は語順を入れ替える長い文で、span の直前に語の頭の英単語を書き足すことがある (Apple <span>Apple Silicon</span>)
    .replaceAll(
      /(?<![A-Za-z0-9])(?<word>[A-Za-z0-9]+)\s+(?<open><span[^>]*>)\k<word>(?![A-Za-z0-9])/gu,
      "$<open>$<word>",
    )
    // v2 は span の外側に空白を足す。英単語どうしの間の空白は原文にあったものなので残す
    .replaceAll(
      /(?<=[\P{ASCII}([])\s+(?=<span[^>]*>)|(?<=<\/span>)\s+(?=[\P{ASCII})\].,:;!?])/gu,
      "",
    )
    .replaceAll(/<span[^>]*>|<\/span>/gu, "");
  if (text.includes("<")) {
    return null;
  }
  // Cloud Translation v2 は訳の本文の文字参照を二重にエスケープして返す
  // ponytail: 原文に `&amp;` の文字そのものがあると戻しすぎる。出たら送る前に印へ置き換える
  const decoded = decodeEntities(decodeEntities(text));
  return terms.every((t) => decoded.includes(t)) && !repeatsWords(title, decoded) ? decoded : null;
};
