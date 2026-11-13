import { SITE_URL } from "#/shared/config/site";
import { getRouter } from "./router";

type Fetch<O> = (request: Request, opts?: O) => Response | Promise<Response>;

const BODY = `# ページが見つかりません

このページは見つかりませんでした。URL が変わったか、なくなったみたいです。

- [最新の Digest](${SITE_URL}/)
- [サイトの案内 (llms.txt)](${SITE_URL}/llms.txt)
- [サイトマップ](${SITE_URL}/sitemap.xml)
`;

const router = getRouter();

// getMatchedRoutes は fuzzy で、/about/x のような余りは "**" に入れて親のルートを返す
const routeExists = (pathname: string) => {
  const [, params, route] = router.getMatchedRoutes(pathname);
  return route !== undefined && !("**" in params);
};

const wantsMarkdown = (request: Request) =>
  (request.method === "GET" || request.method === "HEAD") &&
  (request.headers.get("accept") ?? "").includes("text/markdown");

// TanStack Start はページのルートで HTML 以外の Accept を、ルートが無くても 404 より先に 406 で断る
export const withMarkdownNotFound =
  <O>(fetch: Fetch<O>): Fetch<O> =>
  async (request, opts) => {
    const response = await fetch(request, opts);
    if (
      response.status !== 406 ||
      !wantsMarkdown(request) ||
      routeExists(new URL(request.url).pathname)
    ) {
      return response;
    }
    // ponytail: ルートの有無だけを見るので、/digest/<未登録の日付> のようなローダーの notFound は 406 のまま
    return new Response(request.method === "HEAD" ? null : BODY, {
      status: 404,
      headers: { "content-type": "text/markdown; charset=utf-8", vary: "Accept" },
    });
  };
