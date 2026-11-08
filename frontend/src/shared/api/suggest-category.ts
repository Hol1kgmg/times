import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminToken } from "#/shared/auth/index.server";
import { suggestCategoryWithAi } from "./category-suggestion.server";
import { newChildArticle } from "./schemas";
import type { Category } from "./schemas";

export const suggestCategory = createServerFn({ method: "POST" })
  .validator(z.object({ url: newChildArticle.shape.url, title: z.string().max(500) }))
  .handler(async ({ data }): Promise<Category | null> => {
    requireAdminToken();
    return await suggestCategoryWithAi(data);
  });
