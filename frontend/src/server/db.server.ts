import { createServerOnlyFn } from "@tanstack/react-start";

// サーバー専用境界: .server.ts + createServerOnlyFn でクライアントから import されると実行時に落ちる
// ponytail: インメモリ固定データ。永続化が要るなら SQLite に差し替える。
const items = [
  { id: "1", title: "Hello TanStack Start" },
  { id: "2", title: "File-based routing" },
  { id: "3", title: "Streaming SSR" },
];

export const readItems = createServerOnlyFn(() => items);
