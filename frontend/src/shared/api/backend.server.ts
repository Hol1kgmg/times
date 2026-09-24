import { createServerOnlyFn } from "@tanstack/react-start";

// backend は frontend のサーバー関数からだけ呼ぶ (adr/backend/0003)。
// URL はサーバー側環境変数から読み、クライアントバンドルに出さない。
const baseUrl = () => process.env.BACKEND_URL ?? "http://localhost:8080";

export const backendFetch = createServerOnlyFn(async (path: string, init?: RequestInit) => {
  // 共有シークレットで backend の到達を制限する。値は Workers の secret (wrangler secret put BACKEND_TOKEN)
  const headers = new Headers(init?.headers);
  const token = process.env.BACKEND_TOKEN ?? "";
  if (token !== "") {
    headers.set("X-Backend-Token", token);
  }
  const res = await fetch(new URL(path, baseUrl()), { ...init, headers });
  if (!res.ok) {
    throw new Error(`backend ${res.status}: ${init?.method ?? "GET"} ${path}`);
  }
  return res;
});
