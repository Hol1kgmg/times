import { createServerOnlyFn } from "@tanstack/react-start";
import { item } from "./schemas";

// サーバー専用境界: .server.ts + createServerOnlyFn でクライアントから import されると実行時に落ちる
// ponytail: インメモリ固定データ。backend の GET /items に繋いだら消す。
// item.parse を通し、backend レスポンスと同じブランド付き型 (Item) で返す
const items = item.array().parse([
  {
    id: "5f4c2a1e-0b7d-4c3e-9a8f-1d2e3f4a5b6c",
    title: "Hello TanStack Start",
    createdAt: "2026-09-01T00:00:00Z",
  },
  {
    id: "6a5d3b2f-1c8e-4d4f-8b9a-2e3f4a5b6c7d",
    title: "File-based routing",
    createdAt: "2026-09-02T00:00:00Z",
  },
  {
    id: "7b6e4c30-2d9f-4e50-9cab-3f4a5b6c7d8e",
    title: "Streaming SSR",
    createdAt: "2026-09-03T00:00:00Z",
  },
]);

export const readItems = createServerOnlyFn(() => items);
