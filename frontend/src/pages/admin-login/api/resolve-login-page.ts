import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { AdminUser } from "#/shared/auth";
import { currentAdmin } from "#/shared/auth";
import { loginConfig } from "./login-config.server";

// 秘匿パスのページの beforeLoad。パス不一致は 404、ログイン済みなら user を返す
export const resolveLoginPage = createServerFn({ method: "GET" })
  .validator(z.object({ path: z.string() }))
  .handler(async ({ data }): Promise<{ user?: AdminUser }> => {
    loginConfig(data.path);
    const user = await currentAdmin();
    return user ? { user } : {};
  });
