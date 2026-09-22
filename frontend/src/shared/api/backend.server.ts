import { createServerOnlyFn } from "@tanstack/react-start";

// backend は frontend のサーバー関数からだけ呼ぶ (adr/backend/0003)。
// URL はサーバー側環境変数から読み、クライアントバンドルに出さない。
const baseUrl = () => process.env.BACKEND_URL ?? "http://localhost:8080";

export const backendFetch = createServerOnlyFn(async (path: string, init?: RequestInit) => {
  const res = await fetch(new URL(path, baseUrl()), init);
  if (!res.ok) {
    throw new Error(`backend ${res.status}: ${init?.method ?? "GET"} ${path}`);
  }
  return res;
});
