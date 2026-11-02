import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { runCompleteGitHubLogin } from "./complete-github-login.server";

export const completeGitHubLogin = createServerFn({ method: "GET" })
  .validator(
    z.object({
      code: z.string().optional(),
      state: z.string().optional(),
      error: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => await runCompleteGitHubLogin(data));
