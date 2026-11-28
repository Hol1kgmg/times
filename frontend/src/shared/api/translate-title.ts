import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminToken } from "#/shared/auth/index.server";
import { extractTerms } from "./title-terms.server";
import { hasKanaOrKanji, hasWordsToTranslate } from "./title-html";
import { translateWithTerms } from "./title-translation.server";

const input = z.object({ title: z.string().trim().min(1).max(500) });

export const translateTitle = createServerFn({ method: "POST" })
  .validator(input)
  .handler(async ({ data }): Promise<string | null> => {
    requireAdminToken();
    const terms = await extractTerms(data.title);
    return terms === null ? null : await translateWithTerms(data.title, terms);
  });

export const autoTranslateTitle = createServerFn({ method: "POST" })
  .validator(input)
  .handler(async ({ data }): Promise<string | null> => {
    requireAdminToken();
    if (hasKanaOrKanji(data.title)) {
      return null;
    }
    const terms = await extractTerms(data.title);
    return terms === null || !hasWordsToTranslate(data.title, terms)
      ? null
      : await translateWithTerms(data.title, terms);
  });
