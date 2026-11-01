import { redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { backendFetch } from "#/shared/api/index.server";
import { digestUpdate } from "#/shared/api";
import { requireAdminToken } from "#/shared/auth/index.server";
import { rejectionOf } from "./rejection-of";

// 拒否を例外にせず返す理由は create-digest.ts と同じ
export const updateDigest = createServerFn({ method: "POST" })
  .validator(z.object({ date: z.iso.date(), digest: digestUpdate }))
  .handler(async ({ data }) => {
    const token = requireAdminToken();
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
