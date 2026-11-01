import { DragDropProvider } from "@dnd-kit/react";
import { move } from "@dnd-kit/helpers";
import { getRouteApi, isNotFound, useBlocker } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { lazy, Suspense, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
// barrel (#/shared/api) は .server.ts を再 export しており、クライアントで走るコードから import すると build が落ちる
import { category, newChildArticle } from "#/shared/api/schemas";
import type { NewDigest } from "#/shared/api/schemas";
import { DigestPost } from "#/shared/ui/digest-post";
import { HoverButton } from "#/shared/ui/hover-button";
import { calendarIcon } from "#/shared/ui/icons/calendar";
import { clipboardIcon } from "#/shared/ui/icons/clipboard";
import { afterFadeOut } from "#/shared/ui/modal";
import { createDigest } from "../api/create-digest";
import { fetchDraftPreview } from "../api/fetch-draft-preview";
import { loadDraftPreview } from "../api/load-draft-preview";
import type { Rejection } from "../api/rejection-of";
import { updateDigest } from "../api/update-digest";
import {
  addDraft,
  blockers,
  canMakeChild,
  draftCount,
  editLink,
  emptyBoard,
  fromDigest,
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
  stripTracking,
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

// Temporal の polyfill が重いので、カレンダーを開くまで読まない
const DatePickerDialog = lazy(async () => {
  const { DatePickerDialog: Picker } = await import("#/shared/ui/date-picker");
  return { default: Picker };
});

// toISOString は UTC 日付になり JST の 0〜9 時に前日を返す。sv-SE ロケールはローカル日付を YYYY-MM-DD で出す
const today = () => new Date().toLocaleDateString("sv-SE");
// 購読元はないので解除も何もしない
const noop = () => {
  /* 何もしない */
};
const subscribeNever = () => noop;

const clearIcon = "M18 6l-12 12M6 6l12 12";

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

const PreviewDialog = ({ digest, onClose }: { digest: NewDigest; onClose: () => void }) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={headingId}
      className={styles.dialog}
      onClose={afterFadeOut(onClose)}
    >
      <div className={styles.dialogHeader}>
        <h2 className={styles.dialogHeading} id={headingId}>
          プレビュー
        </h2>
        <HoverButton
          className={styles.button}
          type="button"
          onClick={() => {
            dialogRef.current?.close();
          }}
        >
          閉じる
        </HoverButton>
      </div>
      <DigestPost digest={digest} loadPreview={loadDraftPreview} />
    </dialog>
  );
};

interface FormProps {
  heading: string;
  initialDate?: string;
  initialBoard: Board;
  submitLabel: string;
  leaveMessage: string;
  save: (entry: NewDigest) => Promise<Rejection>;
  isDirty: (entry: NewDigest, board: Board) => boolean;
  taken: ReadonlySet<string>;
}

