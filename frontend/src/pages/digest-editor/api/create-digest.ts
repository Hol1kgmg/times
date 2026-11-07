import { Result } from "@praha/byethrow";
import { redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { backendFetch, unwrapBackend } from "#/shared/api/index.server";
import { newDigest } from "#/shared/api";
import { requireAdminToken } from "#/shared/auth/index.server";
import { rejectionOf } from "./rejection-of";

// 登録済みの日付・URL の 400 だけは例外にせず返す。例外はクライアントへ message しか届かず、どの URL か渡せないため
export const createDigest = createServerFn({ method: "POST" })
  .validator(newDigest)
  .handler(async ({ data }) => {
    const result = await backendFetch(
      "/digests",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(data),
      },
      { token: requireAdminToken() },
    );
    const rejection = Result.isFailure(result) ? rejectionOf(result.error) : undefined;
    if (rejection !== undefined) {
      return rejection;
    }
    unwrapBackend(result);
    // 下書きはトップに出ないので、登録できたことを一覧で見せる
    throw redirect({ to: data.status === "published" ? "/" : "/admin/digests" });
  });
