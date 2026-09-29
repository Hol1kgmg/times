import { notFound } from "@tanstack/react-router";
import { readAuthConfig } from "#/shared/auth";

// 設定未完、または path が秘匿パスと一致しなければ 404 (FR-012 / FR-014)。
// 比較はサーバー関数の中でだけ行い、秘匿パスをクライアントに渡さない
export const loginConfig = (path?: string) => {
  const config = readAuthConfig(process.env);
  if (!config || (path !== undefined && path !== config.loginPath)) {
    throw notFound();
  }
  return config;
};
