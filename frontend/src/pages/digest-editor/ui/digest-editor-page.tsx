import { getRouteApi, useBlocker } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useId, useReducer, useRef, useState, useSyncExternalStore } from "react";
import type { SetStateAction } from "react";
import { Button } from "react-aria-components";
import { category } from "#/shared/api";
import { toast } from "#/shared/ui/toast";
import type { DigestContent, DigestStatus } from "#/shared/api";
import { createDigest } from "../api/create-digest";
import type { Rejection } from "../api/rejection-of";
import { updateDigest } from "../api/update-digest";
import {
  addRepost,
  blockers,
  canLink,
  canMakeChild,
  boxOf,
  convertToReposts,
  draftCount,
  editLink,
  emptyBoard,
  fromDigest,
  hasDrafts,
  linkBlock,
  linkToParent,
  makeChild,
  MAX_DRAFTS,
  moveChild,
  pinReposts,
  remove,
  restoreHidden,
  revert,
  setListed,
  successorOf,
  toggleHot,
  toNewDigest,
  toPreview,
  unhide,
  unlinkParent,
  unmakeChild,
  UNSORTED,
} from "../model/board";
import type { Blocker, Board, BoxId, Rejected } from "../model/board";
import { useArticleTools } from "../model/article-tools";
import { AiSortingStatus } from "./ai-sorting-status";
import { BoardDragDrop } from "./board-drag-drop";
import { Box } from "./box";
import { DateField } from "./date-field";
import { DraftCard } from "./draft-card";
import { failureMessage } from "./failure-message";
import type { CardActions } from "./draft-card";
import { PreviewDialog } from "./preview-dialog";
import { RepostAdd, RepostPicker } from "./repost-picker";
import { SaveSplitButton } from "./save-split-button";
import { TodayTakenDialog } from "./today-taken-dialog";
import type { SaveAction } from "./save-split-button";
import { UrlAddForm } from "./url-add-form";
import styles from "./digest-editor-page.module.css";

// toISOString は UTC 日付になり JST の 0〜9 時に前日を返す。sv-SE ロケールはローカル日付を YYYY-MM-DD で出す
const today = () => new Date().toLocaleDateString("sv-SE");
// 購読元はないので解除も何もしない
const noop = () => {
  /* 何もしない */
};
const subscribeNever = () => noop;

// メニューを開いたボタンが組み替えで消えると、RAC の Menu はフォーカスを戻す先がなく body に落ちる
const focusOn = (to: { draft: string } | { box: BoxId } | null, scroll = false) => {
  // メニューが閉じてフォーカスを戻し終えてから移す
  requestAnimationFrame(() => {
    const el =
      to === null
        ? null
        : document.querySelector<HTMLElement>(
            "draft" in to
              ? `[data-draft-id="${CSS.escape(to.draft)}"] > div [data-card-menu]`
              : `[data-box="${CSS.escape(to.box)}"] button`,
          );
    el?.focus();
    // 移った先が画面の外の枠だと、カードが消えたように見える
    if (scroll) {
      el?.scrollIntoView({ block: "center" });
    }
  });
};

const blockerText = (b: Blocker) => {
  switch (b.kind) {
    case "empty": {
      return "カテゴリに記事を入れると登録できます";
    }
    case "unsorted": {
      return `未分類が ${b.count} 件残ってます`;
    }
    case "untitled": {
      return `タイトルが空の記事が ${b.ids.length} 件あります`;
    }
    default: {
      return b satisfies never;
    }
  }
};

const dateErrorText = {
  "digest-already-exists": "その日の Digest は登録済みです。日付を変えてください",
  "future-publish": "未来の日付は公開できないです。日付を直すか、下書きで保存してください",
} as const;

// どの行かは行の印で示すので、トーストは直し方だけを伝える
const rejectionText = (
  reason: "url-already-registered" | "repost-unavailable",
  leftToRemove: boolean,
) => {
  if (reason === "repost-unavailable") {
    return "再掲載できない記事が含まれてます。印の付いた記事を削除してください";
  }
  return leftToRemove
    ? "登録済みの記事が含まれてます。印の付いた記事を削除してください"
    : "登録済みの記事を再掲載に切り替えました。確かめてから保存してください";
};

interface FormProps<S extends DigestStatus> {
  heading: string;
  initialDate?: string;
  initialBoard: Board;
  // 先頭が既定。▼ で選んでも保存はせず、主ボタンの中身を替えるだけにして押し間違いで公開しないようにする
  saveActions: readonly [SaveAction<S>, ...SaveAction<S>[]];
  submitLabel: string;
  leaveMessage: string;
  save: (entry: DigestContent, status: S) => Promise<Rejection | undefined>;
  isDirty: (entry: DigestContent, board: Board) => boolean;
  taken: ReadonlySet<string>;
}

