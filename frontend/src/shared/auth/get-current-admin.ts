import { createServerFn } from "@tanstack/react-start";
import { currentAdmin } from "./session.server";

// ルートの beforeLoad から呼び、ログイン中かどうかを全ページの context に載せる。Cookie が無ければ backend には行かない
export const getCurrentAdmin = createServerFn({ method: "GET" }).handler(
  async () => (await currentAdmin()) ?? null,
);
