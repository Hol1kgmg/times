import { notFound, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { ApiResponse } from "#/shared/api";
import { backendFetchRaw } from "#/shared/api";
import { takeLoginState, writeAdminToken } from "#/shared/auth";
import { callbackUrl } from "./callback-url.server";
import { loginConfig } from "./login-config.server";
import type { LoginError } from "./pick-login-error";
import { pickLoginError } from "./pick-login-error";

// openapi.yaml と乖離したら typecheck で落ちる
const createdSession = z.object({ token: z.string() }) satisfies z.ZodType<
  Pick<ApiResponse<"createSession", 201>, "token">
>;

// GitHub からの戻り。常に redirect か notFound を throw する。
// state 不一致・欠落 → 404。キャンセル → cancelled。code を backend に渡し 201 なら Cookie に載せて / へ
export const completeGitHubLogin = createServerFn({ method: "GET" })
  .validator(
    z.object({
      code: z.string().optional(),
      state: z.string().optional(),
      error: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { loginPath } = loginConfig();
    const expected = takeLoginState();
    if (expected === undefined || data.state === undefined || expected !== data.state) {
      throw notFound();
    }
    const backToLogin = (error: LoginError) =>
      redirect({ to: "/$loginPath/auth/login", params: { loginPath }, search: { error } });
    if (data.error === "access_denied") {
      throw backToLogin("cancelled");
    }
    if (data.code === undefined || data.code === "") {
      throw notFound();
    }

    let res: Response;
    try {
      res = await backendFetchRaw("/auth/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: data.code, redirectUri: callbackUrl() }),
      });
    } catch {
      throw backToLogin(pickLoginError("network"));
    }
    if (res.status !== 201) {
      throw backToLogin(pickLoginError(res.status));
    }
    const { token } = createdSession.parse(await res.json());
    writeAdminToken(token);
    throw redirect({ to: "/" });
  });
