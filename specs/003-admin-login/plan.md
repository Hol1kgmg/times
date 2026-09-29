# Implementation Plan: 管理者ログイン

**Branch**: `003-admin-login` | **Date**: 2026-09-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-admin-login/spec.md` (2026-09-26 改訂版: 信頼の起点を backend に置く。adr/backend/0007)

## Summary

GitHub OAuth で管理者 1 人がログインし、「管理者専用」と宣言したページ・サーバー処理をその管理者にだけ開放する仕組みを作る。具体的な管理者専用ページは作らない (後続の 001 などが使う)。GitHub との本人確認、ログイン状態 (session) の発行・照合・失効は backend が行い、`users` / `sessions` テーブルに記録する。frontend はログイン画面を秘匿パスに出し、GitHub から戻った `code` を backend に渡し、返ってきた不透明トークンを HttpOnly Cookie で運ぶだけにする。ログイン後はトップページ `/` に遷移し、ログイン済みで秘匿パスを開くとログイン中表示とログアウトを出す。管理者専用の backend 操作は OpenAPI の `security` で宣言し、要求ごとに backend が照合する。未ログイン・不正な要求はすべて既存の 404 と同じ表示にする。新しい依存は追加しない。

## Technical Context

**Language/Version**: backend Go 1.26 / Gin + oapi-codegen strict server / sqlc + pgx v5 / PostgreSQL 18。frontend TypeScript strict / React 19 / TanStack Start 1.168 + Router 1.170

**Primary Dependencies**: 既存のみ。backend は `net/http` (GitHub 呼び出し)、`crypto/rand` + `crypto/sha256` (トークン)、kin-openapi の `AuthenticationFunc` (照合の配線)。frontend は `@tanstack/react-start/server` の Cookie ヘルパと `zod`

**Storage**: PostgreSQL。`users` (管理者の記録) と `sessions` (ログイン状態) を追加。既存テーブルは変更しない

**Testing**: backend `go test` (GitHub は `httptest.Server`、DB は既存方針どおり接続しない。handler の DB 依存は `sessions` 照合を関数値にして差し替える)。frontend Vitest (純粋関数) + Playwright (GitHub モックを立て、backend は compose の実物を使って通しで検証)

**Target Platform**: backend Cloud Run (asia-northeast1)、frontend Cloudflare Workers。ローカルは compose + `vite dev`

**Project Type**: web (backend + frontend)

**Performance Goals**: 管理者向けページの表示ごとに Workers → backend の照合 1 回 (索引参照 1 行)。書き込み操作は照合が同乗するので追加なし

**Constraints**: 未ログイン要求は既存の 404 と区別できないこと (SC-001 / SC-005)。秘匿パスは全画面共通の資材に含めない (FR-014)。トップページは変更しない (FR-002 / FR-018)。ブラウザは backend に到達しない (adr/backend/0003)。共有シークレットは維持 (adr/backend/0006)

**Scale/Scope**: 管理者 1 人。backend: マイグレーション 1 本、OpenAPI 操作 3 つ、環境変数 3 つ。frontend: ルート 2 つ、サーバー関数 4 つ + ガード 2 つ (middleware / ページ用)、環境変数 2 つ

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原則 | 判定 | 根拠 |
|---|---|---|
| I. 仕様駆動 | PASS | spec.md を 2026-09-26 に改訂 (FR-015 / FR-019 / SC-010)。判断は adr/backend/0007 に記録。本 plan 承認後に tasks へ |
| II. 契約ファースト | PASS | `/auth/sessions` と `securitySchemes` を `openapi.yaml` に書き、strict server の生成 interface を実装する。DB は `db/queries/auth.sql` から sqlc 生成。`Problem.type` の enum と `apperr.Types` を同時更新 (既存テストが一致を検証) |
| III. サーバー関数経由のみ | PASS | ブラウザは frontend のサーバー関数としか話さない。GitHub の authorize へは遷移するが backend には到達しない。サーバー関数の入力は Zod で検証 |
| IV. 最小実装 | PASS | 新規依存なし。ロール列・JWT・リポジトリ層は置かない (0007 で却下理由を記録)。テスト用に GitHub のベース URL を環境変数で差し替える (backend 2 つ、frontend 1 つ) 以外の設定は足さない |
| V. テストとスキーマ | PASS | 要件は OpenAPI (`security`、`/auth/sessions`)、マイグレーション (`users` / `sessions`、期限・一意制約)、Zod (環境変数・検索パラメータ) に落とす。受け入れシナリオは Playwright で 1 本ずつ、照合の分岐は `go test` で検証 |

Post-design 再確認 (Phase 1 後): 違反なし。constitution の「backend の環境変数は `DATABASE_URL` と `PORT` のみ」は既に `BACKEND_TOKEN` で乖離しており、本機能で 3 つ増える。`/speckit-constitution` での PATCH 改正を tasks に含める (Complexity Tracking ではなく文書の追随)。

## Project Structure

### Documentation (this feature)

```text
specs/003-admin-login/
├── plan.md              # 本ファイル
├── research.md          # Phase 0: 技術判断と根拠
├── data-model.md        # Phase 1: users / sessions、Cookie、環境変数、状態遷移
├── quickstart.md        # Phase 1: OAuth App、環境変数、動作確認、テスト、運用
├── contracts/
│   ├── openapi.md       # Phase 1: openapi.yaml への追加分 (YAML 断片) と照合の規則
│   └── routes.md        # Phase 1: frontend のルート・サーバー関数・Cookie、テスト対応表
└── tasks.md             # Phase 2 (/speckit-tasks で生成)
```

### Source Code (repository root)

```text
backend/
├── api/openapi.yaml                       # securitySchemes.bearerAuth、/auth/sessions、Problem.type 追加
├── db/
│   ├── migrations/000003_create_users_and_sessions.{up,down}.sql
│   └── queries/auth.sql                   # UpsertUser, CreateSession, GetSessionByTokenHash, DeleteSession, DeleteExpiredSessions
├── internal/
│   ├── api/gen.go                         # 再生成 (just be-gen)
│   ├── db/{auth.sql.go,models.go}         # 再生成
│   ├── apperr/apperr.go                   # Forbidden (403), UpstreamFailed (502)
│   ├── auth/
│   │   ├── github.go                      # code → token → user。ベース URL は引数
│   │   ├── token.go                       # NewToken (32 bytes base64url), Hash (sha256)
│   │   └── *_test.go
│   └── handler/
│       ├── auth.go                        # CreateSession / GetCurrentSession / DeleteCurrentSession
│       └── auth_test.go
└── cmd/server/
    ├── main.go                            # AuthenticationFunc の配線、環境変数 3 つの読み取り
    └── main_test.go                       # security 宣言あり/なしの操作でトークン要否が変わることを検証