const DigestForm = <S extends DigestStatus>({
  heading,
  initialDate,
  initialBoard,
  saveActions,
  submitLabel,
  leaveMessage,
  save,
  isDirty,
  taken,
}: FormProps<S>) => {
  // SSR のサーバー TZ とブラウザの日付がずれると hydration 不一致になるので、既定値はクライアントでだけ決める
  const defaultDate = useSyncExternalStore(subscribeNever, today, () => "");
  const [editedDate, setEditedDate] = useState<string>();
  const entryDate = editedDate ?? initialDate ?? defaultDate;
  // ドラッグ・削除・エージェントのどれで動いても、子のない再掲載を元のカテゴリに留める。
  // ドラッグの途中で戻すと dnd-kit の並びとずれるので、途中の並びだけはそのまま置き、終わりで戻す
  const [board, setBoard] = useReducer(
    (b: Board, next: SetStateAction<Board> | { dragging: Board }) =>
      typeof next !== "function" && "dragging" in next
        ? next.dragging
        : pinReposts(typeof next === "function" ? next(b) : next),
    initialBoard,
  );
  // URL を続けて足すと推定が重なるので、件数で持つ
  const [suggesting, setSuggesting] = useState(0);
  // エージェントは取得の途中でも続けて足せるので、件数で持つ
  const [addingCount, setAddingCount] = useState(0);
  const adding = addingCount > 0;
  const [submitting, setSubmitting] = useState(false);
  // 直前に断られた理由ごとの URL。外すか直せば印も消え、断られるたびに入れ替える
  const [rowRejection, setRowRejection] = useState<
    Pick<CardActions, "registered" | "converted" | "unavailable">
  >({ registered: new Set(), converted: new Set(), unavailable: new Set() });
  const { registered, converted, unavailable } = rowRejection;
  // 日付で断られた理由。日付を変えれば印も消える
  const [dateRejection, setDateRejection] = useState<{
    entryDate: string;
    reason: "digest-already-exists" | "future-publish";
  }>();
  const [previewing, setPreviewing] = useState(false);
  const [linking, setLinking] = useState<string>();
  const blockersId = useId();
  const header = useRef<HTMLElement>(null);
  useArticleTools({ board, setBoard, setSuggesting, setAdding: setAddingCount });

  // 登録できない理由とエラーで高さが変わるので、下の面を留める位置を CSS だけでは決められない
  useEffect(() => {
    const el = header.current;
    const observer = new ResizeObserver(() => {
      el?.parentElement?.style.setProperty("--page-header-height", `${el.offsetHeight}px`);
    });
    if (el !== null) {
      observer.observe(el);
    }
    return () => {
      observer.disconnect();
    };
  }, []);

  const entry = toNewDigest(board, entryDate);
  const dirty = isDirty(entry, board) && !submitting;
  const dateError =
    entryDate !== "" && entryDate === dateRejection?.entryDate ? dateRejection.reason : undefined;
  useBlocker({
    // oxlint-disable-next-line eslint/no-alert -- 確認はこの画面の 2 か所だけで、管理者 1 名の画面なので専用のダイアログは作らない
    shouldBlockFn: () => !window.confirm(leaveMessage),
    enableBeforeUnload: dirty,
    disabled: !dirty,
  });

  const follow = (next: Board, id: string) => {
    focusOn({ draft: id }, boxOf(next, id) !== boxOf(board, id));
  };
  // 選んだ後もピッカーはフェードアウトの間開いていて、閉じきる前に移しても中へ引き戻される
  const afterPick = useRef<() => void>(undefined);

  const apply = (next: Board | Rejected): Rejected | null => {
    if (typeof next === "string") {
      return next;
    }
    setBoard(next);
    return null;
  };

  const actions: CardActions = {
    atLimit: draftCount(board) >= MAX_DRAFTS,
    registered,
    converted,
    unavailable,
    edit: (id, next) => apply(editLink(board, id, next)),
    revert: (id) => {
      setBoard(revert(board, id));
    },
    toggleHot: (id) => {
      setBoard(toggleHot(board, id));
    },
    remove: (id, childCount) => {
      const message = `関連記事 ${childCount} 件も消えます。削除しますか？`;
      // oxlint-disable-next-line eslint/no-alert -- 上の useBlocker と同じ理由
      if (childCount === 0 || window.confirm(message)) {
        const next = remove(board, id);
        setBoard(next);
        focusOn(successorOf(board, next, id));
      }
    },
    canMakeChild: (id) => canMakeChild(board, id),
    makeChild: (id) => {
      setBoard(makeChild(board, id));
      focusOn({ draft: id });
    },
    unmakeChild: (parentId, childId) => {
      if (apply(unmakeChild(board, parentId, childId)) === null) {
        focusOn({ draft: childId });
      }
    },
    moveChild: (parentId, childId, step) => {
      setBoard(moveChild(board, parentId, childId, step));
    },
    unhide: (id) => {
      setBoard(unhide(board, id));
    },
    canLink: (id) => entryDate !== "" && canLink(board, id),
    startLink: setLinking,
    unlink: (id) => {
      const next = unlinkParent(board, id);
      if (typeof next !== "string") {
        setBoard(next);
        focusOn(successorOf(board, next, id));
      }
    },
    setListed: (id, listed) => {
      const next = pinReposts(setListed(board, id, listed));
      setBoard(next);
      follow(next, id);
    },
  };

  const onSubmit = async (status: S) => {
    setSubmitting(true);
    try {
      // navigate は呼ばない。成功時はサーバー関数が redirect を投げ、Router が遷移する
      const rejected = await save(entry, status);
      // useServerFn は redirect を遷移に替え、遷移し終えると undefined を返す
      if (rejected === undefined) {
        toast.success(`${submitLabel}しました`);
        return;
      }
      // 日付で断られたときは URL を確かめる前に止まっているので、前の行の印を残す
      if ("duplicateUrls" in rejected) {
        const repostable = rejected.reason === "url-already-registered" ? rejected.repostable : [];
        const repostableUrls = new Set(repostable.map((r) => r.url));
        setRowRejection({
          registered: new Set(
            rejected.reason === "url-already-registered"
              ? rejected.duplicateUrls.filter((u) => !repostableUrls.has(u))
              : [],
          ),
          converted: repostableUrls,
          unavailable: new Set(
            rejected.reason === "repost-unavailable" ? rejected.duplicateUrls : [],
          ),
        });
        // 自動では保存し直さず、切り替えた行を見てから保存してもらう
        setBoard((b) => convertToReposts(b, repostable));
        toast.error(
          rejectionText(rejected.reason, repostable.length < rejected.duplicateUrls.length),
        );
      }
      if (rejected.reason === "parent-has-children") {
        // 自動では保存し直さず、戻した行を見てから保存してもらう
        setBoard((b) => restoreHidden(b, rejected.hideable, initialBoard));
        toast.error(
          "子がほかの日にいる記事は外せないので、隠した行に戻しました。確かめてから保存してください",
        );
      }
      if (rejected.reason === "digest-already-exists" || rejected.reason === "future-publish") {
        setDateRejection({ entryDate: entry.entryDate, reason: rejected.reason });
        toast.error(dateErrorText[rejected.reason]);
      }
      setSubmitting(false);
    } catch (error) {
      toast.error(failureMessage(error, submitLabel));
      setSubmitting(false);
    }
  };

  const reasons = blockers(board);
  const cannotSave = reasons.length > 0 || adding || submitting || entryDate === "";
  const renderBox = (box: BoxId) => (
    <Box key={box} count={board[box].length} id={box}>
      {board[box].map((draft, i) => (
        <DraftCard key={draft.id} actions={actions} box={box} draft={draft} index={i} />
      ))}
    </Box>
  );

  return (
    <div className={styles.page}>
      <header ref={header} className={styles.header}>
        <div className={styles.title}>
          <h1 className={styles.heading}>{heading}</h1>
          <DateField
            invalid={dateError !== undefined}
            taken={taken}
            value={entryDate}
            onChange={setEditedDate}
          />
          <AiSortingStatus active={suggesting > 0} />
        </div>
        <div className={styles.submit}>
          <div className={styles.messages}>
            {reasons.length > 0 && (
              <p className={styles.message} id={blockersId}>
                {reasons.map(blockerText).join("。")}
              </p>
            )}
          </div>
          <Button
            className={styles.button}
            isDisabled={entry.articles.length === 0 || entryDate === ""}
            onPress={() => {
              setPreviewing(true);
            }}
          >
            プレビュー
          </Button>
          <SaveSplitButton
            describedBy={reasons.length > 0 ? blockersId : undefined}
            disabled={cannotSave}
            saveActions={saveActions}
            submitLabel={submitLabel}
            onSave={(status) => {
              void onSubmit(status);
            }}
          />
        </div>
      </header>
      {editedDate === undefined && initialDate === undefined && taken.has(defaultDate) && (
        <TodayTakenDialog
          date={defaultDate}
          onClose={() => {
            setEditedDate("");
          }}
        />
      )}
      {linking !== undefined && (
        <RepostPicker
          block={linkBlock}
          board={board}
          entryDate={entryDate}
          heading="掲載済みの記事に紐付ける"
          onClose={() => {
            setLinking(undefined);
            afterPick.current?.();
            afterPick.current = undefined;
          }}
          onPick={(c) => {
            const parentId = crypto.randomUUID();
            const link = (b: Board) => linkToParent(b, linking, c, parentId);
            // 開いている間にエージェントが変えたボードを、開いたときのボードで上書きしない
            setBoard(link);
            const next = pinReposts(link(board));
            afterPick.current = () => {
              follow(next, linking);
            };
          }}
        />
      )}
      {previewing && (
        <PreviewDialog
          digest={toPreview(board, entryDate)}
          onClose={() => {
            setPreviewing(false);
          }}
        />
      )}
      <BoardDragDrop
        board={board}
        onChange={setBoard}
        onDrag={(dragging) => {
          setBoard({ dragging });
        }}
      >
        <div className={styles.collect}>
          <UrlAddForm
            adding={adding}
            board={board}
            setAdding={setAddingCount}
            setBoard={setBoard}
            setSuggesting={setSuggesting}
          />
          <RepostAdd
            atLimit={actions.atLimit}
            board={board}
            entryDate={entryDate}
            onPick={(c) => {
              const id = crypto.randomUUID();
              // 開いている間に推定・取得・エージェントが変えたボードを、開いたときのボードで上書きしない
              setBoard((b) => addRepost(b, c, id));
            }}
          />
          {renderBox(UNSORTED)}
        </div>
        <div className={styles.shelf}>{category.options.map(renderBox)}</div>
      </BoardDragDrop>
    </div>
  );
};

