import { createServerFn } from "@tanstack/react-start";
import { requireAdminToken } from "#/shared/auth/index.server";
import type { LinkPreview } from "#/shared/lib/parse-link-preview";
import { loadLinkPreviewCached } from "./link-preview.server";
import { newChildArticle } from "./schemas";

// 任意の URL を外部 fetch するので管理者に限る。トップの getLinkPreview は digest 内の URL に限っている
export const fetchAnyLinkPreview = createServerFn({ method: "POST" })
  .validator(newChildArticle.shape.url)
  .handler(async ({ data: url }): Promise<LinkPreview | null> => {
    requireAdminToken();
    return await loadLinkPreviewCached(url);
  });
