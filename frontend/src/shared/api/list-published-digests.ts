import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminToken } from "#/shared/auth/index.server";
import { backendFetch } from "./backend.server";
import { digestPage } from "./schemas";

// 公開・非公開の切り替えがすぐ反映されるよう、トップと違ってキャッシュを通さない
// ponytail: 一般ユーザーのセッションができたら、管理者に限らないトークンに替える
export const listPublishedDigests = createServerFn({ method: "GET" })
  .validator(
    z.object({
      before: z.iso.date().optional(),
      limit: z.number().int().min(1).max(31).optional(),
    }),
  )
  .handler(async ({ data: { before, limit } }) => {
    const params = new URLSearchParams();
    if (before !== undefined) {
      params.set("before", before);
    }
    if (limit !== undefined) {
      params.set("limit", String(limit));
    }
    const res = await backendFetch(`/digests/published?${params}`, undefined, {
      token: requireAdminToken(),
    });
    return digestPage.parse(await res.json());
  });
