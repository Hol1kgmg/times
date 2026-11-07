import { z } from "zod";

const schema = (dev: boolean) =>
  z.object({
    // 本番で欠けたまま localhost に繋ぎに行かないよう、既定値は dev だけにする
    BACKEND_URL: dev ? z.url().default("http://localhost:8080") : z.url(),
    // ローカル (compose) は未設定で到達制限なし (adr/backend/0006)
    BACKEND_TOKEN: z.string().default(""),
  });

export const readBackendEnv = (env: Record<string, string | undefined>, dev: boolean) =>
  schema(dev).parse(env);
