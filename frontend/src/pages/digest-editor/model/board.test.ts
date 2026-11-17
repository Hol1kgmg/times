import { describe, expect, it } from "vitest";
import {
  addDraft,
  blockers,
  canMakeChild,
  convertToReposts,
  describeBoard,
  draftTitle,
  editLink,
  emptyBoard,
  fillTitle,
  fromDigest,
  fromIds,
  makeChild,
  moveToBoxEnd,
  pinReposts,
  rejectUpdate,
  remove,
  revert,
  settleCategory,
  stripTracking,
  toggleHot,
  toIds,
  toNewDigest,
  unmakeChild,
  UNSORTED,
  updateDraft,
} from "./board";
import { digest } from "#/shared/api";
import type { Board, BoxId, Draft, Link } from "./board";

const link = (id: string, title = `title ${id}`): Link => ({
  id,
  url: `https://example.com/${id}`,
  title,
  initial: { url: `https://example.com/${id}`, title },
  translated: false,
  hot: false,
});
const draft = (id: string, extra: Partial<Draft> = {}): Draft => ({
  ...link(id),
  suggested: false,
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
    expect(addDraft(b, "https://example.com/a", "x", "t", null)).toBe("duplicate");
    expect(addDraft(b, "https://example.com/b", "x", "t", null)).toBe("duplicate");
  });

  it("rejects the 101st article", () => {
    const b = board({ その他: Array.from({ length: 100 }, (_, i) => draft(String(i))) });
    expect(addDraft(b, "https://example.com/new", "x", "t", null)).toBe("limit");
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

  it("keeps a translated article from being translated again even after a manual edit", () => {
    const b = board({ その他: [draft("a")] });
    const translated = ok(
      editLink(b, "a", { url: "https://example.com/a", title: "訳", translated: true }),
    );
    const edited = ok(
      editLink(translated, "a", { url: "https://example.com/a", title: "直した訳" }),
    );
    expect(edited.その他[0]?.translated).toBeTruthy();
  });

  it("allows translating again after reverting", () => {
    const b = board({ その他: [draft("a")] });
    const translated = ok(
      editLink(b, "a", { url: "https://example.com/a", title: "訳", translated: true }),
    );
    expect(revert(translated, "a").その他[0]?.translated).toBeFalsy();
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
      "url" in i ? i.url : i.repostOf,
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

  it("blocks registration on unsorted articles and untitled related articles", () => {
    const b = board({
      [UNSORTED]: [draft("u")],
      その他: [draft("a", { children: [link("c", " ")] })],
    });
    expect(blockers(b)).toStrictEqual([
      { kind: "unsorted", count: 1 },
      { kind: "untitled", ids: ["c"] },
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
    expect(nested.その他[0]?.children[0]?.hot).toBeFalsy();
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
    repost: false,
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
          { id: uuid(31), hot: false, title: "title 31", url: "https://example.com/31" },
          { id: uuid(32), hot: true, title: "title 32", url: "https://example.com/32" },
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
        children: children.map((c) => ({ title: c.title, url: c.url, hot: c.hot })),
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

  it("sends a repost as a reference to the article, keeping the hot flags of its children", () => {
    const b = board({
      IT系: [draft("a", { repost: { firstPublishedOn: "2026-10-03" }, children: [link("c")] })],
    });
    const hot = toggleHot(b, "c");
    expect(toNewDigest(hot, "2026-10-20").articles).toStrictEqual([
      {
        repostOf: "https://example.com/a",
        category: "IT系",
        children: [{ title: "title c", url: "https://example.com/c", hot: true }],
      },
    ]);
  });
});

describe("断られた行を再掲載にする", () => {
  const original = {
    url: "https://example.com/a",
    title: "元のタイトル",
    category: "AI系",
    firstPublishedOn: "2026-10-03",
  } as const;

  it("turns a rejected article into a repost of the original, moving it back unless it has children", () => {
    const b = board({
      IT系: [draft("a", { hot: true }), draft("b", { children: [link("c")] })],
    });
    const converted = convertToReposts(b, [
      original,
      { ...original, url: "https://example.com/b" },
    ]);
    expect(converted.IT系.map((d) => [d.id, d.title, d.repost?.category])).toStrictEqual([
      ["b", "元のタイトル", "AI系"],
    ]);
    expect(converted.AI系).toMatchObject([
      { id: "a", title: "元のタイトル", hot: false, repost: { firstPublishedOn: "2026-10-03" } },
    ]);
    expect(pinReposts(remove(converted, "c")).AI系.map((d) => d.id)).toStrictEqual(["a", "b"]);
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

describe("カテゴリの推定", () => {
  it("moves an unsorted draft to the end of the suggested category and marks it", () => {
    const b = settleCategory(board({ [UNSORTED]: [draft("a")], AI系: [draft("x")] }), "a", "AI系");
    expect(b[UNSORTED]).toHaveLength(0);
    expect(b.AI系.map((d) => [d.id, d.suggested])).toStrictEqual([
      ["x", false],
      ["a", true],
    ]);
  });

  it("keeps a draft the admin already moved out of unsorted", () => {
    const b = board({ その他: [draft("a")] });
    expect(settleCategory(b, "a", "AI系")).toBe(b);
  });

  it("leaves the draft unsorted when no category is suggested", () => {
    const b = board({ [UNSORTED]: [draft("a")] });
    expect(settleCategory(b, "a", null)).toBe(b);
  });

  it("clears the suggestion mark when the admin moves the draft to another box", () => {
    const b = board({ AI系: [draft("a", { suggested: true })] });
    expect(moveToBoxEnd(b, "a", "IT系").IT系[0]?.suggested).toBeFalsy();
    expect(fromIds(b, { ...toIds(b), AI系: [], IT系: ["a"] }).IT系[0]?.suggested).toBeFalsy();
  });

  it("keeps the suggestion mark when reordering within the same box", () => {
    const b = board({ AI系: [draft("a", { suggested: true }), draft("b")] });
    expect(fromIds(b, { ...toIds(b), AI系: ["b", "a"] }).AI系[1]?.suggested).toBeTruthy();
  });
});

describe("エージェントの更新", () => {
  it("moves the draft to the agent's category with the AI mark even after clef sorted it elsewhere", () => {
    const b = updateDraft(board({ IT系: [draft("a", { suggested: true })] }), "a", {
      category: "AI系",
      hot: true,
    });
    expect(b.IT系).toHaveLength(0);
    expect(b.AI系.map((d) => [d.id, d.suggested, d.hot])).toStrictEqual([["a", true, true]]);
  });

  it("lists every box in order with draft ids, the hot mark and children", () => {
    const b = board({ AI系: [draft("a", { hot: true, children: [link("c")] })] });
    const text = describeBoard(b);
    expect(text).toContain(
      "AI系 (1 件)\n- a: title a / https://example.com/a [hot]\n  - 子記事 c: title c / https://example.com/c",
    );
    expect(text.indexOf(UNSORTED)).toBeLessThan(text.indexOf("AI系"));
  });

  it("rejects moving or marking a child article while letting its title be fixed", () => {
    const b = board({ AI系: [draft("a", { children: [link("c")] })] });
    expect(rejectUpdate(b, { id: "c", category: "その他" })).toBe("child");
    expect(rejectUpdate(b, { id: "c", title: "直す" })).toBeNull();
    expect(rejectUpdate(b, { id: "x", title: "直す" })).toBe("missing");
  });

  it("keeps a title entered while the fetch was in flight", () => {
    const empty = ok(addDraft(emptyBoard(), "https://example.com/a", "a", "", null));
    const b = fillTitle(updateDraft(empty, "a", { title: "手入力" }), "a", "取得", null);
    expect(b[UNSORTED][0]?.title).toBe("手入力");
  });
});

describe("タイトルの自動翻訳", () => {
  it("shows the translated title and keeps the fetched title for reverting", () => {
    const b = ok(addDraft(emptyBoard(), "https://example.com/a", "a", "title a", "訳"));
    expect(b[UNSORTED][0]).toMatchObject({
      title: "訳",
      translated: true,
      initial: { title: "title a" },
    });
  });
});
