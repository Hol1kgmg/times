export interface Candidate {
  text: string;
  start: number;
  end: number;
}

const EDGE_PUNCTUATION = /^[:,()"'!?]+|[:,()"'!?]+$/gu;
const MAX_QUESTIONS = 64;

export const candidates = (title: string): Candidate[] => {
  const words = title
    .split(/\s+/u)
    .map((w) => w.replaceAll(EDGE_PUNCTUATION, ""))
    .filter((w) => w !== "");
  const out: Candidate[] = [];
  for (let start = 0; start < words.length; start += 1) {
    for (let end = start + 1; end <= Math.min(start + 3, words.length); end += 1) {
      const text = words.slice(start, end).join(" ");
      // 語の間の記号を外して繋いだ語は原文に無く、翻訳の前に span で囲めない
      if (title.includes(text)) {
        out.push({ text, start, end });
      }
    }
  }
  // ponytail: clef の質問の上限 64。長いタイトルの後ろは聞かない
  return out.slice(0, MAX_QUESTIONS);
};

export const pickTerms = (cands: Candidate[], yes: number[]): string[] => {
  const picked: Candidate[] = [];
  const likely = cands
    .filter((_, i) => (yes[i] ?? 0) >= 0.5)
    .toSorted((a, b) => b.end - b.start - (a.end - a.start) || a.start - b.start);
  for (const c of likely) {
    if (picked.every((p) => c.end <= p.start || c.start >= p.end)) {
      picked.push(c);
    }
  }
  return [...new Set(picked.map((c) => c.text))];
};
