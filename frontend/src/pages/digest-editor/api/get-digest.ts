import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { backendFetch } from "#/shared/api/index.server";
import { requireAdminToken } from "#/shared/auth/index.server";
import { digestOf } from "./digest-of";

// 保存直後に開き直したとき古い内容で上書きしないよう、トップと違ってキャッシュを通さない
export const getDigest = createServerFn({ method: "GET" })
  .validator(z.iso.date())
  .handler(
    async ({ data }) =>
      await digestOf(
        await backendFetch(`/digests/${data}`, undefined, { token: requireAdminToken() }),
      ),
  );