const DigestForm = ({
  heading,
  initialDate,
  initialBoard,
  submitLabel,
  leaveMessage,
  save,
  isDirty,
  taken,
}: FormProps) => {
  const getPreview = useServerFn(fetchDraftPreview);
  // SSR のサーバー TZ とブラウザの日付がずれると hydration 不一致になるので、既定値はクライアントでだけ決める
  const defaultDate = useSyncExternalStore(subscribeNever, today, () => "");
  const [editedDate, setEditedDate] = useState<string>();
  const entryDate = editedDate ?? initialDate ?? defaultDate;
  const [board, setBoard] = useState<Board>(initialBoard);
  const [url, setUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string>();
  // 前の Digest で登録済みと backend に断られた URL。外すか直せば印も消える
  const [registered, setRegistered] = useState<ReadonlySet<string>>(new Set());
  // 登録済みと断られた日付。日付を変えれば印も消える
  const [takenDate, setTakenDate] = useState<string>();
  const [previewing, setPreviewing] = useState(false);
  const [picking, setPicking] = useState(false);
  // Esc でドラッグをやめたとき、ドラッグ中に組み替えた並びを戻す
  const beforeDrag = useRef<Board>(undefined);
  const urlInput = useRef<HTMLInputElement>(null);
  const blockersId = useId();
  const dateId = useId();
  const header = useRef<HTMLElement>(null);

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
  const registeredLeft = entry.articles
    .flatMap((a) => [a.url, ...a.children.map((c) => c.url)])
    .filter((u) => registered.has(u)).length;
  const dateTaken = entryDate !== "" && entryDate === takenDate;
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

  const onAdd = async (input: string) => {
    if (!newChildArticle.shape.url.safeParse(input).success) {
      setAddError("http か https の URL を入れてください");
      return;
    }
    const link = stripTracking(input);
    const id = crypto.randomUUID();
    const added = addDraft(board, link, id);
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
      const preview = await getPreview({ data: link });
      title = preview?.title ?? null;
    } catch {
      // 取れなかったときはタイトル空の候補として残し、手で入れてもらう
    }
    // 取得を待つ間に他の操作で board が変わっているので、最新の state に反映する
    setBoard((b) => settleTitle(b, id, title));
    setAdding(false);
    urlInput.current?.focus();
  };

  const onPaste = async () => {
    let text: string;
    try {
      text = await navigator.clipboard.readText();
    } catch {
      setAddError("クリップボードを読めませんでした。入力欄に貼り付けてください");
      return;
    }
    // 弾かれたときに何が貼られたか見えるよう、先に入力欄へ入れる
    setUrl(text.trim());
    await onAdd(text.trim());
  };

  const onClear = () => {
    setUrl("");
    setAddError(undefined);
    urlInput.current?.focus();
  };

  const onSubmit = async () => {
    setSubmitting(true);
    setSubmitError(undefined);
    try {
      // navigate は呼ばない。成功時はサーバー関数が redirect を投げ、Router が遷移する
      const rejected = await save(entry);
      if (rejected.reason === "digest-already-exists") {
        setTakenDate(entry.entryDate);
      } else {
        setRegistered(new Set(rejected.duplicateUrls));
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
          <div className={styles.dateField}>
            {/* ボタンを label の中に入れると labelable な要素が 2 つになり不正なので、htmlFor で結ぶ */}
            <label className={styles.label} htmlFor={dateId}>
              日付
            </label>
            <div className={styles.dateBox}>
              <input
                aria-invalid={dateTaken}
                className={styles.input}
                id={dateId}
                required
                type="date"
                value={entryDate}
                onChange={(e) => {
                  setEditedDate(e.target.value);
                }}
              />
              <button
                aria-label="カレンダーから選ぶ"
                className={styles.calendarButton}
                type="button"
                onClick={() => {
                  setPicking(true);
                }}
              >
                <svg
                  fill="none"
                  height={20}
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                  width={20}
                >
                  <path d={calendarIcon} />
                </svg>
              </button>
            </div>
            {picking && (
              <Suspense>
                <DatePickerDialog
                  disabled={{ dates: taken, label: "登録済み" }}
                  value={entryDate}
                  onClose={() => {
                    setPicking(false);
                  }}
                  onPick={setEditedDate}
                />
              </Suspense>
            )}
          </div>
        </div>
        <div className={styles.submit}>
          {reasons.length > 0 && (
            <p className={styles.message} id={blockersId}>
              {reasons.map(blockerText).join("。")}
            </p>
          )}
          {submitError !== undefined && <p className={styles.message}>{submitError}</p>}
          {dateTaken && (
            <p className={styles.error} role="alert">
              その日の Digest は登録済みです。日付を変えてください
            </p>
          )}
          {registeredLeft > 0 && (
            <p className={styles.error} role="alert">
              過去に登録したリンクが含まれてます。重複して登録はできないので削除してください
            </p>
          )}
          <HoverButton
            className={styles.button}
            disabled={entry.articles.length === 0 || entryDate === ""}
            type="button"
            onClick={() => {
              setPreviewing(true);
            }}
          >
            プレビュー
          </HoverButton>
          <HoverButton
            aria-describedby={reasons.length > 0 ? blockersId : undefined}
            className={styles.button}
            disabled={reasons.length > 0 || submitting || entryDate === ""}
            type="button"
            onClick={() => {
              void onSubmit();
            }}
          >
            {submitLabel}
          </HoverButton>
        </div>
      </header>
      {previewing && (
        <PreviewDialog
          digest={entry}
          onClose={() => {
            setPreviewing(false);
          }}
        />
      )}
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
          <form
            className={styles.add}
            onSubmit={(e) => {
              e.preventDefault();
              void onAdd(url);
            }}
          >
            <div className={styles.urlField}>
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
              <button
                aria-label={url === "" ? "クリップボードから追加" : "入力を消去"}
                className={styles.fieldButton}
                disabled={adding}
                type="button"
                onClick={() => {
                  if (url === "") {
                    void onPaste();
                  } else {
                    onClear();
                  }
                }}
              >
                <svg
                  fill="none"
                  height={20}
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                  width={20}
                >
                  <path d={url === "" ? clipboardIcon : clearIcon} />
                </svg>
              </button>
            </div>
            <HoverButton className={styles.button} disabled={adding} type="submit">
              {adding ? "取得中" : "追加"}
            </HoverButton>
          </form>
          {addError !== undefined && <p className={styles.message}>{addError}</p>}
          {renderBox(UNSORTED)}
        </div>
        <div className={styles.shelf}>{category.options.map(renderBox)}</div>
      </DragDropProvider>
    </div>
  );
};

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
      save={async (entry) => await create({ data: entry })}
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
      save={async (entry) => await update({ data: { date: digest.entryDate, digest: entry } })}
      submitLabel="保存"
      taken={taken}
    />
  );
};
