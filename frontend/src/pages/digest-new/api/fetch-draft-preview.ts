import { notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { loadLinkPreviewCached } from "#/shared/api/link-preview.server";
// validator はクライアントにも残るので、.server.ts を再 export する barrel ではなく schemas から取る
import { newChildArticle } from "#/shared/api/schemas";
import { readAdminToken, SESSION_EXPIRED } from "#/shared/auth";
import type { LinkPreview } from "#/shared/lib/parse-link-preview";

// 任意の URL を外部 fetch するので管理者に限る。トップの getLinkPreview は digest 内の URL に限っている
export const fetchDraftPreview = createServerFn({ method: "POST" })
  .validator(newChildArticle.shape.url)
  .handler(async ({ data: url }): Promise<LinkPreview | null> => {
    const token = readAdminToken();
    if (token === undefined || token === "") {
      throw notFound({ data: { reason: SESSION_EXPIRED } });
    }
    return await loadLinkPreviewCached(url);
  });
