import { category } from "#/shared/api";
import type {
  Category,
  ChildEntry,
  Digest,
  DigestContent,
  DigestEntry,
  repostCandidate,
} from "#/shared/api";
import type { z } from "zod";
import type { Hideable, Repostable } from "../api/rejection-of";
import type { LinkPreview } from "#/shared/lib/parse-link-preview";
import type { DraftDigest } from "#/shared/ui/digest-post";
import { youTubeId } from "#/shared/lib/parse-link-preview";

export const UNSORTED = "未分類";
export type BoxId = typeof UNSORTED | Category;
export const boxIds: readonly BoxId[] = [UNSORTED, ...category.options];

// 上限は openapi.yaml の NewDigest.articles (maxItems 100) と NewArticle.children (maxItems 20)
export const MAX_DRAFTS = 100;
export const MAX_CHILDREN = 20;

export interface Link {
  id: string;
  url: string;
  title: string;
  initial: { url: string; title: string };
  // 一度翻訳した記事を重ねて訳さないための印。保存しない
  translated: boolean;
  hot: boolean;
  // 保存済みの記事のカテゴリ。枠と違えば、保存で変わるか (元の掲載)、変わらないか (再掲載) を示す
  category?: Category;
  // 前の日付に掲載がある子。記事を書き換えないので、並べ替えと削除だけにする
  repostChild?: true;
  // 元の掲載の Digest が公開済みでなく、公開ページに出ない
  unpublished?: true;
  hidden?: true;
}

export interface LinkEdit {
  url: string;
  title: string;
  translated?: boolean;
}

export interface Draft extends Link {
  suggested: boolean;
  children: Link[];
  // category は子がない間に戻す元の記事のカテゴリ。listed は親もその日に載せるか (specs/018 Revision 4)
  repost?: { category: Category; firstPublishedOn?: string; listed: boolean };
  // 子がほかの日にいて外せないので、外す代わりに隠した行
}

export type Board = Record<BoxId, Draft[]>;
export type RepostCandidate = z.infer<typeof repostCandidate>;
export type Rejected = "duplicate" | "limit";

export type Blocker =
  | { kind: "empty" }
  | { kind: "unsorted"; count: number }
  | { kind: "untitled"; ids: string[] };

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
// 紐付け直すときに探し直さずに済むよう消さずに残すが、保存では送らない
export const isGhost = (d: Draft) => d.repost?.listed === false && d.children.length === 0;
// 上限は送る件数なので、送らない幽霊の親は数えない
export const draftCount = (board: Board) => drafts(board).filter((d) => !isGhost(d)).length;
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

export const rejectAdd = (board: Board, url: string): Rejected | null => {
  if (findDuplicate(board, url)) {
    return "duplicate";
  }
  return draftCount(board) >= MAX_DRAFTS ? "limit" : null;
};

