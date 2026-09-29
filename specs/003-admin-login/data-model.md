# Data Model: 管理者ログイン (backend 起点版)

永続化は backend の PostgreSQL に 2 テーブル。ブラウザは不透明な識別子を Cookie で持つだけ。

## DB (`backend/db/migrations/000003_create_users_and_sessions.up.sql`)

### users (管理者の記録)

| 列 | 型 | 制約 | 意味 |
|---|---|---|---|
| `id` | bigint | PK | GitHub 固定 ID (`GET /user` の `id`)。ユーザー名を識別子にしない (FR-011) |
| `login` | text | NOT NULL, CHECK (login <> '') | 表示用のユーザー名。ログインごとに最新値へ更新 |
| `created_at` | timestamptz | NOT NULL DEFAULT now() | 初回ログイン |
| `updated_at` | timestamptz | NOT NULL DEFAULT now() | 最終ログイン (upsert で更新) |

- ロール列は持たない。行がある = 過去にログインが成立した管理者 (spec Assumptions)
- 後続の仕様が管理者を参照する列 (登録者など) を足すときは `users (id)` を参照する。本機能では既存テーブルを触らない

### sessions (ログイン状態)

| 列 | 型 | 制約 | 意味 |
|---|---|---|---|
| `id` | uuid | PK DEFAULT gen_random_uuid() | 行の識別子 (運用側が個別失効で指す) |
| `token_hash` | bytea | NOT NULL UNIQUE | `sha256(token)`。平文は保存しない |
| `user_id` | bigint | NOT NULL REFERENCES users (id) ON DELETE CASCADE | 管理者 |
| `created_at` | timestamptz | NOT NULL DEFAULT now() | ログイン成立 |
| `expires_at` | timestamptz | NOT NULL | `created_at + 30 days`。延長しない (FR-007) |

- 索引: `token_hash` の UNIQUE で足りる。`user_id` の索引は管理者 1 人では不要 (ponytail: 複数管理者になったら足す)
- 照合: `WHERE token_hash = $1 AND expires_at > now()`。期限切れの行が残っていても無効 (spec Assumptions)
- 掃除: session 作成時に `DELETE FROM sessions WHERE expires_at < now()`
- 個別失効 (FR-019): 運用側が `DELETE FROM sessions WHERE id = ...`。全失効は `TRUNCATE sessions`

### sqlc クエリ (`backend/db/queries/auth.sql`)

| name | 種別 | 内容 |
|---|---|---|
| `UpsertUser` | :one | `INSERT ... ON CONFLICT (id) DO UPDATE SET login = EXCLUDED.login, updated_at = now() RETURNING *` |
| `CreateSession` | :one | `INSERT (token_hash, user_id, expires_at) RETURNING *` |
| `GetSessionByTokenHash` | :one | `SELECT sessions.*, users.login FROM sessions JOIN users ... WHERE token_hash = $1 AND expires_at > now()` |
| `DeleteSessionByTokenHash` | :exec | 0 行でもエラーにしない (ログアウトの冪等性) |
| `DeleteExpiredSessions` | :exec | `WHERE expires_at < now()` |

## トークン

| 項目 | 値 |
|---|---|
| 生成 | `crypto/rand` 32 バイト → base64url (43 文字、パディングなし) |
| 保存 | `sha256(token)` を `sessions.token_hash` に |
| 転送 | backend → frontend: `POST /auth/sessions` の応答本文に 1 回。frontend → backend: `Authorization: Bearer <token>` |
| ブラウザ | Cookie `times_admin` (HttpOnly, Secure, SameSite=Lax, Path=/, Max-Age 2592000)。frontend は中身を解釈しない |
| ログ | 平文トークンはどこにも出さない |

## Cookie (frontend)

| 名前 | 内容 | 寿命 | 用途 |
|---|---|---|---|
| `times_admin` | backend が発行したトークン | 30 日 | 管理者の要求に Bearer として転送 |
| `times_login` | OAuth の `state` (`crypto.randomUUID()`) | 10 分 | callback で `?state` と一致確認。照合後は成否を問わず削除 |

