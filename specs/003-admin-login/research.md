# Research: 管理者ログイン (backend 起点版)

2026-09-26 に「信頼の起点を backend に置く」へ切り替えた (adr/backend/0007)。frontend 完結版の調査結果のうち引き続き有効なものは R5 / R7 / R8 に残した。API の存在は `frontend/node_modules` と Go module cache の実物で確認した。

## R1. 本人確認をどこで行うか

- **Decision**: GitHub から frontend の callback に戻った `code` を、frontend のサーバー関数が backend の `POST /auth/sessions { code, redirectUri }` に渡す。backend が `POST {GITHUB_BASE_URL}/login/oauth/access_token` で token を得て `GET {GITHUB_API_URL}/user` で `id` / `login` を取り、`ADMIN_GITHUB_LOGIN` と小文字比較する。Client Secret は backend の環境変数のみ。
- **Rationale**: backend が自分で GitHub と話すことで、frontend の申告を信じずに本人確認できる。frontend が交換まで済ませて結果だけ渡す形では、信頼の起点が frontend に残る (0007 の却下案)。
- **Alternatives considered**: backend を OAuth の redirect 先にする: ブラウザが backend に到達する必要が生じ、adr/backend/0003 を壊す。

## R2. session の形と保持

- **Decision**: `sessions(id uuid PK, token_hash bytea UNIQUE NOT NULL, user_id bigint NOT NULL REFERENCES users, created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL)`。トークンは `crypto/rand` 32 バイトを base64url にした文字列で、レスポンスに 1 回だけ出す。DB には `sha256(token)` を置き、照合は `WHERE token_hash = $1 AND expires_at > now()`。`expires_at = created_at + 30 days`、更新しない。ログアウトは `DELETE ... WHERE token_hash = $1` (0 行でも成功)。期限切れの掃除は session 作成時に `DELETE FROM sessions WHERE expires_at < now()` を 1 回走らせる。
- **Rationale**: 不透明トークン + ハッシュ保存は、DB が漏れてもトークンが復元できず、行削除で個別失効できる。JWT は個別失効できない (0007)。掃除を cron や別ジョブにしない: ログイン頻度 (管理者 1 人) で十分で、残っていても照合は `expires_at` で弾く (spec Assumptions)。
- **Alternatives considered**: 平文トークンを DB に置く: 実装は 1 行短いが DB 漏えい時にそのまま使える。`token_hash` の 1 行で防げる。

## R3. backend の照合をどこに置くか

- **Decision**: `openapi.yaml` に `components.securitySchemes.bearerAuth: { type: http, scheme: bearer }` を定義し、管理者専用の操作に `security: [{ bearerAuth: [] }]` を付ける。`newRouter` の `OapiRequestValidatorWithOptions` に `Options.AuthenticationFunc` を渡し、そこで `Authorization: Bearer` を読み、`GetSessionByTokenHash` で照合し、user を `context` に載せる。失敗は `apperr.Unauthorized` を返し、validator の `ErrorHandler` 経由で Problem Details になる。handler は `ctx` から user を取り出す。
- **Verified**: `github.com/oapi-codegen/gin-middleware@v1.1.0` の `Options` は `openapi3filter.Options` を埋め込み、`AuthenticationFunc` を持つ (`kin-openapi@v0.149.0/openapi3filter/options.go`)。`security` を宣言していない操作では呼ばれない。
- **Rationale**: 「どの操作が管理者専用か」が OpenAPI に現れ、生成型と frontend の型にも伝わる (constitution II / V)。handler がヘッダを読まないので framework を触る場所が `newRouter` に閉じる (0001)。
- **Alternatives considered**: Gin の middleware でパス前方一致 (`/digests` の POST など) を守る: 宣言と実装が分かれ、追加した操作を守り忘れる。
- **Note**: Gin の `AuthenticationFunc` から handler へ user を渡す経路は `context.WithValue` ではなく `gin.Context.Set` → strict server の `ctx` へ。oapi-codegen の Gin strict server は `c.Request.Context()` を handler に渡すため、`c.Request = c.Request.WithContext(context.WithValue(...))` で載せる。実装時に `main_test.go` で確認する。

