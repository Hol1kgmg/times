import { setTimeout } from "node:timers/promises";
import { notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { backendFetchRaw, item } from "#/shared/api";
// validator はクライアントにも残るので、.server.ts を再 export する barrel ではなく schemas から取る
import { itemId } from "#/shared/api/schemas";

// route の params は素の文字列。境界で uuid 検証し、以降は ItemId として扱う
export const getItem = createServerFn({ method: "GET" })
  .validator(z.object({ id: itemId }))
  .handler(async ({ data }) => {
    const res = await backendFetchRaw(`/items/${data.id}`);
    if (res.status === 404) {
      throw notFound();
    }
    if (!res.ok) {
      throw new Error(`backend ${res.status}: GET /items/${data.id}`);
    }
    return item.parse(await res.json());
  });

// ストリーミング確認用の遅い処理
export const getSlowDetail = createServerFn({ method: "GET" })
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    await setTimeout(1500);
    return `detail of ${data.id} (loaded after 1.5s)`;
  });
