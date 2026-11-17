import { Result } from "@praha/byethrow";
import { redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { backendFetch, unwrapBackend } from "#/shared/api/index.server";
import { digestUpdate, savedDigest } from "#/shared/api";
import { requireAdminToken } from "#/shared/auth/index.server";
import { rejectionOf } from "./rejection-of";

// 拒否を例外にせず返す理由は create-digest.ts と同じ
export const updateDigest = createServerFn({ method: "POST" })
  .validator(z.object({ date: z.iso.date(), digest: digestUpdate }))
  .handler(async ({ data }) => {
    const result = await backendFetch(
      `/digests/${data.date}`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(data.digest),
      },
      { token: requireAdminToken() },
    );
    const rejection = Result.isFailure(result) ? rejectionOf(result.error) : undefined;
    if (rejection !== undefined) {
      return rejection;
    }
    const saved = savedDigest.parse(await unwrapBackend(result).json());
    // 再掲載を記事行で知らせる理由は create-digest.ts と同じ
    if (saved.repostedUrls.length > 0) {
      throw redirect({
        to: "/admin/digests/$date/edit",
        params: { date: saved.entryDate },
        search: { reposted: saved.repostedUrls },
      });
    }
    throw redirect({ to: "/admin/digests" });
  });
