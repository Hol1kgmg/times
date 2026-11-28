import { useId, useRef, useState } from "react";
import { flushSync } from "react-dom";
import type { Dispatch, SetStateAction } from "react";
import { Button } from "react-aria-components";
import { newChildArticle } from "#/shared/api";
import { isSessionExpired } from "#/shared/auth";
import { clipboardIcon } from "#/shared/ui/icons/clipboard";
import { LineIcon } from "#/shared/ui/icons/line-icon";
import { toast } from "#/shared/ui/toast";
import { rejectedText, useAddUrl } from "../model/add-url";
import type { Loaded } from "../model/add-url";
import { rejectAdd, stripTracking } from "../model/board";
import type { Board } from "../model/board";
import { failureMessage } from "./failure-message";
import styles from "./url-add-form.module.css";

const clearIcon = "M18 6l-12 12M6 6l12 12";

interface UrlAddFormProps {
  board: Board;
  setBoard: Dispatch<SetStateAction<Board>>;
  setSuggesting: Dispatch<SetStateAction<number>>;
  adding: boolean;
  setAdding: Dispatch<SetStateAction<number>>;
}

export const UrlAddForm = ({
  board,
  setBoard,
  setSuggesting,
  adding,
  setAdding,
}: UrlAddFormProps) => {
  const { load, add } = useAddUrl(setBoard, setSuggesting);
  const [url, setUrl] = useState("");
  const [addError, setAddError] = useState<string>();
  const urlInput = useRef<HTMLInputElement>(null);
  const errorId = useId();

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
    setAdding((n) => n + 1);
    let loaded: Loaded;
    try {
      loaded = await load(link).finally(() => {
        // 取得中は欄もボタンも disabled でフォーカスが body に落ちるので、disabled を外し終えてから戻す
        flushSync(() => {
          setAdding((n) => n - 1);
        });
        // 待つ間にほかの欄やカードへ移っていたら奪わない。disabled にした要素がフォーカスを持ったままのブラウザもある
        const at = document.activeElement;
        if (
          at === document.body ||
          (at !== null && urlInput.current?.form?.contains(at) === true)
        ) {
          urlInput.current?.focus();
        }
      });
    } catch (error) {
      toast.error(failureMessage(error, "追加"));
      return;
    }
    const settled = add(link, loaded);
    setUrl("");
    try {
      await settled;
    } catch (error) {
      if (!isSessionExpired(error)) {
        throw error;
      }
      toast.error(
        "ログインが切れたので未分類に入れました。別のタブでログインし直してから振り分けてください",
      );
    }
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
            aria-describedby={errorId}
            aria-invalid={addError !== undefined}
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
      {/* 出し入れで下のボタンが動かないよう、文がないときも場所を取っておく */}
      <p aria-live="polite" className={styles.message} id={errorId}>
        {addError}
      </p>
    </>
  );
};
