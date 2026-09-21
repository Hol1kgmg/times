import { createRootRoute, HeadContent, Link, Outlet, Scripts } from "@tanstack/react-router";

// 全文書 SSR: <html> から描画する
export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "times" },
    ],
  }),
  component: () => (
    <html lang="ja">
      <head>
        <HeadContent />
      </head>
      <body>
        <nav>
          <Link to="/">Home</Link> |{" "}
          <Link to="/items/$id" params={{ id: "1" }}>
            Item 1
          </Link>{" "}
          | <Link to="/client">Client only</Link>
        </nav>
        <Outlet />
        <Scripts />
      </body>
    </html>
  ),
});
