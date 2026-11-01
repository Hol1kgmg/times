import { redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { backendFetch } from "#/shared/api";
// validator はクライアントにも残るので、.server.ts を再 export する barrel ではなく schemas から取る
import { newDigest } from "#/shared/api/schemas";
import { requireAdminToken } from "#/shared/auth";
import { rejectionOf } from "./rejection-of";

// 登録済みの日付・URL の 400 だけは例外にせず返す。例外はクライアントへ message しか届かず、どの URL か渡せないため
export const createDigest = createServerFn({ method: "POST" })
  .validator(newDigest)
  .handler(async ({ data }) => {
    const token = requireAdminToken();
    try {
      await backendFetch(
        "/digests",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(data),
        },
        { token },
      );
    } catch (error) {
      const rejection = rejectionOf(error);
      if (rejection === undefined) {
        throw error;
      }
      return rejection;
    }
    // 下書きはトップに出ないので、登録できたことを一覧で見せる
    throw redirect({ to: data.status === "published" ? "/" : "/admin/digests" });
  });
