import { notFound, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { backendFetch } from "#/shared/api";
// validator はクライアントにも残るので、.server.ts を再 export する barrel ではなく schemas から取る
import { digestUpdate } from "#/shared/api/schemas";
import { readAdminToken, SESSION_EXPIRED } from "#/shared/auth";
import { rejectionOf } from "./rejection-of";

// 拒否を例外にせず返す理由は create-digest.ts と同じ
export const updateDigest = createServerFn({ method: "POST" })
  .validator(z.object({ date: z.iso.date(), digest: digestUpdate }))
  .handler(async ({ data }) => {
    const token = readAdminToken();
    if (token === undefined || token === "") {
      throw notFound({ data: { reason: SESSION_EXPIRED } });
    }
    try {
      await backendFetch(
        `/digests/${data.date}`,
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(data.digest),
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
    throw redirect({ to: "/admin/digests" });
  });
