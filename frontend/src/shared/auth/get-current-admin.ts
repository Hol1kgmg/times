import { createServerFn } from "@tanstack/react-start";
import { readAuthConfig } from "./config.server";
import { currentAdmin } from "./session.server";

export const getCurrentAdmin = createServerFn({ method: "GET" }).handler(async () => {
  const user = (await currentAdmin()) ?? null;
  // 秘匿パスはログイン中の応答にだけ載せる。未ログインに渡すと FR-014 に反する
  return user ? { user, loginPath: readAuthConfig(process.env)?.loginPath } : { user };
});