どちらも HttpOnly, Secure, SameSite=Lax, Path=/。暗号化・署名なし (research R8)。

## 環境変数

### backend

| 変数 | 必須 | 形式 | 用途 |
|---|---|---|---|
| `GITHUB_CLIENT_ID` | 必須 | 空でない | token 交換 |
| `GITHUB_CLIENT_SECRET` | 必須 | 空でない | token 交換 (Secret Manager `github-client-secret`) |
| `ADMIN_GITHUB_LOGIN` | 必須 | 空でない | 許可ユーザー名。小文字比較 (FR-011) |
| `GITHUB_BASE_URL` | 任意 | URL、既定 `https://github.com` | テストでモックへ |
| `GITHUB_API_URL` | 任意 | URL、既定 `https://api.github.com` | テストでモックへ |

必須のいずれかが空なら起動時に `slog.Warn` を出し、`POST /auth/sessions` は常に 403 `/problems/forbidden` (FR-012: 未設定で開放しない)。他の操作は影響を受けない。

### frontend

| 変数 | 必須 | 形式 | 用途 |
|---|---|---|---|
| `ADMIN_LOGIN_PATH` | 必須 | `^[A-Za-z0-9-]{16,}$` | 秘匿パス (1 セグメント、先頭 `/` なし) |
| `GITHUB_CLIENT_ID` | 必須 | 空でない | authorize URL の組み立て (公開情報) |
| `GITHUB_BASE_URL` | 任意 | URL、既定 `https://github.com` | authorize URL の起点。テストでモックへ |
| `BACKEND_URL`, `BACKEND_TOKEN` | 既存 | | 変更なし |

`shared/auth/config.server.ts` が Zod で読み、必須が欠ければ `undefined` → 呼び出し側はすべて `notFound()` (FR-012)。`ADMIN_LOGIN_PATH` はサーバー側の照合にだけ使い、クライアントに配布する資材や描画に渡さない (FR-014)。

## GitHub から受け取る値 (backend、一時)

| フィールド | 型 | 用途 |
|---|---|---|
| `access_token` | string | `GET /user` に 1 回使い捨て。保存しない |
| `id` | int64 | `users.id` |
| `login` | string | 許可ユーザー名との照合と `users.login` の更新。不一致なら何も保存しない (FR-005) |

## 状態遷移

```text
未ログイン ──startGitHubLogin (frontend)──▶ 認可待ち (times_login)
認可待ち ──callback: state 一致 → POST /auth/sessions 201──▶ ログイン済み (sessions 行 + times_admin、/ へ遷移)
認可待ち ──callback: POST /auth/sessions 403 (別アカウント / 設定未完)──▶ 未ログイン (?error=forbidden)
認可待ち ──callback: GitHub error=access_denied──▶ 未ログイン (?error=cancelled、backend を呼ばない)
認可待ち ──callback: POST /auth/sessions 502 / 通信失敗──▶ 未ログイン (?error=failed)
認可待ち ──callback: state 不一致・欠落──▶ 404
ログイン済み ──expires_at 経過──▶ 未ログイン (GET current 401。管理者専用ページは 404、サーバー関数は notFound(SESSION_EXPIRED)、秘匿パスはログインカード)
ログイン済み ──logout (DELETE current、秘匿パスのページから)──▶ 未ログイン (冪等、/ へ遷移)
ログイン済み ──運用側が sessions 行を削除──▶ 未ログイン (次の要求から)
```

## 後続の管理者向け機能への引き継ぎ

- 管理者専用の backend 操作は OpenAPI で `security: [bearerAuth]` を宣言する。handler は `AuthenticationFunc` が context に載せた user の `id` を使う (登録者の記録など)。frontend から user id を送らせない
- 管理者専用のページはルートの `beforeLoad` で `requireAdminPage()` を呼ぶ (未ログインは `notFound()`)。サーバー関数は `requireAdmin` middleware を付け、`backendFetch` にトークンを渡すだけ
- 期限切れの判別は `isNotFound(e) && e.data?.reason === SESSION_EXPIRED`