export const addDraft = (
  board: Board,
  url: string,
  id: string,
  title: string,
  translation: string | null,
): Board | Rejected => {
  const rejected = rejectAdd(board, url);
  if (rejected !== null) {
    return rejected;
  }
  const draft: Draft = {
    id,
    url,
    title: translation ?? title,
    // 「変更を戻す」で原文に戻し、手動で訳し直せるようにする
    initial: { url, title },
    translated: translation !== null,
    hot: false,
    suggested: false,
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

export const editLink = (board: Board, id: string, next: LinkEdit): Board | Rejected => {
  const url = stripTracking(next.url);
  return findDuplicate(board, url, id)
    ? "duplicate"
    : mapLink(board, id, (l) => ({
        ...l,
        url,
        title: next.title,
        // 訳した後に手で直しても、訳し直すのは「変更を戻す」の後だけにする
        translated: l.translated || next.translated === true,
      }));
};

export const revert = (board: Board, id: string): Board =>
  mapLink(board, id, (l) => ({
    ...l,
    url: l.initial.url,
    title: l.initial.title,
    translated: false,
  }));

export const settleCategory = (board: Board, id: string, suggested: Category | null): Board => {
  const draft = board[UNSORTED].find((d) => d.id === id);
  if (suggested === null || draft === undefined) {
    return board;
  }
  return {
    ...board,
    [UNSORTED]: board[UNSORTED].filter((d) => d.id !== id),
    [suggested]: [...board[suggested], { ...draft, suggested: true }],
  };
};

// 親が HOT の子は保存時に HOT にそろい、読み直すと子自身の HOT が消えるので、編集中も先に外す (specs/018 FR-016)
const settleChildHot = (d: Draft): Draft =>
  d.hot && d.children.some((c) => c.hot)
    ? { ...d, children: d.children.map((c) => ({ ...c, hot: false })) }
    : d;

export const toggleHot = (board: Board, id: string): Board =>
  mapDrafts(
    mapLink(board, id, (l) => ({ ...l, hot: !l.hot })),
    (d) => (d.id === id ? settleChildHot(d) : d),
  );

const repostTag = (d: Draft) => {
  if (d.repost === undefined) {
    return "";
  }
  if (d.repost.listed) {
    return " [再掲載]";
  }
  return isGhost(d) ? " [紐付けの親・子がないので保存されない]" : " [紐付けの親]";
};

const linkLine = (l: Link) => `${l.id}: ${l.title === "" ? "(タイトルなし)" : l.title} / ${l.url}`;

export const describeBoard = (board: Board): string =>
  boxIds
    .flatMap((box) => [
      `${box} (${board[box].length} 件)`,
      ...board[box].flatMap((d) => [
        `- ${linkLine(d)}${d.hot ? " [hot]" : ""}${repostTag(d)}${d.hidden === true ? " [隠した行]" : ""}`,
        ...d.children.map(
          (c) =>
            `  - 子記事 ${linkLine(c)}${c.hot ? " [hot]" : ""}${c.repostChild === true ? " [再掲載]" : ""}`,
        ),
      ]),
    ])
    .join("\n");

export type UpdateRejected = "missing" | "child" | "repost";

export const rejectUpdate = (
  board: Board,
  { id, title, category: box, hot }: DraftUpdate & { id: string },
): UpdateRejected | null => {
  const at = locate(board, id);
  if (at !== null) {
    const d = board[at.box][at.index];
    // 再掲載は送るときにタイトル・HOT を持たないので、変えても保存で黙って消える (specs/018 FR-008)
    const fixed =
      title !== undefined || hot !== undefined || (box !== undefined && d?.children.length === 0);
    return d?.repost !== undefined && fixed ? "repost" : null;
  }
  const link = links(board).find((l) => l.id === id);
  if (link === undefined) {
    return "missing";
  }
  if (box !== undefined || hot !== undefined) {
    return "child";
  }
  return link.repostChild === true && title !== undefined ? "repost" : null;
};

// 取得を待つ間にエージェントや人が入れたタイトルを、後から届いた取得結果で消さない
export const fillTitle = (
  board: Board,
  id: string,
  title: string,
  translation: string | null,
): Board =>
  mapLink(board, id, (l) =>
    l.title === "" && l.initial.title === ""
      ? {
          ...l,
          title: translation ?? title,
          initial: { url: l.initial.url, title },
          translated: translation !== null,
        }
      : l,
  );

interface Entry {
  id: string;
  url: string;
}

export const addUntitled = (board: Board, entries: readonly Entry[]) => {
  let next = board;
  const accepted: Entry[] = [];
  const rejected: { url: string; reason: Rejected }[] = [];
  for (const entry of entries) {
    const added = addDraft(next, entry.url, entry.id, "", null);
    if (typeof added === "string") {
      rejected.push({ url: entry.url, reason: added });
    } else {
      next = added;
      accepted.push(entry);
    }
  }
  return { board: next, accepted, rejected };
};

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
  // 再掲載は親を書き換えないので、ほかの記事の子にできない
  return (
    items[at.index]?.repost === undefined &&
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
  items[at.index - 1] = { ...parent, children: [...parent.children, asChild(draft, parent.hot)] };
  return replaceBox(board, at.box, items);
};

const asChild = (
  { id, url, title, initial, translated, hot, category: saved }: Draft,
  parentHot: boolean,
): Link => ({
  id,
  url,
  title,
  initial,
  translated,
  hot: hot && !parentHot,
  ...(saved !== undefined && { category: saved }),
});

// 子を持つ記事を子にすると孫になり、再掲載と隠した行は記事の親を書き換えられない
export const canLink = (board: Board, id: string) => {
  const at = locate(board, id);
  const d = at === null ? undefined : board[at.box][at.index];
  return d !== undefined && d.repost === undefined && d.hidden !== true && d.children.length === 0;
};

export type LinkBlock = ReturnType<typeof repostBlock> | "has-parent" | "full";

// ボードにある再掲載の親には子を足せる。ほかの形で載っている記事は親にできない
export const linkBlock = (
  board: Board,
  candidate: RepostCandidate,
  entryDate: string,
): LinkBlock => {
  if (candidate.parent !== undefined) {
    return "has-parent";
  }
  const parent = drafts(board).find((d) => d.url === candidate.url);
  if (parent?.repost === undefined) {
    return repostBlock(board, candidate, entryDate);
  }
  return parent.children.length >= MAX_CHILDREN ? "full" : null;
};

export const linkToParent = (
  board: Board,
  childId: string,
  candidate: RepostCandidate,
  parentId: string,
): Board => {
  const at = locate(board, childId);
  const draft = at === null ? undefined : board[at.box][at.index];
  if (at === null || draft === undefined || !canLink(board, childId)) {
    return board;
  }
  const child = asChild(draft, false);
  const without = replaceBox(board, at.box, board[at.box].toSpliced(at.index, 1));
  const existing = drafts(without).find((d) => d.url === candidate.url && d.repost !== undefined);
  if (existing === undefined) {
    const { url, title, category: c, firstPublishedOn } = candidate;
    const parent: Draft = {
      ...savedLink({ id: parentId, url, title, hot: false }),
      suggested: false,
      category: c,
      children: [child],
      repost: { category: c, firstPublishedOn, listed: false },
    };
    return replaceBox(without, at.box, without[at.box].toSpliced(at.index, 0, parent));
  }
  const joined = mapDrafts(without, (d) =>
    d.id === existing.id ? { ...d, children: [...d.children, child] } : d,
  );
  // 投稿のカテゴリは子のカテゴリなので、子のいなかった親は子のいた枠へ移す (specs/018 FR-014)
  return existing.children.length === 0 && isCategory(at.box)
    ? moveToBoxEnd(joined, existing.id, at.box)
    : joined;
};

// 再掲載の子は記事の親の下でしか保存できないので、親だけを外せない
export const canUnlink = (d: Draft) =>
  d.repost?.listed === false && d.children.every((c) => c.repostChild !== true);

export const unlinkParent = (board: Board, id: string): Board | Rejected => {
  const at = locate(board, id);
  const d = at === null ? undefined : board[at.box][at.index];
  if (at === null || d === undefined || !canUnlink(d)) {
    return board;
  }
  if (draftCount(board) - 1 + d.children.length > MAX_DRAFTS) {
    return "limit";
  }
  const freed = d.children.map((c): Draft => ({ ...c, suggested: false, children: [] }));
  return replaceBox(board, at.box, board[at.box].toSpliced(at.index, 1, ...freed));
};

// 子のない再掲載は元のカテゴリに留まるので、載せると枠を移ることがある。移る先を押す前に示すために返す
export const listedHome = (d: Draft, box: BoxId): Category | null =>
  d.repost !== undefined && d.children.length === 0 && d.repost.category !== box
    ? d.repost.category
    : null;

export const setListed = (board: Board, id: string, listed: boolean): Board =>
  mapDrafts(board, (d) =>
    d.id === id && d.repost !== undefined ? { ...d, repost: { ...d.repost, listed } } : d,
  );

export const unmakeChild = (board: Board, parentId: string, childId: string): Board | Rejected => {
  const at = locate(board, parentId);
  const parent = at === null ? undefined : board[at.box][at.index];
  const child = parent?.children.find((c) => c.id === childId);
  // 再掲載の子は記事の親の下でしか保存できない
  if (at === null || parent === undefined || child === undefined || child.repostChild === true) {
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
    { ...child, suggested: false, children: [] },
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

// 枠を移ったかを見て、移した先のカードにフォーカスするために、子の id からも親のカードを引く
// 消す行の代わりに操作を続ける先。下、上、子なら親の順に選び、どれもなければ箱の見出しにする
export const neighborOf = (board: Board, id: string): { draft: string } | { box: BoxId } | null => {
  for (const box of boxIds) {
    const items = board[box];
    const index = items.findIndex((d) => d.id === id);
    if (index !== -1) {
      const next = items[index + 1] ?? items[index - 1];
      return next === undefined ? { box } : { draft: next.id };
    }
    for (const d of items) {
      const i = d.children.findIndex((c) => c.id === id);
      if (i !== -1) {
        return { draft: (d.children[i + 1] ?? d.children[i - 1] ?? d).id };
      }
    }
  }
  return null;
};

export const cardOf = (board: Board, id: string) => {
  for (const box of boxIds) {
    const card = board[box].find((d) => d.id === id || d.children.some((c) => c.id === id));
    if (card !== undefined) {
      return { box, id: card.id };
    }
  }
  return null;
};

export const isBoxId = (id: unknown): id is BoxId => boxIds.some((b) => b === id);
export const isCategory = (box: BoxId): box is Category => box !== UNSORTED;

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
  return replaceBox(without, box, [
    ...without[box],
    at.box === box || !draft.suggested ? draft : { ...draft, suggested: false },
  ]);
};

export interface DraftUpdate {
  title?: string;
  category?: Category;
  hot?: boolean;
}

export const updateDraft = (
  board: Board,
  id: string,
  { title, category: box, hot }: DraftUpdate,
): Board => {
  const titled = title === undefined ? board : mapLink(board, id, (l) => ({ ...l, title }));
  // moveToBoxEnd は箱を移ると印を消すが、エージェントが移したことは人に見せる
  const moved =
    box === undefined
      ? titled
      : mapDrafts(moveToBoxEnd(titled, id, box), (d) =>
          d.id === id ? { ...d, suggested: true } : d,
        );
  return hot === undefined
    ? moved
    : mapDrafts(moved, (d) => (d.id === id ? settleChildHot({ ...d, hot }) : d));
};

export const toIds = (board: Board): Record<BoxId, string[]> =>
  byBox((b) => board[b].map((d) => d.id));

// 中身の変わらない箱は配列の参照を使い回し、箱の memo を効かせる
export const fromIds = (board: Board, ids: Record<BoxId, string[]>): Board => {
  const byId = new Map(boxIds.flatMap((box) => board[box].map((d) => [d.id, { d, box }] as const)));
  return byBox((b) => {
    const next = ids[b];
    if (next.length === board[b].length && next.every((id, i) => board[b][i]?.id === id)) {
      return board[b];
    }
    return next.map((id) => {
      const found = byId.get(id);
      if (found === undefined) {
        throw new Error(`board: unknown draft id "${id}"`);
      }
      return found.box === b || !found.d.suggested ? found.d : { ...found.d, suggested: false };
    });
  });
};

export const blockers = (board: Board): Blocker[] => {
  const out: Blocker[] = [];
  if (category.options.every((c) => board[c].every(isGhost))) {
    out.push({ kind: "empty" });
  }
  const unsorted = board[UNSORTED].filter((d) => !isGhost(d)).length;
  if (unsorted > 0) {
    out.push({ kind: "unsorted", count: unsorted });
  }
  const untitled = links(board).filter((l) => l.title.trim() === "");
  if (untitled.length > 0) {
    out.push({ kind: "untitled", ids: untitled.map((l) => l.id) });
  }
  return out;
};

const savedLink = ({ id, url, title, hot }: Pick<Link, "id" | "url" | "title" | "hot">): Link => ({
  id,
  url,
  title,
  hot,
  initial: { url, title },
  translated: false,
});

export const fromDigest = (digest: Digest): Board => {
  const board = emptyBoard();
  for (const a of digest.articles) {
    // 編集画面の取得は表示しない記事も中身ごと返すので、ここには来ない
    if (a.concealed === true) {
      continue;
    }
    board[a.category].push({
      ...savedLink(a),
      suggested: false,
      category: a.originalCategory ?? a.category,
      ...(a.repost && a.originalStatus !== "published" && { unpublished: true }),
      // 親が HOT の子は保存時に HOT にそろうので、子自身の HOT ではない
      children: a.children.map((c) => ({
        ...savedLink({ ...c, hot: c.hot && !a.hot }),
        category: c.category,
        ...(c.repost && { repostChild: true as const }),
        ...(c.repost && c.originalStatus !== "published" && { unpublished: true as const }),
        ...(c.hidden && { hidden: true as const }),
      })),
      ...(a.hidden && { hidden: true }),
      ...(a.repost && {
        repost: {
          category: a.originalCategory ?? a.category,
          ...(a.firstPublishedOn !== undefined && { firstPublishedOn: a.firstPublishedOn }),
          listed: a.listed,
        },
      }),
    });
  }
  return board;
};

// 投稿のカテゴリを書き換えられない行の枠。子のない再掲載は記事のカテゴリ、先頭の子が再掲載の再掲載はその子のカテゴリ
const pinnedBox = (d: Draft): Category | undefined => {
  if (d.repost === undefined) {
    return undefined;
  }
  const [first] = d.children;
  if (first === undefined) {
    // 幽霊の親は送らないので、カテゴリに留めなくてよい
    return d.repost.listed ? d.repost.category : undefined;
  }
  return first.repostChild === true ? first.category : undefined;
};

// 外れた箱から戻す
export const pinReposts = (board: Board): Board => {
  let next = board;
  for (const box of boxIds) {
    for (const d of board[box]) {
      const home = pinnedBox(d);
      if (home !== undefined && home !== box) {
        next = moveToBoxEnd(next, d.id, home);
      }
    }
  }
  return next;
};

// firstPublishedOn は公開の掲載のいちばん古い日なので、日付より前でなければ前の公開の掲載もない (specs/018 FR-005)
export const repostBlock = (
  board: Board,
  candidate: RepostCandidate,
  entryDate: string,
): "not-before" | "on-board" | null => {
  if (candidate.firstPublishedOn >= entryDate) {
    return "not-before";
  }
  return findDuplicate(board, candidate.url) ? "on-board" : null;
};

// 紐付けは親を上限に数えないので、上限は足すときだけ見る
export const repostAddBlock = (
  board: Board,
  candidate: RepostCandidate,
  entryDate: string,
): ReturnType<typeof repostBlock> | "limit" =>
  repostBlock(board, candidate, entryDate) ?? (draftCount(board) >= MAX_DRAFTS ? "limit" : null);

// 子の候補も単独の行にする。保存後に読むと元の親が呼び出される (specs/018 FR-004)
export const addRepost = (board: Board, candidate: RepostCandidate, id: string): Board => {
  // ピッカーが今のボードで選べない候補を弾くので、ここで断られるのは判定と押下の間にボードが変わったときだけ
  if (rejectAdd(board, candidate.url) !== null) {
    return board;
  }
  const { url, title, category: c, firstPublishedOn } = candidate;
  const draft: Draft = {
    ...savedLink({ id, url, title, hot: false }),
    suggested: false,
    category: c,
    children: [],
    repost: { category: c, firstPublishedOn, listed: true },
  };
  return replaceBox(board, c, [...board[c], draft]);
};

export const convertToReposts = (board: Board, repostable: readonly Repostable[]): Board => {
  const byUrl = new Map(repostable.map((r) => [r.url, r]));
  return pinReposts(
    mapDrafts(board, (d) => {
      const r = byUrl.get(d.url);
      return r === undefined
        ? d
        : {
            ...d,
            title: r.title,
            hot: false,
            category: r.category,
            repost: { category: r.category, firstPublishedOn: r.firstPublishedOn, listed: true },
          };
    }),
  );
};

// 外したのに消せなかった親を、隠した行として戻す。外す前の行があれば、その枠・位置・HOT のまま戻す
export const restoreHidden = (
  board: Board,
  hideable: readonly Hideable[],
  before: Board,
): Board => {
  let next = board;
  for (const h of hideable) {
    if (findDuplicate(next, h.url)) {
      next = mapDrafts(next, (d) => (d.url === h.url ? { ...d, hidden: true } : d));
      continue;
    }
    const box = boxIds.find((b) => before[b].some((d) => d.url === h.url)) ?? h.category;
    const index = before[box].findIndex((d) => d.url === h.url);
    const old = before[box][index];
    const draft: Draft = {
      ...(old ?? {
        ...savedLink({ id: `hidden:${h.url}`, url: h.url, title: h.title, hot: false }),
        suggested: false,
        category: h.category,
      }),
      // 子はこの保存で外したか、ほかの日に載っているので連れ戻さない
      children: [],
      hidden: true,
    };
    next = replaceBox(
      next,
      box,
      next[box].toSpliced(index === -1 ? next[box].length : index, 0, draft),
    );
  }
  return next;
};

export const unhide = (board: Board, id: string): Board =>
  mapDrafts(board, (d) => {
    if (d.id !== id) {
      return d;
    }
    const { hidden: _, ...rest } = d;
    return rest;
  });

const toChildEntry = (ch: Link): ChildEntry =>
  ch.repostChild === true
    ? { repostOf: ch.url, hot: ch.hot }
    : { title: ch.title, url: ch.url, hot: ch.hot };

const toEntry = (d: Draft, c: Category): DigestEntry => {
  const children = d.children.map(toChildEntry);
  return d.repost === undefined
    ? { category: c, hot: d.hot, hidden: d.hidden === true, title: d.title, url: d.url, children }
    : { repostOf: d.url, category: c, listed: d.repost.listed, children };
};

export const toNewDigest = (board: Board, entryDate: string): DigestContent => ({
  entryDate,
  articles: category.options.flatMap((c) =>
    board[c].filter((d) => !isGhost(d)).map((d) => toEntry(d, c)),
  ),
});

// 公開ページと同じく、隠した行と公開されない記事は出さない
export const toPreview = (board: Board, entryDate: string): DraftDigest => ({
  entryDate,
  articles: category.options.flatMap((c) =>
    board[c].flatMap((d): DraftDigest["articles"] => {
      if (isGhost(d)) {
        return [];
      }
      const children = d.children
        .filter((ch) => ch.unpublished !== true && ch.hidden !== true)
        .map(({ title, url, hot }) => ({ title, url, hot }));
      if (d.hidden === true || d.unpublished === true) {
        return children.length > 0 || d.repost !== undefined
          ? [{ concealed: true, category: c, children }]
          : [];
      }
      return [
        {
          category: c,
          hot: d.repost === undefined && d.hot,
          repost: d.repost !== undefined,
          title: d.title,
          url: d.url,
          ...(d.repost?.firstPublishedOn !== undefined && {
            firstPublishedOn: d.repost.firstPublishedOn,
          }),
          children,
        },
      ];
    }),
  ),
});
