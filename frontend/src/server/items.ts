import { setTimeout } from "node:timers/promises";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { readItems } from "./db.server";

// サーバー関数: クライアントからは fetch 越しに呼ばれ、本体はサーバーにのみバンドルされる
export const listItems = createServerFn({ method: "GET" })
  .validator(z.object({ q: z.string().default("") }))
  .handler(({ data }) => {
    const q = data.q.toLowerCase();
    return readItems().filter((i) => i.title.toLowerCase().includes(q));
  });

export const getItem = createServerFn({ method: "GET" })
  .validator(z.object({ id: z.string() }))
  .handler(({ data }) => {
    const item = readItems().find((i) => i.id === data.id);
    if (!item) {
      throw new Error(`not found: ${data.id}`);
    }
    return item;
  });

// ストリーミング確認用の遅い処理
export const getSlowDetail = createServerFn({ method: "GET" })
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    await setTimeout(1500);
    return `detail of ${data.id} (loaded after 1.5s)`;
  });
