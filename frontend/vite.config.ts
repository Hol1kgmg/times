import { defineConfig } from "vite";

import { tanstackStart } from "@tanstack/react-start/plugin/vite";

import viteReact from "@vitejs/plugin-react";

// デプロイ先は Cloudflare Workers (wrangler.toml)。ビルド成果物は dist/{client,server}
const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [tanstackStart(), viteReact()],
  // lightningcss(cssMinify)がメディアクエリを `(width<=767px)` のようなrange構文に圧縮すると
  // Safari 16.4未満で判定されず崩れるため、明示的にターゲットを指定して従来のmax-width構文を維持する
  build: {
    cssTarget: ["safari16.3", "ios16.3"],
  },
});

export default config;
