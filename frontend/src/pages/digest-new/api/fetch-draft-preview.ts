import { createServerFn } from "@tanstack/react-start";
import { loadLinkPreviewCached } from "#/shared/api/index.server";
import { newChildArticle } from "#/shared/api";
import { requireAdminToken } from "#/shared/auth/index.server";
import type { LinkPreview } from "#/shared/lib/parse-link-preview";

// 任意の URL を外部 fetch するので管理者に限る。トップの getLinkPreview は digest 内の URL に限っている
export const fetchDraftPreview = createServerFn({ method: "POST" })
  .validator(newChildArticle.shape.url)
  .handler(async ({ data: url }): Promise<LinkPreview | null> => {
    requireAdminToken();
    return await loadLinkPreviewCached(url);
  });
