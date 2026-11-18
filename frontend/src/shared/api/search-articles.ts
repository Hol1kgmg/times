import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminToken } from "#/shared/auth/index.server";
import { backendFetch, unwrapBackend } from "./backend.server";
import { articleSearchResult } from "./schemas";

export const articleSearchQuery = z.object({ q: z.string().min(1).max(100) });

// 登録したばかりの記事も確かめられるよう、キャッシュを通さない
export const searchArticles = createServerFn({ method: "GET" })
  .validator(articleSearchQuery)
  .handler(async ({ data }) => {
    const res = unwrapBackend(
      await backendFetch(`/articles/search?${new URLSearchParams(data)}`, undefined, {
        token: requireAdminToken(),
      }),
    );
    return articleSearchResult.parse(await res.json());
  });