## R4. frontend 側の拒否と期限切れの判別 (FR-014)

- **Decision**:
  - ページ: `beforeLoad` で `throw notFound()`。既存の未定義 URL と同じ表示・同じ 404 ステータス。
  - サーバー関数: `requireAdmin = createMiddleware({ type: "function" }).server(...)`。Cookie が無ければ即 `notFound({ data: { reason: SESSION_EXPIRED } })`、あれば `context.sessionToken` を載せて続行。backend を呼ぶ `backendFetch(path, init, { token })` は Bearer を付け、応答が 401 かつ Problem の `type` が `/problems/unauthorized` なら同じ `notFound(...)` を投げる。管理者向けページのガード `requireAdminPage` は `GET /auth/sessions/current` を呼んで有効性を確かめる。本機能では `requireAdminPage` を使うページを作らず、秘匿パスのページの「ログイン済み判定」で同じ関数を使って動作を確かめる。
  - `SESSION_EXPIRED` は `shared/auth/errors.ts` の文字列定数。後続のページの UI は `isNotFound(e) && e.data?.reason === SESSION_EXPIRED` で再ログインを案内する (案内の形はそのページの仕様)。
- **Rationale**: 書き込み系のサーバー関数は backend 呼び出しに照合が同乗するので、事前の `GET current` を省ける (往復 1 回)。ページ表示は backend を呼ばないので `GET current` が要る。`notFound` を使う理由は前版と同じ: サーバー関数から投げると `isNotFoundResponse` が `data` 込みの 404 JSON にし、クライアント fetcher が `isNotFound` で同じオブジェクトを throw する (`start-server-core/server-functions-handler.js`、`start-client-core/client-rpc/serverFnFetcher.js`)。`Error` は毎回 `console.error` が出て独自プロパティの直列化も保証されず、`Response` はクライアントが JSON を戻り値として返してしまい例外にならない。
- **Alternatives considered**: 戻り値の union: 後続の全サーバー関数の戻り型を汚す。

## R5. 秘匿パスのルーティング (2026-09-26 改訂: ログイン済みはリダイレクトせず表示)

- **Decision**: `app/routes/$loginPath.tsx`。`beforeLoad` で `ADMIN_LOGIN_PATH` と比較し不一致は `notFound()`。Cookie があり `GET current` が通れば `{ user }` を返し、ページはログイン中 (ユーザー名) とログアウトボタンを描画する (FR-009 / FR-010)。通らなければ Cookie を消してログインカードを描画する。`validateSearch: { error?: "forbidden" | "cancelled" | "failed" }`。
- **Rationale**: TanStack Router は静的セグメントを優先するため、既存 URL と重なった秘匿パスは既存画面が勝つ (Edge Case)。管理者専用のページを本機能で作らないため、ログアウトの置き場所は秘匿パスのページになる。トップページは変えない (FR-002)。
- **Alternatives considered**: トップページにログイン中だけログアウトを出す: 002 の画面に条件付き表示が入り、FR-002 と衝突する。

## R6. テスト戦略

- **Decision**:
  - backend: `internal/auth/github_test.go` は `httptest.Server` で GitHub を模す。`handler/auth_test.go` は `Server` の GitHub クライアントと `sessions` 照合を関数値 (`func(ctx, hash) (db.Session, error)`) で差し替え、201 / 403 / 502 と `users` upsert の呼び出しを検証。`cmd/server/main_test.go` は `security` 宣言のある操作にトークンなしで 401、宣言のない `/health` が通ることを検証。DB 接続テストは書かない (constitution V)。
  - frontend: Vitest は `isAllowedPath`、`pickLoginError`、`requireAdmin` / `requireAdminPage` が投げる値の形。Playwright は `e2e/github-mock.mjs` (承認画面に「管理者として承認 / 別アカウントで承認 / キャンセル」の 3 リンク) を立て、backend は compose の実物を `GITHUB_BASE_URL` / `GITHUB_API_URL` をモックに向けて起動する。管理者専用ページが無いため、e2e の「ログイン済み」判定は秘匿パスのページの表示 (ログイン中 / ログインカード) で行う。
