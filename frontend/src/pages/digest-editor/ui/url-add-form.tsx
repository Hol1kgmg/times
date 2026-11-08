import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { Button } from "react-aria-components";
import {
  autoTranslateTitle,
  fetchAnyLinkPreview,
  newChildArticle,
  suggestCategory,
} from "#/shared/api";
import type { Category } from "#/shared/api";
import { clipboardIcon } from "#/shared/ui/icons/clipboard";
import { LineIcon } from "#/shared/ui/icons/line-icon";
import {
  addDraft,
  draftTitle,
  MAX_DRAFTS,
  rejectAdd,
  settleCategory,
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
  adding: boolean;
  setAdding: Dispatch<SetStateAction<boolean>>;
}

export const UrlAddForm = ({
  board,
  setBoard,
  setSuggesting,
  adding,
  setAdding,
}: UrlAddFormProps) => {
  const getPreview = useServerFn(fetchAnyLinkPreview);
  const suggest = useServerFn(suggestCategory);
  const autoTranslate = useServerFn(autoTranslateTitle);
  const [url, setUrl] = useState("");
  const [addError, setAddError] = useState<string>();
  const urlInput = useRef<HTMLInputElement>(null);

  const onAdd = async (input: string) => {
    if (!newChildArticle.shape.url.safeParse(input).success) {
      setAddError("http か https の URL を入れてください");
      return;
    }
    const link = stripTracking(input);
    const rejected = rejectAdd(board, link);
    if (rejected !== null) {
      setAddError(rejectedText[rejected]);
      return;
    }
    setAddError(undefined);
    setAdding(true);
    let title = "";
    try {
      title = draftTitle(link, await getPreview({ data: link })) ?? "";
    } catch {
      // 取れなかったときはタイトル空の候補として出し、手で入れてもらう
    }
    let translation: string | null = null;
    if (title.trim() !== "") {
      try {
        translation = await autoTranslate({ data: { title } });
      } catch {
        // 未翻訳のまま出し、編集画面の翻訳ボタンで訳してもらう (#105)
      }
    }
    const id = crypto.randomUUID();
    // ponytail: 待つ間に別の記事の URL を同じに直すなどで断られたら、何も出さずに捨てる。起きるようなら入力欄に残して知らせる
    setBoard((b) => {
      const added = addDraft(b, link, id, title, translation);
      return typeof added === "string" ? b : added;
    });
    setUrl("");
    setAdding(false);
    urlInput.current?.focus();
    setSuggesting((n) => n + 1);
    let suggested: Category | null = null;
    try {
      // 訳したタイトルで分類したほうが当たるかは確かめていないので、原文で推定する (#110)
      suggested = await suggest({ data: { url: link, title } });
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
