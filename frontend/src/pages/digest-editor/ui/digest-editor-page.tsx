import { getRouteApi, isNotFound, useBlocker } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useId, useReducer, useRef, useState, useSyncExternalStore } from "react";
import type { SetStateAction } from "react";
import { Button } from "react-aria-components";
import { category } from "#/shared/api";
import type { DigestContent, DigestStatus } from "#/shared/api";
import { createDigest } from "../api/create-digest";
import type { Rejection } from "../api/rejection-of";
import { updateDigest } from "../api/update-digest";
import {
  addRepost,
  blockers,
  canMakeChild,
  convertToReposts,
  draftCount,
  editLink,
  emptyBoard,
  fromDigest,
  hasDrafts,
  makeChild,
  MAX_DRAFTS,
  moveChild,
  pinReposts,
  remove,
  restoreHidden,
  revert,
  toggleHot,
  toNewDigest,
  toPreview,
  unhide,
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
import type { CardActions } from "./draft-card";
import { PreviewDialog } from "./preview-dialog";
import { RepostAdd } from "./repost-picker";
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

const RowRejections = ({
  registeredLeft,
  unavailableLeft,
}: {
  registeredLeft: number;
  unavailableLeft: number;
}) => (
  <>
    {registeredLeft > 0 && (
      <p className={styles.error} role="alert">
        登録済みの記事が含まれてます。削除してください
      </p>
    )}
    {unavailableLeft > 0 && (
      <p className={styles.error} role="alert">
        再掲載できない記事が含まれてます。削除してください
      </p>
    )}
  </>
);

interface FormProps<S extends DigestStatus> {
  heading: string;
  initialDate?: string;
  initialBoard: Board;
  // 先頭が既定。▼ で選んでも保存はせず、主ボタンの中身を替えるだけにして押し間違いで公開しないようにする
  saveActions: readonly [SaveAction<S>, ...SaveAction<S>[]];
  submitLabel: string;
  leaveMessage: string;
  save: (entry: DigestContent, status: S) => Promise<Rejection>;
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
  const [submitError, setSubmitError] = useState<string>();
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
  // 外せずに隠した行へ戻した件数。次に保存するまで案内を出す
  const [restored, setRestored] = useState(0);
  const [previewing, setPreviewing] = useState(false);
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
  const parentUrls = entry.articles.map((a) => ("repostOf" in a ? a.repostOf : a.url));
  const childUrls = entry.articles.flatMap((a) =>
    a.children.map((c) => ("repostOf" in c ? c.repostOf : c.url)),
  );
  const registeredLeft = [...parentUrls, ...childUrls].filter((u) => registered.has(u)).length;
  const unavailableLeft = parentUrls.filter((u) => unavailable.has(u)).length;
  const dateError =
    entryDate !== "" && entryDate === dateRejection?.entryDate ? dateRejection.reason : undefined;
  useBlocker({
    // oxlint-disable-next-line eslint/no-alert -- 確認はこの画面の 2 か所だけで、管理者 1 名の画面なので専用のダイアログは作らない
    shouldBlockFn: () => !window.confirm(leaveMessage),
    enableBeforeUnload: dirty,
    disabled: !dirty,
  });

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
        setBoard(remove(board, id));
      }
    },
    canMakeChild: (id) => canMakeChild(board, id),
    makeChild: (id) => {
      setBoard(makeChild(board, id));
    },
    unmakeChild: (parentId, childId) => {
      apply(unmakeChild(board, parentId, childId));
    },
    moveChild: (parentId, childId, step) => {
      setBoard(moveChild(board, parentId, childId, step));
    },
    unhide: (id) => {
      setBoard(unhide(board, id));
    },
  };

  const onSubmit = async (status: S) => {
    setSubmitting(true);
    setSubmitError(undefined);
    setRestored(0);
    try {
      // navigate は呼ばない。成功時はサーバー関数が redirect を投げ、Router が遷移する
      const rejected = await save(entry, status);
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
      }
      if (rejected.reason === "parent-has-children") {
        // 自動では保存し直さず、戻した行を見てから保存してもらう
        setBoard((b) => restoreHidden(b, rejected.hideable, initialBoard));
        setRestored(rejected.hideable.length);
      }
      if (rejected.reason === "digest-already-exists" || rejected.reason === "future-publish") {
        setDateRejection({ entryDate: entry.entryDate, reason: rejected.reason });
      }
      setSubmitting(false);
    } catch (error) {
      setSubmitError(
        isNotFound(error)
          ? `ログインが切れました。別のタブでログインし直してから、もう一度${submitLabel}してください`
          : `${submitLabel}できませんでした。時間をおいてもう一度試してください`,
      );
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
            {submitError !== undefined && <p className={styles.message}>{submitError}</p>}
            {dateError !== undefined && (
              <p className={styles.error} role="alert">
                {dateErrorText[dateError]}
              </p>
            )}
            <RowRejections registeredLeft={registeredLeft} unavailableLeft={unavailableLeft} />
            {restored > 0 && (
              <p className={styles.error} role="alert">
                子がほかの日にいる記事は外せないので、隠した行に戻しました。確かめてから保存してください
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
              apply(addRepost(board, c, crypto.randomUUID()));
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

const newRoute = getRouteApi("/_shell/admin/digests/new");

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

const editRoute = getRouteApi("/_shell/admin/digests/$date/edit");

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
