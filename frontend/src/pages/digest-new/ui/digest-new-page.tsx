import { DragDropProvider } from "@dnd-kit/react";
import { move } from "@dnd-kit/helpers";
import { isNotFound, useBlocker } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useId, useRef, useState, useSyncExternalStore } from "react";
// barrel (#/shared/api) は .server.ts を再 export しており、クライアントで走るコードから import すると build が落ちる
import { category, newChildArticle } from "#/shared/api/schemas";
import { createDigest } from "../api/create-digest";
import { fetchDraftTitle } from "../api/fetch-draft-title";
import {
  addDraft,
  blockers,
  canMakeChild,
  draftCount,
  editLink,
  emptyBoard,
  fromIds,
  hasDrafts,
  isBoxId,
  makeChild,
  MAX_DRAFTS,
  moveChild,
  moveToBoxEnd,
  remove,
  revert,
  settleTitle,
  toggleHot,
  toIds,
  toNewDigest,
  unmakeChild,
  UNSORTED,
} from "../model/board";
import type { Blocker, Board, BoxId, Rejected } from "../model/board";
import { plugins } from "./announcements";
import { Box } from "./box";
import { DraftCard } from "./draft-card";
import type { CardActions } from "./draft-card";
import styles from "./digest-new-page.module.css";

// toISOString は UTC 日付になり JST の 0〜9 時に前日を返す。sv-SE ロケールはローカル日付を YYYY-MM-DD で出す
const today = () => new Date().toLocaleDateString("sv-SE");
// 購読元はないので解除も何もしない
const noop = () => {
  /* 何もしない */
};
const subscribeNever = () => noop;

const rejectedText: Record<Rejected, string> = {
  duplicate: "その URL はもう入ってます",
  limit: `記事は ${MAX_DRAFTS} 件までです`,
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
    case "loading": {
      return "タイトルを取得してます";
    }
    default: {
      return b satisfies never;
    }
  }
};

export const DigestNewPage = () => {
  const submit = useServerFn(createDigest);
  const getTitle = useServerFn(fetchDraftTitle);
  // SSR のサーバー TZ とブラウザの日付がずれると hydration 不一致になるので、既定値はクライアントでだけ決める
  const defaultDate = useSyncExternalStore(subscribeNever, today, () => "");
  const [editedDate, setEditedDate] = useState<string>();
  const entryDate = editedDate ?? defaultDate;
  const [board, setBoard] = useState<Board>(emptyBoard);
  const [url, setUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string>();
  // Esc でドラッグをやめたとき、ドラッグ中に組み替えた並びを戻す
  const beforeDrag = useRef<Board>(undefined);
  const urlInput = useRef<HTMLInputElement>(null);
  const blockersId = useId();

  const dirty = hasDrafts(board) && !submitting;
  useBlocker({
    // oxlint-disable-next-line eslint/no-alert -- 確認はこの画面の 2 か所だけで、管理者 1 名の画面なので専用のダイアログは作らない
    shouldBlockFn: () => !window.confirm("登録してない記事があります。このページを離れますか？"),
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
  };

  const onAdd = async () => {
    if (!newChildArticle.shape.url.safeParse(url).success) {
      setAddError("http か https の URL を入れてください");
      return;
    }
    const id = crypto.randomUUID();
    const added = addDraft(board, url, id);
    if (typeof added === "string") {
      setAddError(rejectedText[added]);
      return;
    }
    setBoard(added);
    setUrl("");
    setAddError(undefined);
    setAdding(true);
    let title: string | null = null;
    try {
      ({ title } = await getTitle({ data: url }));
    } catch {
      // 取れなかったときはタイトル空の候補として残し、手で入れてもらう
    }
    // 取得を待つ間に他の操作で board が変わっているので、最新の state に反映する
    setBoard((b) => settleTitle(b, id, title));
    setAdding(false);
    urlInput.current?.focus();
  };

  const onSubmit = async () => {
    setSubmitting(true);
    setSubmitError(undefined);
    try {
      // navigate は呼ばない。成功時はサーバー関数が redirect を投げ、Router が / へ遷移する
      await submit({ data: toNewDigest(board, entryDate) });
    } catch (error) {
      setSubmitError(
        isNotFound(error)
          ? "ログインが切れました。別のタブでログインし直してから、もう一度登録してください"
          : "登録できませんでした。同じ URL が重複していないか確認してください",
      );
      setSubmitting(false);
    }
  };

  const reasons = blockers(board);
  const renderBox = (box: BoxId) => (
    <Box key={box} count={board[box].length} id={box}>
      {board[box].map((draft, i) => (
        <DraftCard key={draft.id} actions={actions} box={box} draft={draft} index={i} />
      ))}
    </Box>
  );

  return (
    <div className={styles.page}>
      <DragDropProvider
        plugins={plugins}
        onDragEnd={(e) => {
          if (e.canceled && beforeDrag.current !== undefined) {
            setBoard(beforeDrag.current);
          }
          beforeDrag.current = undefined;
        }}
        onDragOver={(e) => {
          const { source, target } = e.operation;
          if (source !== null && target !== null && isBoxId(target.id)) {
            setBoard(moveToBoxEnd(board, String(source.id), target.id));
            return;
          }
          const ids = toIds(board);
          const next = move(ids, e);
          // ポインター移動の大半は並びが変わらないので、ここで打ち切って再描画を避ける
          if (next !== ids) {
            setBoard(fromIds(board, next));
          }
        }}
        onDragStart={() => {
          beforeDrag.current = board;
        }}
      >
        <div className={styles.collect}>
          <h1 className={styles.heading}>記事を登録</h1>
          <label className={styles.date}>
            <span className={styles.label}>日付</span>
            <input
              className={styles.input}
              required
              type="date"
              value={entryDate}
              onChange={(e) => {
                setEditedDate(e.target.value);
              }}
            />
          </label>
          <form
            className={styles.add}
            onSubmit={(e) => {
              e.preventDefault();
              void onAdd();
            }}
          >
            <input
              ref={urlInput}
              aria-label="記事の URL"
              className={styles.urlInput}
              disabled={adding}
              maxLength={2000}
              placeholder="https://example.com/article"
              required
              type="url"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
              }}
            />
            <button className={styles.button} disabled={adding} type="submit">
              {adding ? "取得中" : "追加"}
            </button>
          </form>
          {addError !== undefined && <p className={styles.message}>{addError}</p>}
          {renderBox(UNSORTED)}
          <div className={styles.submit}>
            {reasons.length > 0 && (
              <p className={styles.message} id={blockersId}>
                {reasons.map(blockerText).join("。")}
              </p>
            )}
            <button
              aria-describedby={reasons.length > 0 ? blockersId : undefined}
              className={styles.primary}
              disabled={reasons.length > 0 || submitting || entryDate === ""}
              type="button"
              onClick={() => {
                void onSubmit();
              }}
            >
              登録
            </button>
            {submitError !== undefined && <p className={styles.message}>{submitError}</p>}
          </div>
        </div>
        <div className={styles.shelf}>{category.options.map(renderBox)}</div>
      </DragDropProvider>
    </div>
  );
};
