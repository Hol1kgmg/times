import { createRootRoute, HeadContent, Link, Outlet, Scripts } from "@tanstack/react-router";

import appCss from "../styles.css?url";
import kleeOne400Css from "@fontsource/klee-one/400.css?url";
import kleeOne600Css from "@fontsource/klee-one/600.css?url";
import rootLayoutStyles from "./__root.module.css";

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
        <div className={rootLayoutStyles.layout}>
          <nav>
            <Link to="/">Home</Link> |{" "}
            <Link to="/items/$id" params={{ id: "1" }}>
              Item 1
            </Link>{" "}
            | <Link to="/client">Client only</Link>
          </nav>
          <main className={rootLayoutStyles.main}>
            <Outlet />
          </main>
        </div>
        <Scripts />
      </body>
    </html>
  ),
});
