import { useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { Button } from "react-aria-components";
import { newChildArticle } from "#/shared/api";
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
        setAdding((n) => n - 1);
      });
    } catch (error) {
      toast.error(failureMessage(error, "追加"));
      return;
    }
    const settled = add(link, loaded);
    setUrl("");
    urlInput.current?.focus();
    try {
      await settled;
    } catch (error) {
      toast.error(failureMessage(error, "振り分け"));
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
