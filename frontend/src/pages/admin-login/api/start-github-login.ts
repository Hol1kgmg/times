import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { writeLoginState } from "#/shared/auth";
import { callbackUrl } from "./callback-url.server";
import { loginConfig } from "./login-config.server";

// state を Cookie に置き、GitHub の authorize URL を返す。ブラウザはこの URL に遷移する
export const startGitHubLogin = createServerFn({ method: "POST" })
  .validator(z.object({ path: z.string() }))
  .handler(({ data }) => {
    const { clientId, baseUrl } = loginConfig(data.path);
    const state = crypto.randomUUID();
    writeLoginState(state);
    const url = new URL("/login/oauth/authorize", baseUrl);
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", callbackUrl());
    url.searchParams.set("state", state);
    // scope 空 = 公開プロフィールのみ (FR-017)
    url.searchParams.set("scope", "");
    return { url: url.toString() };
  });
