import { describe, expect, it } from "vitest";
import {
  addDraft,
  blockers,
  canMakeChild,
  draftTitle,
  editLink,
  emptyBoard,
  fromDigest,
  fromIds,
  makeChild,
  moveToBoxEnd,
  revert,
  settleTitle,
  stripTracking,
  toggleHot,
  toIds,
  toNewDigest,
  unmakeChild,
  UNSORTED,
} from "./board";
import { digest } from "#/shared/api/schemas";
import type { Board, BoxId, Draft, Link } from "./board";

const link = (id: string, title = `title ${id}`): Link => ({
  id,
  url: `https://example.com/${id}`,
  title,
  initial: { url: `https://example.com/${id}`, title },
  status: "done",
});
const draft = (id: string, extra: Partial<Draft> = {}): Draft => ({
  ...link(id),
  hot: false,
  children: [],
  ...extra,
});
const board = (boxes: Partial<Board>): Board => ({ ...emptyBoard(), ...boxes });
const ok = (b: Board | string): Board => {
  if (typeof b === "string") {
    throw new TypeError(`rejected: ${b}`);
  }
  return b;
};

describe("集める", () => {
  it("drops tracking parameters from an added URL", () => {
    expect(stripTracking("https://example.com/a?utm_source=x&fbclid=y#h")).toBe(
      "https://example.com/a#h",
    );
  });

  it("keeps query parameters that point to the article", () => {
    expect(stripTracking("https://www.youtube.com/watch?v=abc&si=xyz")).toBe(
      "https://www.youtube.com/watch?v=abc",
    );
  });

  it("leaves a URL without tracking parameters exactly as entered", () => {
    expect(stripTracking("https://example.com/p?123&q=a%20b")).toBe(
      "https://example.com/p?123&q=a%20b",
    );
  });

  it("rejects a URL already used by an article or a related article", () => {
    const b = board({ その他: [draft("a", { children: [link("b")] })] });
    expect(addDraft(b, "https://example.com/a", "x")).toBe("duplicate");
    expect(addDraft(b, "https://example.com/b", "x")).toBe("duplicate");
  });

  it("rejects the 101st article", () => {
    const b = board({ その他: Array.from({ length: 100 }, (_, i) => draft(String(i))) });
    expect(addDraft(b, "https://example.com/new", "x")).toBe("limit");
  });

  it("keeps the title empty but settles the initial state when fetching fails", () => {
    const b = settleTitle(ok(addDraft(emptyBoard(), "https://example.com/a", "a")), "a", null);
    expect(b[UNSORTED][0]).toMatchObject({
      title: "",
      status: "failed",
      initial: { url: "https://example.com/a", title: "" },
    });
  });
});

describe("振り分ける", () => {
  it("keeps the hot flag and related articles when an article moves across boxes", () => {
    const a = draft("a", { hot: true, children: [link("c")] });
    const b = board({ [UNSORTED]: [a], その他: [draft("b")] });
    const next = fromIds(b, { ...toIds(b), [UNSORTED]: [], その他: ["b", "a"] });
    expect(next.その他[1]).toBe(a);
  });

  it("puts an article at the end of a box when dropped on the box itself", () => {
    const b = board({ [UNSORTED]: [draft("a")], その他: [draft("b"), draft("c")] });
    expect(moveToBoxEnd(b, "a", "その他").その他.map((d) => d.id)).toStrictEqual(["b", "c", "a"]);
  });

  it("reuses the array of a box whose content did not change", () => {
    const b = board({ [UNSORTED]: [draft("a")], その他: [draft("b")], IT系: [draft("c")] });
    const ids: Record<BoxId, string[]> = { ...toIds(b), [UNSORTED]: [], その他: ["b", "a"] };
    expect(fromIds(b, ids).IT系).toBe(b.IT系);
  });
});

describe("手直し", () => {
  it("restores the fetched title and URL but keeps the hot flag, related articles and position", () => {
    const b = board({ その他: [draft("x"), draft("a", { hot: true, children: [link("c")] })] });
    const edited = ok(editLink(b, "a", { url: "https://example.com/z", title: "直した" }));
    const [, reverted] = revert(edited, "a").その他;
    expect(reverted).toMatchObject({ url: "https://example.com/a", title: "title a", hot: true });
    expect(reverted?.children).toHaveLength(1);
  });

  it("rejects editing a URL into one another candidate already uses", () => {
    const b = board({ その他: [draft("a"), draft("b")] });
    expect(editLink(b, "b", { url: "https://example.com/a", title: "t" })).toBe("duplicate");
  });

  it("rejects an edited URL that only differs from another candidate by tracking parameters", () => {
    const b = board({ その他: [draft("a"), draft("b")] });
    expect(editLink(b, "b", { url: "https://example.com/a?utm_source=x", title: "t" })).toBe(
      "duplicate",
    );
  });
});

