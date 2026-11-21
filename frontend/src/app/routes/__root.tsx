import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect } from "react";

import kleeOne400Css from "@fontsource/klee-one/400.css?url";
import kleeOne600Css from "@fontsource/klee-one/600.css?url";
import kleeOneFixed400 from "../styles/fonts/klee-one-fixed-400.woff2?url";
import kleeOneFixed600 from "../styles/fonts/klee-one-fixed-600.woff2?url";
import { NotFoundPage } from "#/pages/not-found";
import { reportPageView } from "#/shared/api";
import { getCurrentAdmin } from "#/shared/auth";
import { Toaster } from "#/shared/ui/toast";
import {
  FEED_PATH,
  SITE_DESCRIPTION as description,
  SITE_NAME,
  SITE_URL,
} from "#/shared/config/site";
import { RootLayout } from "../layout/root-layout";
import type { FileRoutesById } from "../routeTree.gen";
import appCss from "../styles/global.css?url";

// 除外リストだとログイン画面の秘密のパスまで GA4 に載る。/digest/$date は meta refresh で / へ移り二重に数えるので入れない (specs/014 research R2)
const PUBLIC_ROUTES: ReadonlySet<string> = new Set([
  "/",
  "/about",
  "/contact",
  "/privacy",
  "/_shell/timeline",
] satisfies (keyof FileRoutesById)[]);

// Strict Mode の effect の二重実行と同じ URL への移動で数を増やさないため、描画をまたいで持つ
let lastPath: string | undefined;

const PageView = () => {
  const routeId = useRouterState({ select: (s) => s.matches.at(-1)?.routeId });
  const pathname = useRouterState({ select: (s) => s.matches.at(-1)?.pathname });
  useEffect(() => {
    if (routeId === undefined || pathname === lastPath) {
      return;
    }
    lastPath = pathname;
    if (PUBLIC_ROUTES.has(routeId)) {
      reportPageView();
    }
  }, [routeId, pathname]);
  return null;
};

// 全文書 SSR: <html> から描画する
export const Route = createRootRoute({
  // ログイン中はサイドバーに管理者向けリンクを出す
  beforeLoad: async () => ({ viewer: await getCurrentAdmin() }),
  // notFoundMode: "root" の 404 は root の match に status ではなく _notFound で付く
  head: ({ match }) => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      // meta は CSS 変数を読めないので、ダークの --color-bg を直書きする。ライトはブラウザが地の色から取る
      { name: "theme-color", media: "(prefers-color-scheme: dark)", content: "#1e1f22" },
      ...(match._notFound === true
        ? [
            { title: `ページが見つかりません | ${SITE_NAME}` },
            { name: "robots", content: "noindex" },
          ]
        : [{ title: SITE_NAME }]),
      { name: "description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: SITE_NAME },
      { property: "og:title", content: SITE_NAME },
      { property: "og:description", content: description },
      // クローラーは相対 URL の og:image を解決しない
      { property: "og:image", content: `${SITE_URL}/og.png` },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: `${SITE_NAME} のロゴ` },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      // リーダーがサイトの URL からフィードを見つけるため
      { rel: "alternate", type: "application/rss+xml", title: SITE_NAME, href: FEED_PATH },
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
  notFoundComponent: () => (
    <RootLayout>
      <NotFoundPage />
    </RootLayout>
  ),
  component: () => (
    <html lang="ja">
      <head>
        <HeadContent />
      </head>
      <body>
        <Outlet />
        <Toaster />
        <PageView />
        <Scripts />
      </body>
    </html>
  ),
});