// 下書きへは戻せないので、公開した後のメニューに下書きを出さない (specs/006 FR-008)
const editActions = {
  draft: [
    { label: "下書きのまま保存", status: "draft" },
    { label: "公開して保存", status: "published" },
    { label: "非公開にして保存", status: "private" },
  ],
  published: [
    { label: "公開のまま保存", status: "published" },
    { label: "非公開にして保存", status: "private" },
  ],
  private: [
    { label: "非公開のまま保存", status: "private" },
    { label: "公開して保存", status: "published" },
  ],
} as const satisfies Record<
  DigestStatus,
  readonly [SaveAction<DigestStatus>, ...SaveAction<DigestStatus>[]]
>;

const newRoute = getRouteApi("/_shell/_admin/admin/digests/new");

export const DigestNewPage = () => {
  const { digests } = newRoute.useLoaderData();
  const create = useServerFn(createDigest);
  return (
    <DigestForm
      heading="記事を登録"
      initialBoard={emptyBoard()}
      isDirty={(_, board) => hasDrafts(board)}
      leaveMessage="登録してない記事があります。このページを離れますか？"
      save={async (entry, status) => await create({ data: { ...entry, status } })}
      saveActions={[
        { label: "下書きで登録", status: "draft" },
        { label: "公開して登録", status: "published" },
      ]}
      submitLabel="登録"
      taken={new Set(digests.map((d) => d.entryDate))}
    />
  );
};