describe("登録", () => {
  it("sends categories in the fixed order, then box order, then related article order, without unsorted", () => {
    const b = board({
      その他: [draft("o")],
      セキュリティ: [draft("s1", { children: [link("c1"), link("c2")] }), draft("s2")],
    });
    const urls = toNewDigest(b, "2026-10-25").articles.map((i) => [
      i.category,
      i.url,
      i.children.map((c) => c.url),
    ]);
    expect(urls).toStrictEqual([
      [
        "セキュリティ",
        "https://example.com/s1",
        ["https://example.com/c1", "https://example.com/c2"],
      ],
      ["セキュリティ", "https://example.com/s2", []],
      ["その他", "https://example.com/o", []],
    ]);
  });

  it("blocks registration on unsorted articles, untitled related articles and pending fetches", () => {
    const loading: Draft = { ...draft("l"), status: "loading", title: "" };
    const b = board({
      [UNSORTED]: [loading],
      その他: [draft("a", { children: [link("c", " ")] })],
    });
    expect(blockers(b)).toStrictEqual([
      { kind: "unsorted", count: 1 },
      { kind: "untitled", ids: ["c"] },
      { kind: "loading" },
    ]);
  });
});

describe("関連記事", () => {
  it("cannot nest the first article, an article with related articles, or under a full parent", () => {
    const full = draft("p", { children: Array.from({ length: 20 }, (_, i) => link(`c${i}`)) });
    const b = board({
      その他: [draft("first"), draft("withChild", { children: [link("k")] })],
      IT系: [full, draft("next")],
    });
    expect(canMakeChild(b, "first")).toBeFalsy();
    expect(canMakeChild(b, "withChild")).toBeFalsy();
    expect(canMakeChild(b, "next")).toBeFalsy();
  });

  it("drops the hot flag when nested and returns right after the parent when unnested", () => {
    const b = board({ その他: [draft("a"), draft("b", { hot: true }), draft("z")] });
    const nested = makeChild(toggleHot(b, "a"), "b");
    expect(nested.その他.map((d) => d.id)).toStrictEqual(["a", "z"]);
    expect(nested.その他[0]?.children[0]).not.toHaveProperty("hot");
    const back = ok(unmakeChild(nested, "a", "b"));
    expect(back.その他.map((d) => [d.id, d.hot])).toStrictEqual([
      ["a", true],
      ["b", false],
      ["z", false],
    ]);
  });
});

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

describe("保存済みの Digest を開く", () => {
  const article = (n: number, extra: object = {}) => ({
    id: uuid(n),
    category: "その他",
    hot: false,
    title: `title ${n}`,
    url: `https://example.com/${n}`,
    children: [],
    ...extra,
  });
  const saved = digest.parse({
    id: uuid(0),
    entryDate: "2026-10-20",
    status: "published",
    articles: [
      article(1, { category: "IT系", hot: true }),
      article(2, { category: "IT系" }),
      article(3, {
        children: [
          { id: uuid(31), title: "title 31", url: "https://example.com/31" },
          { id: uuid(32), title: "title 32", url: "https://example.com/32" },
        ],
      }),
    ],
  });

  it("reopens a saved digest with the same categories, order, hot flags and related articles", () => {
    const b = fromDigest(saved);
    expect(b[UNSORTED]).toHaveLength(0);
    expect(toNewDigest(b, saved.entryDate)).toStrictEqual({
      entryDate: saved.entryDate,
      articles: saved.articles.map(({ category, hot, title, url, children }) => ({
        category,
        hot,
        title,
        url,
        children: children.map((c) => ({ title: c.title, url: c.url })),
      })),
    });
  });

  it("reverts a saved article to its saved title and URL, keeping its hot flag", () => {
    const edited = toggleHot(
      ok(editLink(fromDigest(saved), uuid(2), { url: "https://example.com/x", title: "x" })),
      uuid(2),
    );
    expect(revert(edited, uuid(2)).IT系[1]).toMatchObject({
      url: "https://example.com/2",
      title: "title 2",
      hot: true,
    });
  });
});

describe("取得したタイトルの初期値", () => {
  const preview = { title: "動画", description: "チャンネル", image: null };

  it("YouTube はチャンネル名を前に付ける", () => {
    expect(draftTitle("https://youtu.be/P7sK966R3eI", preview)).toBe("YouTube チャンネル - 動画");
  });

  it("チャンネル名が取れないときと YouTube 以外は取得したタイトルのまま", () => {
    expect(draftTitle("https://youtu.be/P7sK966R3eI", { ...preview, description: null })).toBe(
      "動画",
    );
    expect(draftTitle("https://x.example/a", preview)).toBe("動画");
  });
});
