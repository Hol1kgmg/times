// e2e 用の GitHub モック (specs/003-admin-login/contracts/routes.md)。Node 標準 http のみ。
// backend (compose) と frontend (dev server) の両方がここを向く。Node 24 が型を剥がして直接実行する
import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";

const port = Number(process.env.PORT ?? 3100);
const users: Record<string, { id: number; login: string }> = {
  admin: { id: 1, login: "octocat" },
  other: { id: 2, login: "someone-else" },
};

const json = (res: ServerResponse, status: number, body: unknown) => {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
};

const authorizePage = (url: URL) => {
  // Playwright の起動確認は redirect_uri なしで叩くので既定値を置く
  const redirectUri =
    url.searchParams.get("redirect_uri") ?? "http://localhost:3000/auth/github/callback";
  const state = url.searchParams.get("state") ?? "";
  const link = (label: string, params: Record<string, string>) => {
    const u = new URL(redirectUri);
    for (const [k, v] of Object.entries(params)) {
      u.searchParams.set(k, v);
    }
    u.searchParams.set("state", state);
    return `<li><a href="${u.toString()}">${label}</a></li>`;
  };
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>GitHub mock</title></head><body>
<h1>GitHub mock</h1><ul>
${link("管理者として承認", { code: "admin" })}
${link("別のアカウントで承認", { code: "other" })}
${link("キャンセル", { error: "access_denied" })}
</ul></body></html>`;
};

const readBody = async (req: IncomingMessage) => {
  let body = "";
  for await (const chunk of req) {
    body += String(chunk);
  }
  return body;
};

const handle = async (req: IncomingMessage, res: ServerResponse) => {
  const url = new URL(req.url ?? "/", `http://localhost:${port}`);
  if (req.method === "GET" && url.pathname === "/login/oauth/authorize") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(authorizePage(url));
    return;
  }
  if (req.method === "POST" && url.pathname === "/login/oauth/access_token") {
    const body: unknown = JSON.parse(await readBody(req));
    const code =
      typeof body === "object" && body !== null && "code" in body && typeof body.code === "string"
        ? body.code
        : "";
    // code をそのまま token にする
    json(res, 200, { access_token: code, token_type: "bearer" });
    return;
  }
  if (req.method === "GET" && url.pathname === "/user") {
    const token = (req.headers.authorization ?? "").replace(/^Bearer /u, "");
    const user = users[token];
    if (user === undefined) {
      json(res, 401, { message: "Bad credentials" });
    } else {
      json(res, 200, user);
    }
    return;
  }
  json(res, 404, { message: "Not Found" });
};

createServer((req, res) => {
  void handle(req, res);
}).listen(port, () => {
  console.log(`github mock listening on http://localhost:${port}`);
});
