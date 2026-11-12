import { useServerFn } from "@tanstack/react-start";
import type { Dispatch, SetStateAction } from "react";
import { autoTranslateTitle, fetchAnyLinkPreview, suggestCategory } from "#/shared/api";
import type { Category } from "#/shared/api";
import { addDraft, draftTitle, MAX_DRAFTS, settleCategory } from "./board";
import type { Board, Rejected } from "./board";

export const rejectedText: Record<Rejected, string> = {
  duplicate: "その URL はもう入ってます",
  limit: `記事は ${MAX_DRAFTS} 件までです`,
};

export type Suggested = Category | null | "failed";

export interface Loaded {
  title: string;
  translation: string | null;
}

export const useAddUrl = (
  setBoard: Dispatch<SetStateAction<Board>>,
  setSuggesting: Dispatch<SetStateAction<number>>,
) => {
  const getPreview = useServerFn(fetchAnyLinkPreview);
  const suggest = useServerFn(suggestCategory);
  const autoTranslate = useServerFn(autoTranslateTitle);

  const load = async (link: string): Promise<Loaded> => {
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
    return { title, translation };
  };

  const settle = async (id: string, link: string, title: string): Promise<Suggested> => {
    setSuggesting((n) => n + 1);
    let suggested: Suggested = "failed";
    try {
      // 訳したタイトルで分類したほうが当たるかは確かめていないので、原文で推定する (#110)
      suggested = await suggest({ data: { url: link, title } });
    } catch {
      // 推定は補助で、失敗しても未分類から手で振り分けられる (FR-007)
    }
    setSuggesting((n) => n - 1);
    setBoard((b) => settleCategory(b, id, suggested === "failed" ? null : suggested));
    return suggested;
  };

  const add = async (link: string, { title, translation }: Loaded) => {
    const id = crypto.randomUUID();
    // ponytail: 待つ間に別の記事の URL を同じに直すなどで断られたら、何も出さずに捨てる。起きるようなら入力欄に残して知らせる
    setBoard((b) => {
      const added = addDraft(b, link, id, title, translation);
      return typeof added === "string" ? b : added;
    });
    await settle(id, link, title);
  };

  return { load, settle, add };
};