- **Rationale**: backend の分岐は Go の単体テストで、通しの受け入れシナリオは実ブラウザ + 実 backend + 実 DB で確認する。constitution V (シナリオ = テスト) を満たす最小の構成。
- **Alternatives considered**: e2e で backend もモック: 照合経路が検証されず、backend 起点にした意味が薄れる。
- **Note**: e2e は compose の `backend` に環境変数を渡す必要があるため、`compose.yaml` に `GITHUB_BASE_URL` 等を `${VAR:-default}` で通す。CI で e2e を回すのは「CI からのデプロイ」(TODO) と一緒に整える。

## R7. ログイン開始の起動方法 (前版から変更なし)

- **Decision**: ログインカードのボタンがサーバー関数 `startGitHubLogin({ path })` を呼ぶ。サーバーは `path` を照合し、state を `times_login` Cookie に入れ、`{ url }` (GitHub authorize URL、`client_id` は frontend の `GITHUB_CLIENT_ID`) を返す。クライアントは `window.location.assign(url)`。
- **Rationale**: 固定 URL の server route で 302 すると秘匿パスを知らない第三者にも仕組みが露出する (FR-006)。`GITHUB_CLIENT_ID` は公開情報なので frontend が持ってよい。

## R8. Cookie の扱い (前版から変更: 暗号化不要)

- **Decision**: `@tanstack/react-start/server` の `setCookie` / `getCookie` / `deleteCookie` を使う。`times_admin` = backend のトークン (HttpOnly, Secure, SameSite=Lax, Path=/, Max-Age 30 日)。`times_login` = OAuth state (同属性、Max-Age 600)。暗号化・署名はしない。
- **Rationale**: トークンは 256 ビットの乱数で、それ自体が秘密。Cookie を暗号化しても守るものが増えない。state は HttpOnly でブラウザから読めず、比較だけで足りる。前版の `useSession` と `SESSION_SECRET` は不要になる。
- **Verified**: `start-server-core/request-response.d.ts` に `getCookie` / `setCookie` / `deleteCookie`。`request-response.js` はイベントに積まれた `set-cookie` を `redirect` 応答にも結合する。

## R9. 環境変数と配布

- **Decision**:
  - backend: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `ADMIN_GITHUB_LOGIN` (必須。どれか欠けると起動時に `slog.Warn` を出し、`POST /auth/sessions` は常に 403 `/problems/forbidden` を返す。他の操作は影響を受けない)、`GITHUB_BASE_URL` / `GITHUB_API_URL` (任意、テスト用)。本番は Secret Manager `github-client-secret` を `--set-secrets`、他は `--set-env-vars` で `be-deploy` に足す。
  - frontend: `ADMIN_LOGIN_PATH`, `GITHUB_CLIENT_ID` (必須)、`GITHUB_BASE_URL` (任意、authorize URL の組み立て用、テストでモックに向ける)。本番は Workers ダッシュボード (`keep_vars = true`)。
  - ローカル: `.envrc` に `dotenv_if_exists .env`。compose は `${GITHUB_CLIENT_ID}` 等を backend に渡す。
- **Rationale**: 既存の配布方式 (Secret Manager / Workers vars / direnv) をそのまま使う。frontend から `GITHUB_CLIENT_SECRET` と `SESSION_SECRET` が消え、秘密は backend にだけ残る。
- **Note**: docs/tech-stack.md と constitution の「backend の環境変数は 2 つ」は実態と乖離しているので、tasks で PATCH 改正を入れる。

## R10. 管理者専用ページの扱い (2026-09-26 改訂: 本機能では作らない)

- **Decision**: `/admin` や pathless layout `_admin.tsx` は置かない。ログイン成功後とログアウト後の遷移先は `/` (FR-018 / FR-008)。後続の仕様 (001 など) が管理者専用ページを足すときは、そのルートの `beforeLoad` で `requireAdminPage()` を呼び、サーバー関数に `requireAdmin` を付ける。
- **Rationale**: 保護対象のページが無い状態で最小ページを作ると、後続の仕様が置き換える前提の捨てコードになる。仕組み (ガード 2 つ) は `shared/auth/` に残し、秘匿パスのページの判定で同じ関数を使うので動作は本機能内で検証できる。
