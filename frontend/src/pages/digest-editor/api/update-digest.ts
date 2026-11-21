import { Result } from "@praha/byethrow";
import { redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { backendFetch, purgeDigestCaches, unwrapBackend } from "#/shared/api/index.server";
import { digestUpdate } from "#/shared/api";
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
    unwrapBackend(result);
    await purgeDigestCaches([data.date, data.digest.entryDate]);
    throw redirect({ to: "/admin/digests" });
  });
