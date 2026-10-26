import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";

import kleeOne400Css from "@fontsource/klee-one/400.css?url";
import kleeOne600Css from "@fontsource/klee-one/600.css?url";
import kleeOneFixed400 from "../styles/fonts/klee-one-fixed-400.woff2?url";
import kleeOneFixed600 from "../styles/fonts/klee-one-fixed-600.woff2?url";
// barrel (#/shared/auth) は .server.ts を再 export しており、クライアントで走る beforeLoad から import すると build が落ちる
import { getCurrentAdmin } from "#/shared/auth/get-current-admin";
import appCss from "../styles/global.css?url";

const description = "見かけて気になった技術や趣味の記事を、日ごとにゆるくまとめてます。";

// 全文書 SSR: <html> から描画する
export const Route = createRootRoute({
  // ログイン中はサイドバーに管理者向けリンクを出す
  beforeLoad: async () => await getCurrentAdmin(),
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      // meta は CSS 変数を読めないので、ダークの --color-bg を直書きする。ライトはブラウザが地の色から取る
      { name: "theme-color", media: "(prefers-color-scheme: dark)", content: "#1e1f22" },
      { title: "z_times.dev" },
      { name: "description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "z_times.dev" },
      { property: "og:title", content: "z_times.dev" },
      { property: "og:description", content: description },
      // クローラーは相対 URL の og:image を解決しない
      { property: "og:image", content: "https://z-times.dev/og.png" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: "z_times.dev のロゴ" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      // フォントの preload は同一オリジンでも crossOrigin が無いと CSS からの取得と別物になり二重に落とす
      ...[kleeOneFixed400, kleeOneFixed600].map((href) => ({
        rel: "preload",
        as: "font",
        type: "font/woff2",
        href,
        crossOrigin: "anonymous" as const,
      })),
      { rel: "stylesheet", href: kleeOne400Css },
      { rel: "stylesheet", href: kleeOne600Css },
      { rel: "stylesheet", href: appCss },
    ],
  }),
  component: () => (
    <html lang="ja">
      <head>
        <HeadContent />
      </head>
      <body>
        <Outlet />
        <Scripts />
      </body>
    </html>
  ),
});
