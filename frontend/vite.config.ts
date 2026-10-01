import { defineConfig, type Plugin } from "vite";

import { tanstackStart } from "@tanstack/react-start/plugin/vite";

import viteReact from "@vitejs/plugin-react";

// fontsource は swap 固定で、フォント到着時に差し替わってチラつく
const fontDisplayBlock: Plugin = {
  name: "fontsource-font-display-block",
  enforce: "pre",
  transform(code, id) {
    if (!/@fontsource\/.*\.css/.test(id)) return;
    return code.replaceAll("font-display: swap;", "font-display: block;");
  },
};

// デプロイ先は Cloudflare Workers (wrangler.toml)。ビルド成果物は dist/{client,server}
const config = defineConfig({
  resolve: { tsconfigPaths: true },
  // FSD: ルーティング関連は src/app/ に集約する (tsr.config.json と揃える)
  plugins: [
    fontDisplayBlock,
    tanstackStart({
      // パスは srcDirectory (src) 基準
      router: {
        entry: "./app/router.tsx",
        routesDirectory: "./app/routes",
        generatedRouteTree: "./app/routeTree.gen.ts",
      },
    }),
    viteReact(),
  ],
  // lightningcss(cssMinify)がメディアクエリを `(width<=767px)` のようなrange構文に圧縮すると
  // Safari 16.4未満で判定されず崩れるため、明示的にターゲットを指定して従来のmax-width構文を維持する
  build: {
    cssTarget: ["safari16.3", "ios16.3"],
  },
});

export default config;
