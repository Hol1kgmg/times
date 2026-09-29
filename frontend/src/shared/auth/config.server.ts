import { z } from "zod";

const schema = z.object({
  // 秘匿パス。1 セグメント、先頭 `/` なし。サーバー側の照合にだけ使う (FR-014)
  ADMIN_LOGIN_PATH: z.string().regex(/^[A-Za-z0-9-]{16,}$/u),
  GITHUB_CLIENT_ID: z.string().min(1),
  // 空文字は未設定扱い (.env.example の空値をそのまま読めるように)
  GITHUB_BASE_URL: z.preprocess(
    (v) => (v === "" || v === undefined ? "https://github.com" : v),
    z.url(),
  ),
});

export interface AuthConfig {
  loginPath: string;
  clientId: string;
  baseUrl: string;
}

// 必須が欠ければ undefined。呼び出し側はすべて notFound() にする (FR-012)
export const readAuthConfig = (env: Record<string, string | undefined>): AuthConfig | undefined => {
  const r = schema.safeParse(env);
  if (!r.success) {
    return undefined;
  }
  return {
    loginPath: r.data.ADMIN_LOGIN_PATH,
    clientId: r.data.GITHUB_CLIENT_ID,
    baseUrl: r.data.GITHUB_BASE_URL,
  };
};
