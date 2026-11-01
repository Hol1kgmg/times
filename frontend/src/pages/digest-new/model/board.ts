import { category } from "#/shared/api/schemas";
import type { Category, Digest, DigestContent } from "#/shared/api/schemas";
import type { LinkPreview } from "#/shared/lib/parse-link-preview";
import { youTubeId } from "#/shared/lib/parse-link-preview";

export const UNSORTED = "未分類";
export type BoxId = typeof UNSORTED | Category;
export const boxIds: readonly BoxId[] = [UNSORTED, ...category.options];

// 上限は openapi.yaml の NewDigest.articles (maxItems 100) と NewArticle.children (maxItems 20)
export const MAX_DRAFTS = 100;
export const MAX_CHILDREN = 20;

export type FetchState = "loading" | "done" | "failed";

export interface Link {
  id: string;
  url: string;
  title: string;
  initial: { url: string; title: string };
  status: FetchState;
}

export interface Draft extends Link {
  hot: boolean;
  children: Link[];
}

export type Board = Record<BoxId, Draft[]>;
export type Rejected = "duplicate" | "limit";

export type Blocker =
  | { kind: "empty" }
  | { kind: "unsorted"; count: number }
  | { kind: "untitled"; ids: string[] }
  | { kind: "loading" };

// キーを列挙して組むことで、カテゴリが増えたら型エラーで気づける
const byBox = <T>(f: (box: BoxId) => T): Record<BoxId, T> => ({
  [UNSORTED]: f(UNSORTED),
  セキュリティ: f("セキュリティ"),
  IT系: f("IT系"),
  UI系: f("UI系"),
  AI系: f("AI系"),
  "面白そうなツール・サービス": f("面白そうなツール・サービス"),
  その他: f("その他"),
});

export const emptyBoard = (): Board => byBox(() => []);

const drafts = (board: Board) => boxIds.flatMap((b) => board[b]);
const links = (board: Board) => drafts(board).flatMap((d): Link[] => [d, ...d.children]);
export const draftCount = (board: Board) => drafts(board).length;
export const hasDrafts = (board: Board) => draftCount(board) > 0;

export const findDuplicate = (board: Board, url: string, exceptId?: string) =>
  links(board).some((l) => l.url === url && l.id !== exceptId);

const mapDrafts = (board: Board, f: (d: Draft) => Draft): Board => byBox((b) => board[b].map(f));

const mapLink = (board: Board, id: string, f: <T extends Link>(l: T) => T): Board =>
  mapDrafts(board, (d) => {
    if (d.id === id) {
      return f(d);
    }
    return d.children.some((c) => c.id === id)
      ? { ...d, children: d.children.map((c) => (c.id === id ? f(c) : c)) }
      : d;
  });

const locate = (board: Board, id: string) => {
  for (const box of boxIds) {
    const index = board[box].findIndex((d) => d.id === id);
    if (index !== -1) {
      return { box, index };
    }
  }
  return null;
};

// クエリごと消すと YouTube の ?v= のように記事を指すクエリまで消えるので、追跡用だけを消す
const trackingParams = new Set(["fbclid", "gclid", "yclid", "mc_cid", "mc_eid", "ref_src", "si"]);

export const stripTracking = (url: string): string => {
  const u = new URL(url);
  const kept = [...u.searchParams].filter(
    ([key]) => !key.startsWith("utm_") && !trackingParams.has(key),
  );
  // URLSearchParams で組み直すと ?a が ?a= になるなど別の URL に変わるので、消すものが無ければ触らない
  if (kept.length === u.searchParams.size) {
    return url;
  }
  u.search = new URLSearchParams(kept).toString();
  return u.toString();
};

const replaceBox = (board: Board, box: BoxId, items: Draft[]): Board => ({
  ...board,
  [box]: items,
});

export const addDraft = (board: Board, url: string, id: string): Board | Rejected => {
  if (findDuplicate(board, url)) {
    return "duplicate";
  }
  if (draftCount(board) >= MAX_DRAFTS) {
    return "limit";
  }
  const draft: Draft = {
    id,
    url,
    title: "",
    initial: { url, title: "" },
    status: "loading",
    hot: false,
    children: [],
  };
  return replaceBox(board, UNSORTED, [...board[UNSORTED], draft]);
};

// YouTube のプレビューは description にチャンネル名を入れている (parseOEmbed)
export const draftTitle = (url: string, preview: LinkPreview | null): string | null => {
  const title = preview?.title ?? null;
  const channel = preview?.description ?? null;
  return title !== null && channel !== null && youTubeId(url) !== null
    ? `YouTube ${channel} - ${title}`
    : title;
};

export const settleTitle = (board: Board, id: string, title: string | null): Board =>
  mapLink(board, id, (l) => ({
    ...l,
    // 取得を待つ間に手で入れたタイトルは上書きしない
    title: l.title === "" ? (title ?? "") : l.title,
    initial: { ...l.initial, title: title ?? "" },
    status: title === null ? "failed" : "done",
  }));

export const editLink = (
  board: Board,
  id: string,
  next: { url: string; title: string },
): Board | Rejected => {
  const url = stripTracking(next.url);
  return findDuplicate(board, url, id)
    ? "duplicate"
    : mapLink(board, id, (l) => ({ ...l, ...next, url }));
};

export const revert = (board: Board, id: string): Board =>
  mapLink(board, id, (l) => ({ ...l, url: l.initial.url, title: l.initial.title }));

