import { createServerFn } from "@tanstack/react-start";
import { readAuthConfig } from "./config.server";
import type { AdminViewer } from "./session.server";
import { currentAdminViewer } from "./session.server";

export type { AdminUser, AdminViewer } from "./session.server";
// 権限は kind ではなく照合済みの値の有無で表す (adr/frontend/0013)。トークンはクライアントに渡さないので持たせない
export interface Viewer {
  admin?: AdminViewer;
}

export const getCurrentAdmin = createServerFn({ method: "GET" }).handler(
  async (): Promise<Viewer> => ({
    // 秘匿パスは照合が通った AdminViewer にだけ載る。未ログインに渡すと FR-014 に反する
    admin: await currentAdminViewer(readAuthConfig(process.env)?.loginPath),
  }),
);