frontend/
├── src/
│   ├── app/routes/
│   │   ├── $loginPath.tsx                 # 秘匿パス。未ログイン: ログインカード / ログイン済み: ログイン中 + ログアウト
│   │   └── auth.github.callback.tsx       # GitHub からの戻り先。redirect / notFound のみ
│   ├── pages/
│   │   └── admin-login/{api,ui}/…         # resolve-login-page, start-github-login, complete-github-login, logout, login-page
│   └── shared/
│       ├── api/backend.server.ts          # Bearer の転送。401 (unauthorized) を notFound(SESSION_EXPIRED) に写す
│       └── auth/
│           ├── config.server.ts           # ADMIN_LOGIN_PATH, GITHUB_CLIENT_ID (+ GITHUB_BASE_URL)
│           ├── session.server.ts          # Cookie 読み書き、requireAdmin middleware、requireAdminPage (後続のページ用ガード)
│           ├── errors.ts                  # SESSION_EXPIRED
│           └── index.ts
├── e2e/
│   ├── github-mock.mjs                    # authorize / access_token / user を模した最小 HTTP サーバー
│   └── admin-login.spec.ts
└── playwright.config.ts                   # webServer を配列にし、モックと dev server を起動。env を注入

compose.yaml                               # backend に GITHUB_* / ADMIN_GITHUB_LOGIN を渡す (ローカル・e2e 用)
justfile                                   # be-deploy の --set-secrets に github-client-secret、--set-env-vars に client id / login
.envrc                                     # dotenv_if_exists .env
docs/tech-stack.md, docs/admin-login.md    # 環境変数の一覧、運用手順
```

**Structure Decision**: backend は既存の「handler が sqlc を直接呼ぶ」構成を守り、GitHub 呼び出しとトークン生成だけを `internal/auth` に切り出す (handler テストで差し替えるため)。frontend は FSD の既存配置に従い、認証の基盤 (Cookie・ガード) を `shared/auth/`、秘匿パスのページ固有の処理 (ログイン・ログアウト) を `pages/admin-login/` に置く。管理者専用のページは本機能では作らず、`requireAdminPage` / `requireAdmin` を後続のページ・サーバー関数が呼ぶ。GitHub との通信は frontend から消え、backend だけが行う。

## 設計の要点 (research.md の結論)

1. **信頼の起点**: `code` を backend に渡し、backend が GitHub と交換して本人確認する。Client Secret は backend のみ。frontend は結果のトークンを運ぶだけ (R1)
2. **session**: `sessions(id, token_hash UNIQUE, user_id → users, created_at, expires_at)`。トークンは 32 バイト乱数の base64url、DB には SHA-256。期限はログインから 30 日固定、延長なし。ログアウトと運用側の失効は行削除 (R2)
3. **照合の配線**: OpenAPI の `security: [bearerAuth]` を宣言した操作だけ、`OapiRequestValidator` の `AuthenticationFunc` がトークンを照合し user を context に載せる。handler はヘッダを読まない (R3)
4. **frontend の拒否**: ページはすべて `throw notFound()`。サーバー関数は `requireAdmin` middleware が Cookie の有無で即時に、`backendFetch` が backend の 401 を `notFound({ data: { reason: SESSION_EXPIRED } })` に写して拒否する。後続のページはこの `reason` で期限切れを判別する (R4)
5. **秘匿パス**: ルート直下の動的セグメント `$loginPath`。静的ルート優先で既存 URL と重なれば既存が勝つ。ログイン済みならログイン中表示とログアウトを出し、ログイン成功・ログアウト後は `/` へ遷移 (R5 / R10)
6. **テスト**: backend は `httptest` の GitHub と関数値の差し替えで分岐を検証。frontend の e2e は GitHub モック + compose の実 backend で通しを検証 (R6)

## Complexity Tracking

該当なし。
