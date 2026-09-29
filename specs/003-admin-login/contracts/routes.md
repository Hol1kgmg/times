# Contract: frontend のルート・サーバー関数・Cookie

backend の契約は [openapi.md](./openapi.md)、値の形は [../data-model.md](../data-model.md)。

## ページルート

| パス | ファイル | beforeLoad の結果 | 備考 |
|---|---|---|---|
| `/{ADMIN_LOGIN_PATH}/auth/login` | `app/routes/$loginPath.auth.login.tsx` | 不一致 → 404 / ログイン済み → ログイン中 (ユーザー名) + ログアウト / 未ログイン → ログインカード | `validateSearch: { error?: "forbidden" \| "cancelled" \| "failed" }` |
| `/auth/github/callback` | `app/routes/auth.github.callback.tsx` | 常に 302 か 404。描画しない | `validateSearch: { code?: string, state?: string, error?: string }`。state 不一致・欠落・設定未完 → 404 |
| `/`, `/items/$id`, `/client`, `/health` | 既存 | 変更なし | ログイン関連の表示・導線を追加しない (FR-002 / FR-009)。ログイン成功・ログアウト後の遷移先は `/` |

管理者専用のページは本機能では作らない。後続の仕様がページを足すときは `beforeLoad` で `requireAdminPage()` を呼ぶ (未ログイン・期限切れ・失効 → 404)。

404 はすべて `throw notFound()` による Router 既定の表示。SSR ステータスも 404。

## サーバー関数

すべて `createServerFn`。入力は Zod で検証する。backend 呼び出しは `backendFetch(path, init, { token })` で、`X-Backend-Token` と `Authorization: Bearer` を付ける。

| 名前 | method | 入力 | 処理 | 成功時 | 拒否時 |
|---|---|---|---|---|---|
| `resolveLoginPage` | GET | `{ path }` | パス照合。Cookie があれば `GET /auth/sessions/current` | `{ user }` (ログイン済み) または `{}` (未ログイン。401 なら Cookie を消す) | `notFound()` (パス不一致 / 設定未完) |
| `startGitHubLogin` | POST | `{ path }` | パス照合。state 発行 → `times_login` | `{ url }` (authorize URL) | `notFound()` |
| `completeGitHubLogin` | GET | `{ code?, state?, error? }` | `times_login` と `state` を照合 (不一致 → 404)。`times_login` 削除。`error=access_denied` → cancelled。`POST /auth/sessions { code, redirectUri }` | 201 → `times_admin` に token (Max-Age 30 日) → `redirect({ to: "/" })` | 403 → `?error=forbidden`、502 / 通信失敗 → `?error=failed`、いずれもログイン画面へ redirect |
| `logout` | POST | `{ path }` | パス照合。Cookie があれば `DELETE /auth/sessions/current` (401 も成功扱い)。Cookie 削除 | `redirect({ to: "/" })` | `notFound()` (パス不一致 / 設定未完) |

### `requireAdminPage` (後続の管理者専用ページ向け)

`shared/auth/session.server.ts` のサーバー関数 (GET、入力なし)。Cookie なし → `notFound()`。`GET /auth/sessions/current` が 200 → `{ user }`、401 → Cookie を消して `notFound()`。`resolveLoginPage` のログイン済み判定も内部でこれと同じ照合を使う。

### `requireAdmin` middleware (後続の管理者専用サーバー関数向け)

```ts
// shared/auth/session.server.ts
export const requireAdmin = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const token = getCookie(ADMIN_COOKIE);
  if (!token) throw notFound({ data: { reason: SESSION_EXPIRED } });
  return next({ context: { sessionToken: token } });
});
```

- 後続のサーバー関数は `.middleware([requireAdmin])` を付け、`backendFetch(path, init, { token: context.sessionToken })` で backend を呼ぶ
- `backendFetch` は応答が 401 かつ Problem `type === "/problems/unauthorized"` のとき `notFound({ data: { reason: SESSION_EXPIRED } })` を投げる (照合の主体は backend。frontend は結果を写すだけ)
- 呼び出し側 (後続のページの UI) の判定: `isNotFound(e) && e.data?.reason === SESSION_EXPIRED` → 再ログインの案内 (形はそのページの仕様)。`SESSION_EXPIRED` は `shared/auth/errors.ts` の `"session-expired"`
- user id は frontend から送らない。backend が session から取る (data-model.md)

## Cookie

