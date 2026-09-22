import { setTimeout } from "node:timers/promises";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { itemId, readItems } from "#/shared/api";

// route の params は素の文字列。境界で uuid 検証し、以降は ItemId として扱う
export const getItem = createServerFn({ method: "GET" })
  .validator(z.object({ id: itemId }))
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
