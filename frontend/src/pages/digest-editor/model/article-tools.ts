import { useEffect, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";
import { z } from "zod";
import { category, newChildArticle } from "#/shared/api";
import { isSessionExpired } from "#/shared/auth";
import { defineTool, registerTool } from "#/shared/lib/webmcp";
import { rejectedText, useAddUrl } from "./add-url";
import type { Suggested } from "./add-url";
import {
  addUntitled,
  describeBoard,
  pinReposts,
  fillTitle,
  MAX_DRAFTS,
  rejectUpdate,
  stripTracking,
  updateDraft,
} from "./board";
import type { Board, UpdateRejected } from "./board";

const addInput = z.object({
  urls: z.array(newChildArticle.shape.url).min(1).max(MAX_DRAFTS),
});

const updateInput = z.object({
  articles: z
    .array(
      z.object({
        id: z.string(),
        title: newChildArticle.shape.title.optional(),
        category: category.optional(),
        hot: z.boolean().optional(),
      }),
    )
    .min(1)
    .max(MAX_DRAFTS),
});

const addDescription = `URL を渡すと画面の Digest に記事として入れ、記事ごとの id・タイトル・AI が推定したカテゴリを返す。画面全体で ${MAX_DRAFTS} 件まで。画面にすでにある URL は入れない。保存は人が画面でする。`;

const updateDescription = [
  "add_articles か list_articles で受け取った id の記事を直す。",
  "hot: その日の話題として目立たせたい記事に true。子記事は title だけ直せる。直した後の Digest を list_articles と同じ形で返す。保存は人が画面でする。",
].join("\n");

const listDescription =
  "画面の Digest で扱っている記事をすべて、カテゴリごとに id・タイトル・URL・ホットの印・子記事つきで返す。";

const suggestedText = (suggested: Suggested) => {
  if (suggested === "failed") {
    return "未分類のまま (推定に失敗しました)";
  }
  return suggested === null
    ? "未分類のまま (AI が決められませんでした)"
    : `AI の推定: ${suggested}`;
};

const updateRejectedText: Record<UpdateRejected, string> = {
  missing: "その id の記事は画面の Digest にありません",
  child: "子記事はカテゴリとホットを持てません (title だけ直せます)",
  repost:
    "再掲載の記事はタイトルとホットを変えられず、子記事がなければカテゴリも元の記事のままです",
};

interface Props {
  board: Board;
  setBoard: Dispatch<SetStateAction<Board>>;
  setSuggesting: Dispatch<SetStateAction<number>>;
  setAdding: Dispatch<SetStateAction<number>>;
}

// adr/frontend/0014
export const useArticleTools = ({ board, setBoard, setSuggesting, setAdding }: Props) => {
  const { load, settle } = useAddUrl(setBoard, setSuggesting);
  // board が変わるたびに登録し直すと、呼ばれている途中のツールまで外れる
  const latest = useRef({ board, load, settle });
  useEffect(() => {
    latest.current = { board, load, settle };
  });
  useEffect(() => {
    const controller = new AbortController();
    void registerTool(
      defineTool({
        name: "add_articles",
        description: addDescription,
        input: addInput,
        annotations: { untrustedContentHint: true },
        execute: async ({ urls }) => {
          const entries = urls.map((url) => ({ id: crypto.randomUUID(), url: stripTracking(url) }));
          const { accepted, rejected } = addUntitled(latest.current.board, entries);
          setBoard((b) => addUntitled(b, accepted).board);
          setAdding((n) => n + 1);
          // 下書きはもう画面にあるので、切れても途中で投げずに残りを待ち、入った記事を返す
          let expired = false;
          const orExpired = async <T>(p: Promise<T>, fallback: T): Promise<T> => {
            try {
              return await p;
            } catch (error) {
              if (!isSessionExpired(error)) {
                throw error;
              }
              expired = true;
              return fallback;
            }
          };
          const loaded = await Promise.all(
            accepted.map(async ({ id, url }) => {
              const { title, translation } = await orExpired(latest.current.load(url), {
                title: "",
                translation: null,
              });
              setBoard((b) => fillTitle(b, id, title, translation));
              const shown = translation ?? title;
              return {
                line: `- ${id}: ${url} / ${shown === "" ? "タイトルを取れませんでした" : shown}`,
                suggested: orExpired<Suggested>(latest.current.settle(id, url, title), "failed"),
              };
            }),
          ).finally(() => {
            // 推定を待つ間も人は URL を足せる
            setAdding((n) => n - 1);
          });
          const lines = await Promise.all(
            loaded.map(
              async ({ line, suggested }) => `${line} → ${suggestedText(await suggested)}`,
            ),
          );
          return [
            `${accepted.length} 件を未分類に入れました`,
            ...lines,
            ...rejected.map(
              ({ url, reason }) => `- ${url}: 入れませんでした (${rejectedText[reason]})`,
            ),
            ...(expired
              ? [
                  "途中でログインが切れました。人にログインし直してもらってから、取れなかったタイトルとカテゴリを update_articles で直してください",
                ]
              : []),
          ].join("\n");
        },
      }),
      controller.signal,
    );
    void registerTool(
      defineTool({
        name: "update_articles",
        description: updateDescription,
        input: updateInput,
        annotations: { untrustedContentHint: true },
        execute: ({ articles }) => {
          const checked = articles.map((a) => ({
            a,
            rejected: rejectUpdate(latest.current.board, a),
          }));
          const found = checked.flatMap(({ a, rejected }) => (rejected === null ? [a] : []));
          const apply = (b: Board) => {
            let next = b;
            for (const { id, ...update } of found) {
              next = updateDraft(next, id, update);
            }
            return next;
          };
          setBoard(apply);
          return [
            `${found.length} 件を直しました`,
            ...checked.flatMap(({ a, rejected }) =>
              rejected === null ? [] : [`- ${a.id}: ${updateRejectedText[rejected]}`],
            ),
            "",
            describeBoard(pinReposts(apply(latest.current.board))),
          ].join("\n");
        },
      }),
      controller.signal,
    );
    void registerTool(
      defineTool({
        name: "list_articles",
        description: listDescription,
        input: z.object({}),
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute: () => describeBoard(latest.current.board),
      }),
      controller.signal,
    );
    return () => {
      controller.abort();
    };
  }, [setBoard, setAdding]);
};