| 名前 | 属性 | 寿命 | 内容 |
|---|---|---|---|
| `times_admin` | HttpOnly, Secure, SameSite=Lax, Path=/ | 30 日 (Max-Age)。実効期限は backend の `expires_at` | backend のトークン (不透明) |
| `times_login` | HttpOnly, Secure, SameSite=Lax, Path=/ | 10 分 | OAuth `state` |

## e2e 用 GitHub モック (`frontend/e2e/github-mock.mjs`)

Node 標準 `http` のみ。backend (compose) と frontend の両方がこのモックを向く。

| パス | 応答 |
|---|---|
| `GET /login/oauth/authorize?redirect_uri&state` | HTML。リンク 3 つ: 「管理者として承認」(`redirect_uri?code=admin&state`)、「別のアカウントで承認」(`code=other`)、「キャンセル」(`redirect_uri?error=access_denied&state`) |
| `POST /login/oauth/access_token` | `{ "access_token": "<code>" }` (code をそのまま token にする) |
| `GET /user` | token `admin` → `{ id: 1, login: "octocat" }`、`other` → `{ id: 2, login: "someone-else" }`、それ以外 → 401 |

env:

| 対象 | 変数 | 値 |
|---|---|---|
| backend (compose) | `GITHUB_BASE_URL`, `GITHUB_API_URL` | `http://host.docker.internal:<mock port>` (Linux CI では `--add-host`) |
| backend (compose) | `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `ADMIN_GITHUB_LOGIN` | `test`, `test`, `octocat` |
| frontend (playwright webServer) | `GITHUB_BASE_URL` | `http://localhost:<mock port>` |
| frontend (playwright webServer) | `GITHUB_CLIENT_ID`, `ADMIN_LOGIN_PATH` | `test`, `e2e-secret-login-path` |

## 受け入れシナリオとテストの対応

| spec | テスト |
|---|---|
| US1-1, US1-8, US2-2, SC-001 | Vitest: `requireAdminPage` が Cookie なし / 401 で `notFound()` を投げる。`requireAdmin` が Cookie なしで拒否する。go test: `GET /auth/sessions/current` がトークンなしで 401 |
| US1-2, SC-005 | e2e: `/not-the-path` → 404。`/auth/github/callback` 直叩き → 404。state 違い → 404 |
| US1-3, FR-018 | e2e: 秘匿パス → 「管理者として承認」→ `/` が表示される |
| US1-4, SC-007 | e2e: 「別のアカウントで承認」→ ログイン画面に forbidden 文言、秘匿パスはログインカードのまま。go test: `CreateSession` が 403 を返し `UpsertUser` を呼ばない |
| US1-5 | e2e: 「キャンセル」→ ログイン画面に cancelled 文言 |
| US1-6, US2-5, SC-006 | e2e: `/` にログイン・ログアウトの文言が無い (ログイン前後とも) |
| US1-7, FR-009, FR-010 | e2e: ログイン後に秘匿パス → ログイン中 (ユーザー名) とログアウトが表示され、ログインボタンは無い |
| US2-1, SC-003 | e2e: ログイン後に新しいコンテキストへ Cookie を引き継いで秘匿パスがログイン中表示になる |
| US2-3, US2-4, SC-004 | e2e: 秘匿パスのログアウトを押すと `/` → 秘匿パスはログインカードに戻る。go test: 削除後の hash で `GET current` が 401 |
| Edge: ログアウト 2 回 | e2e: `logout` を続けて 2 回呼んでもエラーにならない。go test: `DeleteCurrentSession` が存在しない hash でも 204 |
| FR-007 | go test: `expires_at = created_at + 30d` を `CreateSession` が設定。照合クエリは `expires_at > now()` (sqlc 生成で固定) |
| FR-011 | go test: `login` の照合が大文字小文字を無視し、`users.id` に GitHub の `id` を使う |
| FR-012 | go test: 環境変数欠落で `CreateSession` が 403。Vitest: `readAuthConfig({})` が `undefined` |
| FR-014 | Vitest: `requireAdmin` が Cookie なしで `isNotFound` かつ `data.reason === SESSION_EXPIRED` を投げる。`backendFetch` が 401 unauthorized を同じ形に写す |
| FR-015, SC-010 | go test: `security` 宣言のある操作はトークンなし・不正・期限切れで 401。宣言のない `/health` は通る (`main_test.go`) |
| FR-019 | 運用手順 (quickstart)。テストは `GetSessionByTokenHash` が削除後に `ErrNoRows` (sqlc 生成の挙動) で代替 |
