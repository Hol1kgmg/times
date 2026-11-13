import { SITE_URL } from "#/shared/config/site";

type Fetch<O> = (request: Request, opts?: O) => Response | Promise<Response>;

const BODY = `# ページが見つかりません

このページは見つかりませんでした。URL が変わったか、なくなったみたいです。

- [最新の Digest](${SITE_URL}/)
- [サイトの案内 (llms.txt)](${SITE_URL}/llms.txt)
- [サイトマップ](${SITE_URL}/sitemap.xml)
`;

const wantsMarkdown = (request: Request) =>
  request.method === "GET" && (request.headers.get("accept") ?? "").includes("text/markdown");

// TanStack Start はページのルートで HTML 以外の Accept を、ルートが無くても 404 より先に 406 で断る
export const withMarkdownNotFound =
  <O>(fetch: Fetch<O>): Fetch<O> =>
  async (request, opts) => {
    const response = await fetch(request, opts);
    if (response.status !== 406 || !wantsMarkdown(request)) {
      return response;
    }
    const headers = new Headers(request.headers);
    headers.set("accept", "text/html");
    // Node の preview の Request は srvx 製で、new Request(request) では複製できない
    const html = await fetch(new Request(request.url, { headers }), opts);
    await html.body?.cancel();
    if (html.status !== 404) {
      return response;
    }
    return new Response(BODY, {
      status: 404,
      headers: { "content-type": "text/markdown; charset=utf-8", vary: "Accept" },
    });
  };