export const toggleHot = (board: Board, id: string): Board =>
  mapDrafts(board, (d) => (d.id === id ? { ...d, hot: !d.hot } : d));

export const remove = (board: Board, id: string): Board =>
  byBox((b) =>
    board[b]
      .filter((d) => d.id !== id)
      .map((d) =>
        d.children.some((c) => c.id === id)
          ? { ...d, children: d.children.filter((c) => c.id !== id) }
          : d,
      ),
  );

export const canMakeChild = (board: Board, id: string) => {
  const at = locate(board, id);
  if (at === null || at.index === 0) {
    return false;
  }
  const items = board[at.box];
  return (
    items[at.index]?.children.length === 0 &&
    (items[at.index - 1]?.children.length ?? MAX_CHILDREN) < MAX_CHILDREN
  );
};

export const makeChild = (board: Board, id: string): Board => {
  const at = locate(board, id);
  if (at === null || !canMakeChild(board, id)) {
    return board;
  }
  const items = [...board[at.box]];
  const [draft] = items.splice(at.index, 1);
  const parent = items[at.index - 1];
  if (draft === undefined || parent === undefined) {
    return board;
  }
  const { url, title, initial, status } = draft;
  items[at.index - 1] = {
    ...parent,
    children: [...parent.children, { id, url, title, initial, status }],
  };
  return replaceBox(board, at.box, items);
};

export const unmakeChild = (board: Board, parentId: string, childId: string): Board | Rejected => {
  const at = locate(board, parentId);
  const parent = at === null ? undefined : board[at.box][at.index];
  const child = parent?.children.find((c) => c.id === childId);
  if (at === null || parent === undefined || child === undefined) {
    return board;
  }
  if (draftCount(board) >= MAX_DRAFTS) {
    return "limit";
  }
  const items = [...board[at.box]];
  items.splice(
    at.index,
    1,
    { ...parent, children: parent.children.filter((c) => c.id !== childId) },
    { ...child, hot: false, children: [] },
  );
  return replaceBox(board, at.box, items);
};

export const moveChild = (board: Board, parentId: string, childId: string, step: -1 | 1): Board =>
  mapDrafts(board, (d) => {
    const from = d.children.findIndex((c) => c.id === childId);
    const to = from + step;
    if (d.id !== parentId || from === -1 || to < 0 || to >= d.children.length) {
      return d;
    }
    const children = [...d.children];
    const [moved] = children.splice(from, 1);
    if (moved === undefined) {
      return d;
    }
    children.splice(to, 0, moved);
    return { ...d, children };
  });

export const isBoxId = (id: unknown): id is BoxId => boxIds.some((b) => b === id);

// move() は箱そのもの (見出しや空き) に落とすと先頭に入れるが、spec は末尾に入れる
export const moveToBoxEnd = (board: Board, id: string, box: BoxId): Board => {
  const at = locate(board, id);
  const draft = at === null ? undefined : board[at.box][at.index];
  if (
    at === null ||
    draft === undefined ||
    (at.box === box && at.index === board[box].length - 1)
  ) {
    return board;
  }
  const without = replaceBox(
    board,
    at.box,
    board[at.box].filter((d) => d.id !== id),
  );
  return replaceBox(without, box, [...without[box], draft]);
};

export const toIds = (board: Board): Record<BoxId, string[]> =>
  byBox((b) => board[b].map((d) => d.id));

// 中身の変わらない箱は配列の参照を使い回し、箱の memo を効かせる
export const fromIds = (board: Board, ids: Record<BoxId, string[]>): Board => {
  const byId = new Map(drafts(board).map((d) => [d.id, d]));
  return byBox((b) => {
    const next = ids[b];
    if (next.length === board[b].length && next.every((id, i) => board[b][i]?.id === id)) {
      return board[b];
    }
    return next.map((id) => {
      const draft = byId.get(id);
      if (draft === undefined) {
        throw new Error(`board: unknown draft id "${id}"`);
      }
      return draft;
    });
  });
};

export const blockers = (board: Board): Blocker[] => {
  const out: Blocker[] = [];
  if (category.options.every((c) => board[c].length === 0)) {
    out.push({ kind: "empty" });
  }
  if (board[UNSORTED].length > 0) {
    out.push({ kind: "unsorted", count: board[UNSORTED].length });
  }
  const untitled = links(board).filter((l) => l.status !== "loading" && l.title.trim() === "");
  if (untitled.length > 0) {
    out.push({ kind: "untitled", ids: untitled.map((l) => l.id) });
  }
  if (links(board).some((l) => l.status === "loading")) {
    out.push({ kind: "loading" });
  }
  return out;
};

const savedLink = ({ id, url, title }: { id: string; url: string; title: string }): Link => ({
  id,
  url,
  title,
  initial: { url, title },
  status: "done",
});

export const fromDigest = (digest: Digest): Board => {
  const board = emptyBoard();
  for (const a of digest.articles) {
    board[a.category].push({ ...savedLink(a), hot: a.hot, children: a.children.map(savedLink) });
  }
  return board;
};

export const toNewDigest = (board: Board, entryDate: string): DigestContent => ({
  entryDate,
  articles: category.options.flatMap((c) =>
    board[c].map((d) => ({
      category: c,
      hot: d.hot,
      title: d.title,
      url: d.url,
      children: d.children.map((ch) => ({ title: ch.title, url: ch.url })),
    })),
  ),
});
