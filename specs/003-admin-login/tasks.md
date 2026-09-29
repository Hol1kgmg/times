---

description: "Task list for 管理者ログイン (003-admin-login)"
---

# Tasks: 管理者ログイン

**Input**: Design documents from `/specs/003-admin-login/` (2026-09-26 改訂版: backend 起点、範囲はログインと保護の仕組みのみ、ログイン後は `/`、ログアウトは秘匿パスのページ)

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/openapi.md, contracts/routes.md, quickstart.md

**Tests**: constitution V (受け入れシナリオ = テスト) に従い、各 Story にテストタスクを含める。DB に接続するテストは書かない。

**Organization**: Phase 2 で契約 (OpenAPI / マイグレーション / sqlc / Zod) と共通基盤を固め、US1 (ログインと保護) → US2 (維持とログアウト) の順に積む。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 並列可 (別ファイルで、未完了タスクに依存しない)
- **[Story]**: US1 / US2
- 各タスクにファイルパスを書く

## Path Conventions

- backend: `backend/` (Go)。生成物は `backend/internal/api/gen.go`、`backend/internal/db/*.go`、`frontend/src/shared/api/openapi.gen.ts` (`just be-gen`)
- frontend: `frontend/src/` (FSD)。ルートは `frontend/src/app/routes/`、テストは同階層の `*.test.ts` と `frontend/e2e/`

---

## Phase 1: Setup (環境変数の配線)

**Purpose**: 新しい環境変数がローカル・compose・本番に届く経路を先に用意する。コードは触らない。

