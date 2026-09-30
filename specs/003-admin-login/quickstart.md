# Quickstart: 管理者ログイン (backend 起点版)

契約は [contracts/openapi.md](./contracts/openapi.md) と [contracts/routes.md](./contracts/routes.md)、値の形は [data-model.md](./data-model.md)。

## 前提

- Nix devShell (direnv)、Docker Compose、`pnpm`。`just db-up` で PostgreSQL、`just be-dev` で backend (:8080)、`just fe-dev` で frontend (:3000) が立つこと
- GitHub アカウント (管理者本人)

## 1. GitHub OAuth App を作る (ローカル用と本番用に 1 つずつ)

GitHub → Settings → Developer settings → OAuth Apps → New OAuth App。

| 項目 | ローカル | 本番 |
|---|---|---|
| Homepage URL | `http://localhost:3000` | 本番の origin |
| Authorization callback URL | `http://localhost:3000/auth/github/callback` | `https://<本番 host>/auth/github/callback` |
| Device Flow | 無効 | 無効 |

Client ID を控え、Generate a new client secret で Client Secret を控える。callback URL は 1 つしか登録できないため App を 2 つ作る。

## 2. マイグレーション

```sh
just db-migrate          # ローカル: users / sessions を作る
```

本番は Cloud Run Job `times-migrate`。手順は [docs/deploy.md](../../docs/deploy.md)。

## 3. 環境変数

### ローカル

デプロイ先ごとに `backend/.env` と `frontend/.env` に書く (gitignore 済み、雛形は各ディレクトリの `.env.example`)。`.envrc` の `dotenv_if_exists backend/.env` / `dotenv_if_exists frontend/.env` が読み、シェル経由で compose (`${GITHUB_CLIENT_ID:-}`) と `vite dev` に届く。

```sh
# backend/.env
GITHUB_CLIENT_ID=<ローカル用 Client ID>
GITHUB_CLIENT_SECRET=<ローカル用 Client Secret>
ADMIN_GITHUB_LOGIN=<自分の GitHub ユーザー名>
# frontend/.env (GITHUB_CLIENT_ID は backend と同じ値)
ADMIN_LOGIN_PATH=<openssl rand -hex 16 の出力>
GITHUB_CLIENT_ID=<ローカル用 Client ID>
```

`direnv allow` → `just db-up && just db-migrate` → `just be-dev` → `just fe-dev`。

### 本番

| 対象 | 変数 | 置き場所 |
|---|---|---|
| backend (Cloud Run) | `GITHUB_CLIENT_SECRET`, `GITHUB_CLIENT_ID`, `ADMIN_GITHUB_LOGIN` | Secret Manager (変数名と同じ名前)。Cloud Run が環境変数として注入 |
| frontend (Workers) | `ADMIN_LOGIN_PATH`, `GITHUB_CLIENT_ID` | ダッシュボードの Variables (Plaintext)。`keep_vars = true` で deploy 時に保持 |

設定とデプロイの手順は [docs/deploy.md](../../docs/deploy.md)。

## 4. 動作確認 (手動、実 GitHub)

| # | 操作 | 期待 |
|---|---|---|
| 1 | `http://localhost:3000/not-the-path` | 既存の 404 と同じ表示 |
| 2 | `http://localhost:3000/auth/github/callback` | 404 |
| 3 | `http://localhost:3000/<ADMIN_LOGIN_PATH>/auth/login` | ログインカード |
| 4 | ボタン → GitHub で承認 | `/` (トップページ) に移動。表示は変わらない |
| 5 | `psql` で `SELECT id, login FROM users; SELECT id, expires_at FROM sessions;` | 1 行ずつ。`expires_at` は 30 日後 |
| 6 | もう一度秘匿パス | ログイン中表示 (ユーザー名) とログアウト |
| 7 | ブラウザを閉じて開き直し秘匿パス | ログインなしでログイン中表示 |
| 8 | `psql` で `DELETE FROM sessions;` → 秘匿パス | ログインカードに戻る (個別失効、FR-019) |
| 9 | 再ログイン → 秘匿パス → ログアウト | `/` に移動。直後の秘匿パスはログインカード。`sessions` は 0 行 |
| 10 | `ADMIN_GITHUB_LOGIN` を別名にして backend 再起動 → ログイン | 「許可されていない」表示、`users` に行が増えない |
| 11 | `curl -H "Authorization: Bearer garbage" localhost:8080/auth/sessions/current` | 401 `application/problem+json` |
| 12 | `/` | ログイン関連の表示なし |

## 5. 自動テスト

```sh
just be-test        # go test: CreateSession の 201/403/502、照合の 401、security 宣言の有無
just fe-test        # Vitest: 設定の読み取り、requireAdmin、backendFetch の 401 写し
just fe-test-e2e    # Playwright: GitHub モック + compose の backend で受け入れシナリオを通す
```

- e2e は `playwright.config.ts` が GitHub モック (`e2e/github-mock.mjs`) と dev server を起動し、テスト用 env を注入する。backend は事前に `GITHUB_BASE_URL` / `GITHUB_API_URL` をモックに向けて compose で起動しておく (`just be-dev-e2e` を tasks で追加)
- 既に実 GitHub 向けの dev server / backend が動いていると再利用されて失敗する。e2e の前に止める

## 6. 運用: 変更と失効

| やりたいこと | 手順 | 影響 |
|---|---|---|
| 秘匿パスを変える | frontend の `ADMIN_LOGIN_PATH` を更新 | 旧パスは 404。ログイン状態は維持 |
| 許可ユーザー名を変える (改名含む) | backend の `ADMIN_GITHUB_LOGIN` を更新 | 次回ログインから有効。ログイン状態は維持 (FR-013) |
| 特定のログイン状態を失効 | `DELETE FROM sessions WHERE id = '<uuid>'` | そのブラウザだけ次の要求から 404 |
| 全ログイン状態を失効 | `TRUNCATE sessions` | 全ブラウザで再ログイン |
| GitHub の Client Secret を回転 | OAuth App で再生成 → Secret Manager に新版 → API を再デプロイ (docs/deploy.md) | 進行中のログインだけ失敗 |
| ログインを全面停止 | backend の 3 変数のどれかを外す (または frontend の `ADMIN_LOGIN_PATH`) | 秘匿パスも管理者専用ページも 404 |

この表は実装時に `docs/admin-login.md` へ写す。
