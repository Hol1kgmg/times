import { createServerFn } from "@tanstack/react-start";
import { readAuthConfig } from "./config.server";
import type { AdminUser } from "./session.server";
import { currentAdmin } from "./session.server";

// トークンはクライアントに渡さないので持たせない
export interface AdminViewer {
  kind: "admin";
  user: AdminUser;
  loginPath: string | undefined;
}
export type Viewer = { kind: "anonymous" } | AdminViewer;

export const getCurrentAdmin = createServerFn({ method: "GET" }).handler(
  async (): Promise<Viewer> => {
    const user = await currentAdmin();
    // 秘匿パスはログイン中の応答にだけ載せる。未ログインに渡すと FR-014 に反する
    return user
      ? { kind: "admin", user, loginPath: readAuthConfig(process.env)?.loginPath }
      : { kind: "anonymous" };
  },
);