- [x] T001 `.envrc` に `dotenv_if_exists .env` を追加し、`.gitignore` に `.env` があることを確認する (無ければ追加)。`.env.example` を作り、data-model.md の環境変数 (`GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `ADMIN_GITHUB_LOGIN`, `ADMIN_LOGIN_PATH`, 任意の `GITHUB_BASE_URL`, `GITHUB_API_URL`) を空値で列挙する
- [x] T002 [P] `compose.yaml` の `api` サービスに `GITHUB_CLIENT_ID: ${GITHUB_CLIENT_ID:-}`, `GITHUB_CLIENT_SECRET: ${GITHUB_CLIENT_SECRET:-}`, `ADMIN_GITHUB_LOGIN: ${ADMIN_GITHUB_LOGIN:-}`, `GITHUB_BASE_URL: ${GITHUB_BASE_URL:-https://github.com}`, `GITHUB_API_URL: ${GITHUB_API_URL:-https://api.github.com}` を追加する
- [x] T003 [P] `justfile` の `be-deploy` に `--set-secrets` へ `GITHUB_CLIENT_SECRET=github-client-secret:latest` を、`--set-env-vars` へ `GITHUB_CLIENT_ID={{github_client_id}},ADMIN_GITHUB_LOGIN={{admin_github_login}}` を足し、ファイル先頭の GCP 変数の並びに `github_client_id` と `admin_github_login` を追加する (値は quickstart.md の手順で運用側が埋める)。レシピのコメントに Secret Manager `github-client-secret` が必要な旨を書く

---

## Phase 2: Foundational (契約とスキーマ)

**Purpose**: 両 Story が依存する契約・DB スキーマ・共通ヘルパ。ここが終わるまで Story の実装に入らない。

**⚠️ CRITICAL**: T004〜T006 は同一コミットで再生成 (`just be-gen`) を伴う (constitution II)。

- [x] T004 `backend/api/openapi.yaml` に contracts/openapi.md の断片をそのまま追加する: `components.securitySchemes.bearerAuth` (http / bearer)、`paths./auth/sessions` (post createSession: 201 CreatedSession / 400 / 403 / 502)、`paths./auth/sessions/current` (get getCurrentSession、delete deleteCurrentSession、いずれも `security: [{ bearerAuth: [] }]`、401 Unauthorized)、`components.responses.Unauthorized`、schemas `NewSession` (`code` minLength 1 maxLength 200 必須、`redirectUri` format uri 必須)、`AdminUser` (`id` int64、`login`)、`Session` (`user`, `expiresAt` date-time)、`CreatedSession` (Session + `token`)、`Problem.type` enum に `/problems/forbidden` と `/problems/upstream-failed` を追加。グローバル `security` は置かない
- [x] T005 [P] `backend/db/migrations/000003_create_users_and_sessions.up.sql` / `.down.sql` を作る (`just db-migrate-new create_users_and_sessions` で雛形を作ってよい)。up: `users (id bigint PRIMARY KEY, login text NOT NULL CHECK (login <> ''), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())`、`sessions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), token_hash bytea NOT NULL UNIQUE, user_id bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE, created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL)`。down: `DROP TABLE sessions; DROP TABLE users;`。`user_id` の索引は張らない (`-- ponytail: 管理者 1 人。複数になったら user_id に索引`)
- [x] T006 [P] `backend/db/queries/auth.sql` を作る: `UpsertUser :one` (`INSERT INTO users (id, login) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET login = EXCLUDED.login, updated_at = now() RETURNING *`)、`CreateSession :one` (`INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3) RETURNING *`)、`GetSessionByTokenHash :one` (`SELECT sessions.*, users.login FROM sessions JOIN users ON users.id = sessions.user_id WHERE token_hash = $1 AND expires_at > now()`)、`DeleteSessionByTokenHash :exec` (`DELETE FROM sessions WHERE token_hash = $1`)、`DeleteExpiredSessions :exec` (`DELETE FROM sessions WHERE expires_at < now()`)
- [x] T007 `just be-gen` を実行し、`backend/internal/api/gen.go`、`backend/internal/db/auth.sql.go`、`backend/internal/db/models.go`、`frontend/src/shared/api/openapi.gen.ts` の再生成をコミット対象にする。`api.StrictServerInterface` に `CreateSession` / `GetCurrentSession` / `DeleteCurrentSession` が生えていることを確認する
- [x] T008 [P] `backend/internal/apperr/apperr.go` の `Types` に `"/problems/forbidden": http.StatusForbidden` と `"/problems/upstream-failed": http.StatusBadGateway` を追加し、`Forbidden(detail string) error` と `UpstreamFailed(detail string) error` を足す。`backend/cmd/server/main_test.go` の `TestProblemTypesMatchSpec` が通ることを確認する
- [x] T009 [P] `backend/internal/auth/token.go` を作る: `NewToken() (string, error)` (`crypto/rand` 32 バイト → `base64.RawURLEncoding`、43 文字)、`Hash(token string) []byte` (`sha256.Sum256` のスライス)。`backend/internal/auth/token_test.go` に「2 回呼んで異なる 43 文字が返る」「同じ入力の Hash が等しく長さ 32」のテストを書く
- [x] T010 [P] `frontend/src/shared/auth/errors.ts` に `export const SESSION_EXPIRED = "session-expired" as const;` を置き、`frontend/src/shared/auth/config.server.ts` に Zod で `readAuthConfig(env: NodeJS.ProcessEnv)` を書く: `ADMIN_LOGIN_PATH` は `^[A-Za-z0-9-]{16,}$`、`GITHUB_CLIENT_ID` は空でない文字列、`GITHUB_BASE_URL` は URL で既定 `https://github.com`。必須が欠ければ `undefined` を返す (throw しない)。`frontend/src/shared/auth/index.ts` から re-export する
- [x] T011 [P] `frontend/src/shared/auth/config.server.test.ts` を作る: `readAuthConfig({})` が `undefined`、15 文字のパスが `undefined`、有効な 3 変数で `{ loginPath, clientId, baseUrl }` が返り `baseUrl` の既定値が入ることを検証する
- [x] T012 `frontend/src/shared/api/backend.server.ts` の `backendFetch` に第 3 引数 `{ token?: string }` を足し、あれば `Authorization: Bearer <token>` を付ける。応答が 401 かつ本文 `application/problem+json` の `type === "/problems/unauthorized"` かつ `token` を渡していたときは `throw notFound({ data: { reason: SESSION_EXPIRED } })` (`@tanstack/react-router` の `notFound`)。それ以外の非 2xx は既存どおり `Error`。`X-Backend-Token` の付与は変えない
- [x] T013 [P] `frontend/src/shared/api/backend.server.test.ts` を作る: `fetch` を差し替え、401 unauthorized + token ありで `isNotFound(e) && e.data.reason === SESSION_EXPIRED`、401 だが token なしは `Error`、403 forbidden は `Error` になることを検証する
- [x] T014 `frontend/src/shared/auth/session.server.ts` を作る: 定数 `ADMIN_COOKIE = "times_admin"`、`LOGIN_COOKIE = "times_login"`、Cookie 属性 (`httpOnly: true, secure: true, sameSite: "lax", path: "/"`)、`readAdminToken()` / `writeAdminToken(token)` (Max-Age 2592000) / `clearAdminToken()`、`writeLoginState(state)` (Max-Age 600) / `takeLoginState()` (読んで削除)。`@tanstack/react-start/server` の `getCookie` / `setCookie` / `deleteCookie` を使う。`requireAdmin` middleware (`createMiddleware({ type: "function" })`: Cookie なし → `throw notFound({ data: { reason: SESSION_EXPIRED } })`、あれば `next({ context: { sessionToken } })`) もここに置く
- [x] T015 [P] `frontend/src/shared/auth/session.server.test.ts` を作る: `getCookie` をモックし、`requireAdmin` が Cookie なしで `isNotFound` かつ `data.reason === SESSION_EXPIRED` を投げ、Cookie ありで `context.sessionToken` に値が載ることを検証する

**Checkpoint**: `just be-test`、`just fe-test`、`just be-lint`、`just fe-typecheck` が通る。`just db-up` で `users` / `sessions` が作られる。

---

## Phase 3: User Story 1 - 管理者専用のページ・処理を管理者だけのものにする (Priority: P1) 🎯 MVP

**Goal**: 秘匿パスのログイン画面から GitHub で本人確認し、backend が session を発行する。管理者専用の backend 操作は Bearer で照合され、未ログイン・不正な要求は 404 / 401 になる。ログイン成功後は `/` へ。

**Independent Test**: 秘匿パス以外・callback 直叩き → 404。秘匿パス → 「管理者として承認」→ `/`。「別アカウント」→ forbidden 表示で `users` に行が増えない。トークンなし・不正で `GET /auth/sessions/current` が 401。`/` にログインの表示がない。

### backend

- [x] T016 [US1] `backend/internal/auth/github.go` を作る: `type Client struct { HTTP *http.Client; BaseURL, APIURL, ClientID, ClientSecret string }` と `func (c Client) Exchange(ctx, code, redirectURI string) (User, error)` (`User{ID int64; Login string}`)。`POST {BaseURL}/login/oauth/access_token` に `Accept: application/json` で `{client_id, client_secret, code, redirect_uri}` を JSON 送信し、応答に `error` があるか `access_token` が空なら `apperr.UpstreamFailed`。続けて `GET {APIURL}/user` に `Authorization: Bearer <access_token>`、`User-Agent: times-backend` で `id` / `login` を取る。非 2xx・JSON 不正・通信失敗はすべて `apperr.UpstreamFailed`。`HTTP` の Timeout は呼び元で 10 秒
- [x] T017 [P] [US1] `backend/internal/auth/github_test.go` を作る: `httptest.Server` で GitHub を模し、正常系で `User{ID, Login}` が返る、token 応答に `error` がある、`/user` が 401 を返す、の 3 ケースで `apperr.UpstreamFailed` (`errors.As` で `*apperr.Error` の Status が 502) を検証する
- [x] T018 [US1] `backend/internal/handler/auth.go` を作る: `Server` に `GitHub auth.Client`、`AdminLogin string` (小文字化済み)、`AuthConfigured bool` を持たせ (`handler.New` の引数を増やす)、`CreateSession` を実装する。順序: `AuthConfigured` が false → `apperr.Forbidden("github login is not configured")`。`GitHub.Exchange` → 失敗は error をそのまま返す (502)。`strings.EqualFold(user.Login, AdminLogin)` が false → `apperr.Forbidden("account is not allowed")` (何も保存しない)。一致 → `q.UpsertUser`、`q.DeleteExpiredSessions`、`auth.NewToken`、`q.CreateSession(hash, id, now+30*24h)`。応答 `CreateSession201JSONResponse{ Token, User{Id, Login}, ExpiresAt }`
- [x] T019 [US1] `backend/internal/handler/auth.go` に `GetCurrentSession` を実装する: request context から `auth.Principal` (T020 で定義する `{ UserID int64; Login string; ExpiresAt time.Time; TokenHash []byte }`) を取り出し `200 { user, expiresAt }` を返す。context に無ければ `apperr.Unauthorized("no session in context")` (配線ミスの検出用)
- [x] T020 [US1] `backend/internal/auth/principal.go` を作る: `type Principal struct {...}` (T019 の形)、`WithPrincipal(ctx, p) context.Context`、`PrincipalFrom(ctx) (Principal, bool)` (非公開の context key)
- [x] T021 [US1] `backend/cmd/server/main.go` の `newRouter` に `AuthenticationFunc` を配線する: シグネチャを `newRouter(s api.StrictServerInterface, token string, lookup func(ctx context.Context, hash []byte) (db.GetSessionByTokenHashRow, error)) (*gin.Engine, error)` に変える。`ginmiddleware.Options` に `Options: openapi3filter.Options{ AuthenticationFunc: ... }` を設定し、`SecuritySchemeName == "bearerAuth"` のとき `Authorization` ヘッダから `Bearer ` を剥がし (空・形式不正は `apperr.Unauthorized("missing or invalid bearer token")`)、`auth.Hash` → `lookup`。`pgx.ErrNoRows` は同じ Unauthorized、その他 error はそのまま返す。見つかれば `c.Request = c.Request.WithContext(auth.WithPrincipal(...))`。`ErrorHandler` は `openapi3filter.SecurityRequirementsError` を `errors.As` で拾い、内包の `*apperr.Error` があればそれを、無ければ `apperr.Unauthorized` を `writeProblem` に渡す (それ以外は既存どおり `ValidationFailed`)。`run()` では `os.Getenv` で `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` / `ADMIN_GITHUB_LOGIN` を読み (TrimSpace)、いずれか空なら `slog.Warn("github login is not configured; POST /auth/sessions always 403")` を出して `AuthConfigured=false`、`GITHUB_BASE_URL` / `GITHUB_API_URL` は `cmp.Or` で既定値。`lookup` は `db.New(pool).GetSessionByTokenHash`
- [x] T022 [US1] `backend/cmd/server/main_test.go` を更新する: 既存の `newRouter` 呼び出しに `lookup` (nil 相当のスタブ) を渡す。`TestBearerAuth` を追加し、`lookup` を関数値で差し替えて (1) `GET /auth/sessions/current` がヘッダなし → 401 `/problems/unauthorized`、(2) `Authorization: Basic x` → 401、(3) `Bearer garbage` で lookup が `pgx.ErrNoRows` → 401、(4) lookup が行を返す → stub の `GetCurrentSession` が context の Principal を返し 200、(5) `security` 宣言のない `GET /health` は lookup が呼ばれず 200、を検証する
- [x] T023 [P] [US1] `backend/internal/handler/auth_test.go` を作る: `CreateSession` を `httptest.Server` の GitHub と、`Server` の Queries を差し替えられる形 (`handler.New` に渡す `*pgxpool.Pool` を nil にし、`q` を interface `authQueries { UpsertUser; CreateSession; DeleteExpiredSessions }` に切り出して fake を注入) で検証する: (1) `AuthConfigured=false` → 403 forbidden、(2) GitHub 502 → 502 upstream-failed、(3) login 不一致 (`Octocat` vs `octocat` は一致、`someone` は不一致) → 403 で `UpsertUser` が呼ばれない、(4) 一致 → 201、`users.id` に GitHub の `id`、`expires_at` が `created_at + 30d` (±1 分)、token が 43 文字で応答にだけ現れる。`ponytail:` コメントで「interface は handler テスト用。increase したら sqlc の Querier を使う」と書く

### e2e 基盤

- [x] T024 [P] [US1] `frontend/e2e/github-mock.mjs` を作る (Node 標準 `http` のみ、`PORT` 環境変数、既定 3100): `GET /login/oauth/authorize?redirect_uri&state` → HTML でリンク 3 つ「管理者として承認」(`{redirect_uri}?code=admin&state={state}`)、「別のアカウントで承認」(`code=other`)、「キャンセル」(`{redirect_uri}?error=access_denied&state={state}`)。`POST /login/oauth/access_token` → `{ "access_token": "<code>" }`。`GET /user` → Bearer `admin` は `{ "id": 1, "login": "octocat" }`、`other` は `{ "id": 2, "login": "someone-else" }`、それ以外は 401
- [x] T025 [US1] `frontend/playwright.config.ts` の `webServer` を配列にする: (1) `node e2e/github-mock.mjs` (`url: http://localhost:3100/user` は 401 を返すので `ignoreHTTPSErrors` ではなく `url` に `/login/oauth/authorize` を使う)、(2) `pnpm dev` に `env: { ADMIN_LOGIN_PATH: "e2e-secret-login-path", GITHUB_CLIENT_ID: "test", GITHUB_BASE_URL: "http://localhost:3100" }`。`reuseExistingServer` は既存どおり
- [x] T026 [US1] `justfile` に `be-dev-e2e` を追加する: `GITHUB_CLIENT_ID=test GITHUB_CLIENT_SECRET=test ADMIN_GITHUB_LOGIN=octocat GITHUB_BASE_URL=http://host.docker.internal:3100 GITHUB_API_URL=http://host.docker.internal:3100 docker compose up --build api` (コメントに「e2e 用。Linux CI では `--add-host=host.docker.internal:host-gateway` が要る」と書く)。quickstart.md の「5. 自動テスト」の手順と一致させる

### frontend

- [x] T027 [US1] `frontend/src/pages/admin-login/api/resolve-login-page.ts` を作る: `createServerFn({ method: "GET" })`、入力 `z.object({ path: z.string() })`。`readAuthConfig(process.env)` が `undefined` または `path !== loginPath` → `throw notFound()`。`readAdminToken()` があれば `backendFetch("/auth/sessions/current", {}, { token })` を試み、200 なら `{ user: { id, login } }`、`isNotFound` (401) なら `clearAdminToken()` して `{}`。Cookie なしは `{}`
- [x] T028 [P] [US1] `frontend/src/pages/admin-login/api/start-github-login.ts` を作る: `createServerFn({ method: "POST" })`、入力 `z.object({ path: z.string() })`。設定未完・パス不一致 → `throw notFound()`。`crypto.randomUUID()` を state にして `writeLoginState(state)`。`redirect_uri` は `new URL("/auth/github/callback", getRequestURL().origin)` (`@tanstack/react-start/server` の `getRequestURL`; 無ければ `getRequest().url`)。`{ url }` = `{GITHUB_BASE_URL}/login/oauth/authorize?client_id&redirect_uri&state&scope=` (scope 空 = 公開プロフィールのみ、FR-017)
- [x] T029 [P] [US1] `frontend/src/pages/admin-login/api/complete-github-login.ts` を作る: `createServerFn({ method: "GET" })`、入力 `z.object({ code: z.string().optional(), state: z.string().optional(), error: z.string().optional() })`。設定未完 → `throw notFound()`。`takeLoginState()` (読んで削除) と `state` が両方あり一致しなければ `throw notFound()`。`error === "access_denied"` → `throw redirect({ to: "/$loginPath", params: { loginPath }, search: { error: "cancelled" } })`。`code` なし → `notFound()`。`backendFetch("/auth/sessions", { method: "POST", body: JSON.stringify({ code, redirectUri }) })` を `try/catch` し、201 → `writeAdminToken(token)` → `throw redirect({ to: "/" })`。403 → `search: { error: "forbidden" }`、502 / 通信失敗 → `search: { error: "failed" }` でログイン画面へ redirect (backendFetch が `Error` を投げるので、`Error` の message から status を判別するのではなく、`backendFetch` に `{ allow: [403, 502] }` 相当の分岐を足すか、ここだけ `fetch` の `Response` を返す `backendFetchRaw` を `shared/api/backend.server.ts` に追加する。後者を採用し、`backendFetch` はそれを包む形に整理する)
- [x] T030 [P] [US1] `frontend/src/pages/admin-login/api/pick-login-error.ts` を作る: `pickLoginError(status: number | "network"): "forbidden" | "failed"` (403 → forbidden、それ以外 → failed) と `frontend/src/pages/admin-login/api/pick-login-error.test.ts` (3 ケース)。T029 はこれを使う
- [x] T031 [US1] `frontend/src/pages/admin-login/ui/login-page.tsx` と `login-page.module.css` を作る: Figma の「ログインカード」に従い、白背景 + 1px 境界線、`--radius-panel`、`--shadow-raised`、内側は `--space-3`。見出し (`composes: t-label from global`)、「GitHub でログイン」ボタン (`--radius-control`)、`error` search に応じた文言 (`forbidden`: 「このアカウントは管理者として許可されていません」、`cancelled`: 「GitHub での承認がキャンセルされました」、`failed`: 「GitHub との通信に失敗しました。もう一度お試しください」) を `--color-text-muted` で。ボタンは `startGitHubLogin({ data: { path } })` を呼び `window.location.assign(url)`。ログイン済み表示 (US2 の T038) の枠だけ `props.user` で分岐する
- [x] T032 [US1] `frontend/src/pages/admin-login/index.ts` から `resolveLoginPage`, `startGitHubLogin`, `completeGitHubLogin`, `LoginPage` を export する
- [x] T033 [US1] `frontend/src/app/routes/$loginPath.tsx` を作る: `createFileRoute("/$loginPath")`、`validateSearch` は Zod で `{ error: z.enum(["forbidden", "cancelled", "failed"]).optional() }`、`beforeLoad: ({ params }) => resolveLoginPage({ data: { path: params.loginPath } })` の戻りを `loaderData` 相当として `component` に渡す (`beforeLoad` の戻り値を context に載せ、`Route.useRouteContext()` で読む)。`notFound` は Router 既定の 404 に任せる。`head` に `{ title: "times" }` のみ (ログインの存在を title に出さない)
- [x] T034 [P] [US1] `frontend/src/app/routes/auth.github.callback.tsx` を作る: `createFileRoute("/auth/github/callback")`、`validateSearch` は Zod で `{ code?, state?, error? }` (すべて optional string)、`beforeLoad: ({ search }) => completeGitHubLogin({ data: search })` (常に redirect か notFound を throw する)。`component` は `null` を返す
- [x] T035 [US1] `just fe-generate-routes` を実行し `frontend/src/routeTree.gen.ts` を更新する。`just fe-typecheck` と `just fe-lint` と `just fe-lint-markup` が通ることを確認する
- [x] T036 [US1] `frontend/e2e/admin-login.spec.ts` を作る (前提: `just db-up` と `just be-dev-e2e` が起動済み)。US1 のシナリオ: (1) `/not-the-path` → 404 表示 (`page.getByText("Not Found")` など Router 既定の文言。`e2e/index.spec.ts` と同じ判定方法) かつ本文に「ログイン」が無い、(2) `/auth/github/callback` 直叩き → 404、(3) `/auth/github/callback?code=admin&state=wrong` → 404、(4) `/e2e-secret-login-path` → ログインカード、(5) ボタン → モック → 「管理者として承認」→ URL が `/` になりトップページが表示される、(6) 「別のアカウントで承認」→ `/e2e-secret-login-path?error=forbidden` に戻り文言が出る、(7) 「キャンセル」→ `?error=cancelled`、(8) ログイン前後で `/` に「ログイン」「ログアウト」の文言が無い。各テストは `browser.newContext()` で Cookie を分ける

**Checkpoint**: `just be-test` / `just fe-test` / `just fe-test-e2e` (US1 のケース) が通る。quickstart.md の手動確認 1〜5、10〜12 が期待どおり。

---

## Phase 4: User Story 2 - ログイン状態を保ち、任意にログアウトする (Priority: P2)

**Goal**: 30 日の Cookie で再訪時もログイン済みになる。秘匿パスのページがログイン中 (ユーザー名) とログアウトを表示し、ログアウトで session 行と Cookie を消して `/` へ。ログアウトは冪等。

**Independent Test**: ログイン後に新しいコンテキストへ Cookie を引き継ぎ、秘匿パスがログイン中表示になる。ログアウト → `/` → 秘匿パスはログインカードに戻る。`logout` を 2 回続けてもエラーにならない。`DELETE /auth/sessions/current` は存在しない hash でも 204。

### backend

- [x] T037 [US2] `backend/internal/handler/auth.go` に `DeleteCurrentSession` を実装する: context の `Principal.TokenHash` で `q.DeleteSessionByTokenHash` (0 行でもエラーにしない) → `204`。`backend/internal/handler/auth_test.go` に「fake の Delete が `nil` を返せば 204」「Principal なし → 401」を追加する。`authQueries` interface に `DeleteSessionByTokenHash` を足す
- [x] T038 [P] [US2] `backend/cmd/server/main_test.go` の `TestBearerAuth` に `DELETE /auth/sessions/current` がヘッダなしで 401、lookup が行を返せば stub 経由で 204、を追加する

### frontend

- [x] T039 [US2] `frontend/src/pages/admin-login/api/logout.ts` を作る: `createServerFn({ method: "POST" })`、入力 `z.object({ path: z.string() })`。設定未完・パス不一致 → `throw notFound()`。`readAdminToken()` があれば `backendFetch("/auth/sessions/current", { method: "DELETE" }, { token })` を `try/catch` (401 の `notFound` も握りつぶす。それ以外の失敗は `console.error` して続行)。`clearAdminToken()` → `throw redirect({ to: "/" })`。`index.ts` から export する
- [x] T040 [P] [US2] `frontend/src/pages/admin-login/api/logout.test.ts` を作る: `getCookie` / `deleteCookie` / `fetch` をモックし、Cookie なしでも backend を呼ばず redirect を投げる、Cookie ありで DELETE が呼ばれ Cookie が消える、DELETE が 401 でも redirect になる、の 3 ケース
- [x] T041 [US2] `frontend/src/pages/admin-login/ui/login-page.tsx` にログイン済み表示を実装する: `user` があるとき、ログインカードの代わりに「ログイン中: {login}」(`--color-status` のドット + `t-body`) と「ログアウト」ボタン (`--color-fill-subtle` 背景、`--radius-control`)。ボタンは `<form>` で `logout({ data: { path } })` を呼ぶ (JS なしでも動く `action` は不要。`useServerFn` + `onClick` で可)。ログインボタンは出さない (FR-010)
- [x] T042 [US2] `frontend/e2e/admin-login.spec.ts` に US2 のシナリオを追加する: (1) 管理者として承認したコンテキストの `storageState` を保存し、新しいコンテキストで `/e2e-secret-login-path` を開くと「ログイン中: octocat」とログアウトが表示されログインボタンが無い、(2) ログアウトを押すと `/` に移り、再度秘匿パスを開くとログインカードに戻る、(3) ログアウト直後にもう一度 `POST` の `logout` を (ページを再表示してボタンを押して) 実行してもエラー表示にならず `/` に移る、(4) Cookie の `times_admin` が `HttpOnly` かつ `Max-Age` ≒ 2592000 (`context.cookies()` の `expires` が 29〜31 日後)

**Checkpoint**: `just fe-test-e2e` が全ケース通る。quickstart.md の手動確認 6〜9 が期待どおり。

---

## Phase 5: Polish & Cross-Cutting Concerns

- [x] T043 [P] `docs/admin-login.md` を作り、quickstart.md の「1. GitHub OAuth App」「3. 環境変数」「6. 運用: 変更と失効」を運用手順として写す。`README.md` から 1 行リンクする
- [x] T044 [P] `docs/tech-stack.md` の「環境変数は `DATABASE_URL` と `PORT` の 2 つ」を、`BACKEND_TOKEN`、`GITHUB_CLIENT_ID`、`GITHUB_CLIENT_SECRET`、`ADMIN_GITHUB_LOGIN` (任意: `GITHUB_BASE_URL`、`GITHUB_API_URL`) を含む一覧に更新する。frontend の節に `ADMIN_LOGIN_PATH`、`GITHUB_CLIENT_ID`、`GITHUB_BASE_URL` を追記する。「認証は未決」を「GitHub OAuth + backend session (adr/backend/0007)」に直す
- [x] T045 `/speckit-constitution` で PATCH 改正 (1.1.0 → 1.1.1): 「環境変数は `DATABASE_URL` と `PORT` のみ」を「環境変数の一覧は docs/tech-stack.md が正」に改める。Sync Impact Report を先頭コメントに残す
- [x] T046 [P] `adr/backend/README.md` の索引に 0007 が載っていることを確認し、0007 の「実装の場所」から削除した `pages/admin/` の整合を再確認する
- [x] T047 [P] `backend/api/http/auth.http` を作り、`POST /auth/sessions`、`GET /auth/sessions/current` (Bearer)、`DELETE /auth/sessions/current` の手動リクエスト例を置く (既存の `items.http` と同じ形式)
- [ ] T048 quickstart.md の「4. 動作確認」を実 GitHub OAuth App (ローカル用) で 1〜12 まで通し、結果を `TODO.md` の 003 の行に日付付きで記録する。CI で e2e を回す件は `TODO.md` に「CI からのデプロイと一緒に整える」と残す
- [x] T049 `just lint && just test` と `just be-gen` 差分なしを最終確認する

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 依存なし。T001〜T003 は並列可
- **Foundational (Phase 2)**: T004 → T007 (再生成)。T005 / T006 は T004 と並列。T008〜T015 は T007 の後 (生成型を使う)。T012 → T013、T014 → T015
- **US1 (Phase 3)**: Phase 2 完了後。backend: T016 → T017、T020 → T019 / T021、T018 → T023、T021 → T022。frontend: T027〜T030 → T031 → T032 → T033 / T034 → T035 → T036。e2e 基盤 T024〜T026 は frontend と並列
- **US2 (Phase 4)**: US1 完了後 (ログイン済み状態が前提)。T037 → T038、T039 → T040、T031 → T041、T041 + T039 → T042
- **Polish (Phase 5)**: US1 / US2 完了後。T043 / T044 / T046 / T047 は並列。T045 は T044 の後。T048 → T049

### User Story Dependencies

- **US1 (P1)**: Phase 2 のみに依存。単体で「ログイン → `/`」と「未ログインは 404 / 401」を検証できる
- **US2 (P2)**: US1 のログイン経路を使う。ログアウト API と Cookie の寿命は US1 の成果物 (T014 の Cookie ヘルパ、T021 の照合) の上に足す

### Parallel Opportunities

- Phase 2: T005 / T006 (SQL) と T004 (OpenAPI) を同時に書ける。T008〜T011、T013、T015 は互いに別ファイル
- US1: backend (T016〜T023) と frontend (T027〜T035) と e2e 基盤 (T024〜T026) を 3 系統で進められる
- US2: T037 / T038 (backend) と T039 / T040 (frontend) は並列

---

## Parallel Example: User Story 1

```bash
# backend と frontend と e2e 基盤を同時に:
Task: "T016 backend/internal/auth/github.go に Exchange を実装"
Task: "T028 frontend/src/pages/admin-login/api/start-github-login.ts"
Task: "T024 frontend/e2e/github-mock.mjs"

# backend のテストを同時に:
Task: "T017 backend/internal/auth/github_test.go"
Task: "T023 backend/internal/handler/auth_test.go"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 (環境変数の配線) → Phase 2 (契約・スキーマ・共通ヘルパ)
2. Phase 3 (US1): backend の session 発行と照合、frontend のログイン画面と callback、e2e 基盤
3. **STOP and VALIDATE**: `just be-test` / `just fe-test` / `just fe-test-e2e`。quickstart.md の 1〜5、10〜12
4. この時点で「管理者専用」の仕組み (`security: [bearerAuth]`、`requireAdmin`、`backendFetch` の 401 写し) は使える。後続の仕様 (001) はここから着手できる

### Incremental Delivery

1. US1 → ログインできる、守れる (MVP)
2. US2 → 30 日維持、ログアウト
3. Polish → 運用ドキュメント、constitution の追随、最終確認

---

## Notes

- 秘匿パス (`ADMIN_LOGIN_PATH`) をクライアントバンドル・共通資材・`title` に出さない (FR-014)。サーバー関数の中でだけ比較する
- 404 は `throw notFound()` に統一し、独自の 404 画面を作らない (spec Assumptions)
- 平文トークンをログに出さない。`accessLog` は `Authorization` ヘッダを出力していないことを確認する
- `Secure` Cookie は `http://localhost` でもブラウザが受け付ける (Chrome / Firefox)。e2e はそのまま動く
- コミットは依頼があるまで行わない。T007 の生成物は T004〜T006 と同じコミットに含める

## 実装時の差分 (2026-09-29)

- T024: モックは `frontend/e2e/github-mock.ts` (Node 24 が型を剥がして直接実行。`.mjs` だと type-aware lint が通らない)
- T025: `E2E_PORT` (既定 3001。2026-09-30 に 3000 から変更) で dev server のポートを変えられる。実 GitHub 向けの dev server が 3000 で動いていても e2e を回すため
- T027〜T029 / T039: サーバー専用ロジックは `*.server.ts` (`login-config.server.ts`、`callback-url.server.ts`、`logout.server.ts`) に置き、`createServerFn` の handler からだけ参照する。Start の import-protection が `.server` 以外のファイルからの到達を拒否するため
- T014: contracts/routes.md の `requireAdminPage` と、その中身 `currentAdmin()` も `shared/auth/session.server.ts` に置いた (resolveLoginPage が同じ照合を使う)
- T029: `shared/api/index.ts` の `ApiResponse` に第 2 型引数 (status、既定 200) を足し、`ApiResponse<"createSession", 201>` で 201 の型を取る
- T042 (3): 「logout を 2 回」は、1 回目で backend の行が消えると 2 回目のコンテキストはログインカードに戻りログアウトボタンが出ないため、「同じ Cookie を持つ別コンテキストも失効する」の検証に置き換えた。logout の冪等性 (Cookie なし / 401) は `logout.test.ts` と backend の go test で担保
- T036 の 404 判定と、クリック前の `waitForLoadState("networkidle")` (SSR 直後は onClick が未接続)
- `just fe-lint-markup` は既存の `__root.tsx` (`<HeadContent />` に対する title / charset の指摘) で落ちる。本機能の変更とは無関係
- T001: `.env` はデプロイ先ごとに `backend/.env` と `frontend/.env` に分けた (`.envrc` が両方を読む。雛形も各ディレクトリの `.env.example`)。compose の `${GITHUB_CLIENT_ID:-}` は direnv が export したシェル環境変数から展開されるので変更なし
- T048 (実 GitHub OAuth App での手動確認) は未実施。OAuth App の作成と `backend/.env` / `frontend/.env` の記入が要る