const editRoute = getRouteApi("/_shell/_admin/admin/digests/$date/edit");

export const DigestEditPage = () => {
  const { digest, list } = editRoute.useLoaderData();
  const update = useServerFn(updateDigest);
  // 編集中の Digest 自身の日付は、そのまま保存できるので選べるようにする
  const taken = new Set(list.digests.map((d) => d.entryDate).filter((d) => d !== digest.entryDate));
  const saved = JSON.stringify(toNewDigest(fromDigest(digest), digest.entryDate));
  return (
    // 別の日付の編集画面へ移っても同じ component が使い回されるので、state を Digest ごとに作り直す
    <DigestForm
      key={digest.id}
      heading="記事を編集"
      initialBoard={fromDigest(digest)}
      initialDate={digest.entryDate}
      isDirty={(entry) => JSON.stringify(entry) !== saved}
      leaveMessage="保存してない変更があります。このページを離れますか？"
      save={async (entry, status) =>
        await update({
          data: {
            date: digest.entryDate,
            // 変えないときは送らず、backend に今のステータスを保たせる (draft は送れない)
            digest: status === digest.status || status === "draft" ? entry : { ...entry, status },
          },
        })
      }
      saveActions={editActions[digest.status]}
      submitLabel="保存"
      taken={taken}
    />
  );
};
