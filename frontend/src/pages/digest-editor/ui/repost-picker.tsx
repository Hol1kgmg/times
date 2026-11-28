import { useServerFn } from "@tanstack/react-start";
import { useId, useState } from "react";
import { Button, ListBox, ListBoxItem } from "react-aria-components";
import { listRepostCandidates } from "#/shared/api";
import { formatEntryDate } from "#/shared/lib/entry-date";
import { Chevron } from "#/shared/ui/chevron";
import { Favicon } from "#/shared/ui/favicon";
import { ModalDialog } from "#/shared/ui/modal";
import { repostAddBlock } from "../model/board";
import { failureMessage } from "./failure-message";
import type { Board, LinkBlock, RepostCandidate } from "../model/board";
import styles from "./repost-picker.module.css";
import { resultText } from "#/shared/lib/result-text";

const blockText = {
  "not-before": "この日より前に公開されてないので選べません",
  "on-board": "もう載ってるので選べません",
  "has-parent": "関連記事なので親にできません",
  full: "関連記事がいっぱいなので選べません",
  limit: "記事がいっぱいなので選べません",
} as const satisfies Record<NonNullable<LinkBlock> | "limit", string>;

const label = (c: RepostCandidate) => (c.title === "" ? new URL(c.url).hostname : c.title);

const Candidate = ({ c, block }: { c: RepostCandidate; block: keyof typeof blockText | null }) => (
  <>
    {c.parent !== undefined && (
      <span className={styles.parent}>
        <Favicon className={styles.parentFavicon} url={c.parent.url} />
        <span className={styles.ellipsis}>{c.parent.title}</span>
      </span>
    )}
    <span className={styles.titleLine}>
      <Favicon url={c.url} />
      <span className={styles.title}>{label(c)}</span>
      {block !== null && (
        <>
          <span aria-hidden className={styles.dot} />
          <span className={styles.srOnly}>{blockText[block]}</span>
        </>
      )}
    </span>
    <span className={styles.meta}>
      <span className={styles.ellipsis}>{c.url}</span>
      <span className={styles.metaRest}>
        {` · ${c.category} · ${formatEntryDate(c.firstPublishedOn)}に初掲載`}
      </span>
    </span>
  </>
);

export const RepostPicker = ({
  heading = "過去の記事から追加",
  block: blockOf = repostAddBlock,
  board,
  entryDate,
  onPick,
  onClose,
}: {
  heading?: string;
  block?: (board: Board, candidate: RepostCandidate, entryDate: string) => LinkBlock | "limit";
  board: Board;
  entryDate: string;
  onPick: (candidate: RepostCandidate) => void;
  onClose: () => void;
}) => {
  const headingId = useId();
  const list = useServerFn(listRepostCandidates);
  const [candidates, setCandidates] = useState<RepostCandidate[]>();
  const [error, setError] = useState<string>();
  const [searching, setSearching] = useState(false);

  const onSearch = async (q: string) => {
    setSearching(true);
    setError(undefined);
    try {
      const result = await list({ data: { q } });
      setCandidates(result.articles);
    } catch (error_) {
      setCandidates(undefined);
      setError(failureMessage(error_, "検索"));
    }
    setSearching(false);
  };

  return (
    <ModalDialog className={styles.modal} labelledBy={headingId} onClose={onClose}>
      {({ close }) => (
        <div className={styles.body}>
          <h2 className={styles.srOnly} id={headingId}>
            {heading}
          </h2>
          <form
            className={styles.form}
            onSubmit={(e) => {
              e.preventDefault();
              const q = new FormData(e.currentTarget).get("q");
              if (typeof q === "string") {
                void onSearch(q);
              }
            }}
          >
            {/* 下に置くと候補の数で位置が動き、多いとスクロールの先に隠れる */}
            <Button aria-label="閉じる" className={styles.back} onPress={close}>
              <Chevron className={styles.backIcon} size={20} />
            </Button>
            <input
              aria-label="タイトルか URL"
              // ModalDialog は先頭の要素 (閉じる) にフォーカスするので、開いてすぐ打てるよう検索欄に置く
              autoFocus
              className={styles.input}
              maxLength={100}
              name="q"
              pattern=".*\S.*"
              required
              title="空白だけでは探せないです"
              type="search"
            />
            <Button className={styles.button} isDisabled={searching} type="submit">
              {searching ? "検索中" : "検索"}
            </Button>
          </form>
          {/* 出し入れで候補の位置が動かないよう、常に置いて場所を取っておく */}
          <output className={styles.message} data-error={error === undefined ? undefined : ""}>
            {error ?? resultText(candidates)}
          </output>
          {candidates !== undefined && candidates.length > 0 && (
            // disabledKeys は矢印キーでも飛ばされるので使わず、選べない行は押しても何もしない (adr/frontend/0008)
            // 項目は候補ごとに覚えられて作り直されないので、選べるかの判定を今のボードで引き直させる
            <ListBox
              aria-label="候補"
              className={styles.list}
              dependencies={[board]}
              items={candidates}
            >
              {(c) => {
                const block = blockOf(board, c, entryDate);
                return (
                  <ListBoxItem
                    className={block === null ? styles.item : `${styles.item} ${styles.blocked}`}
                    textValue={label(c)}
                    onAction={
                      block === null
                        ? () => {
                            onPick(c);
                            close();
                          }
                        : undefined
                    }
                  >
                    <Candidate block={block} c={c} />
                  </ListBoxItem>
                );
              }}
            </ListBox>
          )}
        </div>
      )}
    </ModalDialog>
  );
};

export const RepostAdd = ({
  board,
  entryDate,
  atLimit,
  onPick,
}: {
  board: Board;
  entryDate: string;
  atLimit: boolean;
  onPick: (candidate: RepostCandidate) => void;
}) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      {/* 選べるかの判定に日付が要る (specs/022 FR-002) */}
      <Button
        className={styles.button}
        isDisabled={entryDate === "" || atLimit}
        onPress={() => {
          setOpen(true);
        }}
      >
        過去の記事から追加
      </Button>
      {open && (
        <RepostPicker
          board={board}
          entryDate={entryDate}
          onClose={() => {
            setOpen(false);
          }}
          onPick={onPick}
        />
      )}
    </>
  );
};
