import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { loginConfig } from "./login-config.server";

// 秘匿パスの照合だけ行う。ログイン済みかは root の beforeLoad が照合済みの viewer を見る
export const resolveLoginPage = createServerFn({ method: "GET" })
  .validator(z.object({ path: z.string() }))
  .handler(({ data }) => {
    loginConfig(data.path);
  });
