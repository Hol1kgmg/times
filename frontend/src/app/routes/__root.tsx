import { createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";

import kleeOne400Css from "@fontsource/klee-one/400.css?url";
import kleeOne600Css from "@fontsource/klee-one/600.css?url";
// barrel (#/shared/auth) は .server.ts を再 export しており、クライアントで走る beforeLoad から import すると build が落ちる
import { getCurrentAdmin } from "#/shared/auth/get-current-admin";
import { RootLayout } from "../layout/root-layout";
import appCss from "../styles/global.css?url";

// 全文書 SSR: <html> から描画する
export const Route = createRootRoute({
  // ログイン中はサイドバーに管理者向けリンクを出す
  beforeLoad: async () => ({ user: await getCurrentAdmin() }),
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "z_times.dev" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
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
        <RootLayout />
        <Scripts />
      </body>
    </html>
  ),
});
