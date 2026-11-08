import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { Button } from "react-aria-components";
import { fetchAnyLinkPreview, newChildArticle, suggestCategory } from "#/shared/api";
import type { Category } from "#/shared/api";
import { clipboardIcon } from "#/shared/ui/icons/clipboard";
import { LineIcon } from "#/shared/ui/icons/line-icon";
import {
  addDraft,
  draftTitle,
  MAX_DRAFTS,
  settleCategory,
  settleTitle,
  stripTracking,
} from "../model/board";
import type { Board, Rejected } from "../model/board";
import styles from "./url-add-form.module.css";

const clearIcon = "M18 6l-12 12M6 6l12 12";

const rejectedText: Record<Rejected, string> = {
  duplicate: "その URL はもう入ってます",
  limit: `記事は ${MAX_DRAFTS} 件までです`,
};

interface UrlAddFormProps {
  board: Board;
  setBoard: Dispatch<SetStateAction<Board>>;
  setSuggesting: Dispatch<SetStateAction<number>>;
}

export const UrlAddForm = ({ board, setBoard, setSuggesting }: UrlAddFormProps) => {
  const getPreview = useServerFn(fetchAnyLinkPreview);
  const suggest = useServerFn(suggestCategory);
  const [url, setUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string>();
  const urlInput = useRef<HTMLInputElement>(null);

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
      title = draftTitle(link, await getPreview({ data: link }));
    } catch {
      // 取れなかったときはタイトル空の候補として残し、手で入れてもらう
    }
    // 取得を待つ間に他の操作で board が変わっているので、最新の state に反映する
    setBoard((b) => settleTitle(b, id, title));
    setAdding(false);
    urlInput.current?.focus();
    setSuggesting((n) => n + 1);
    let suggested: Category | null = null;
    try {
      suggested = await suggest({ data: { url: link, title: title ?? "" } });
    } catch {
      // 推定は補助で、失敗しても未分類から手で振り分けられる (FR-007)
    }
    setSuggesting((n) => n - 1);
    setBoard((b) => settleCategory(b, id, suggested));
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

  return (
    <>
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
          <Button
            aria-label={url === "" ? "クリップボードから追加" : "入力を消去"}
            className={styles.fieldButton}
            isDisabled={adding}
            onPress={() => {
              if (url === "") {
                void onPaste();
              } else {
                onClear();
              }
            }}
          >
            <LineIcon d={url === "" ? clipboardIcon : clearIcon} size={20} />
          </Button>
        </div>
        <Button className={styles.button} isDisabled={adding} type="submit">
          {adding ? "取得中" : "追加"}
        </Button>
      </form>
      {addError !== undefined && <p className={styles.message}>{addError}</p>}
    </>
  );
};
