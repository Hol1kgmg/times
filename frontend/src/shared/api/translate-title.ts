import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminToken } from "#/shared/auth/index.server";
import { extractTerms } from "./title-terms.server";
import { translateWithTerms } from "./title-translation.server";

export const translateTitle = createServerFn({ method: "POST" })
  .validator(z.object({ title: z.string().trim().min(1).max(500) }))
  .handler(async ({ data }): Promise<string | null> => {
    requireAdminToken();
    const terms = await extractTerms(data.title);
    return terms === null ? null : await translateWithTerms(data.title, terms);
  });
