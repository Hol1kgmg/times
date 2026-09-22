import { createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";

import kleeOne400Css from "@fontsource/klee-one/400.css?url";
import kleeOne600Css from "@fontsource/klee-one/600.css?url";
import { RootLayout } from "../layout/root-layout";
import appCss from "../styles/global.css?url";

// 全文書 SSR: <html> から描画する
export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "times" },
    ],
    links: [
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
