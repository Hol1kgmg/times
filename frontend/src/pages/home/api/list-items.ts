import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { readItems } from "#/shared/api";

// サーバー関数: クライアントからは fetch 越しに呼ばれ、本体はサーバーにのみバンドルされる
export const listItems = createServerFn({ method: "GET" })
  .validator(z.object({ q: z.string().default("") }))
  .handler(({ data }) => {
    const q = data.q.toLowerCase();
    return readItems().filter((i) => i.title.toLowerCase().includes(q));
  });
