# 管理者ログインの運用

仕組みの説明と判断の記録は [adr/backend/0007](../adr/backend/0007-issue-and-verify-sessions-in-backend.md)、仕様は [specs/003-admin-login](../specs/003-admin-login/spec.md)。ここには運用手順だけを置く。

GitHub OAuth で管理者 1 人がログインする。GitHub との本人確認とログイン状態 (session) の発行・照合・失効は backend が行い、frontend は秘匿パスにログイン画面を出して不透明なトークンを HttpOnly Cookie で運ぶだけ。

## 1. GitHub OAuth App を作る (ローカル用と本番用に 1 つずつ)

GitHub → Settings → Developer settings → OAuth Apps → New OAuth App。

| 項目 | ローカル | 本番 |
|---|---|---|
| Homepage URL | `http://localhost:3000` | 本番の origin |
| Authorization callback URL | `http://localhost:3000/auth/github/callback` | `https://<本番 host>/auth/github/callback` |
| Device Flow | 無効 | 無効 |

Client ID を控え、Generate a new client secret で Client Secret を控える。callback URL は 1 つしか登録できないため App を 2 つ作る。

## 2. 環境変数

### ローカル

デプロイ先ごとに `backend/.env` と `frontend/.env` に分けて書く (どちらも gitignore 済み。雛形は各ディレクトリの `.env.example`)。ルートの `.envrc` が両方を direnv で読み、`just be-dev` / compose (`${GITHUB_CLIENT_ID:-}` の展開) / `just fe-dev` にシェル経由で届く。

```sh
# backend/.env
GITHUB_CLIENT_ID=<ローカル用 Client ID>
GITHUB_CLIENT_SECRET=<ローカル用 Client Secret>
ADMIN_GITHUB_LOGIN=<自分の GitHub ユーザー名>

# frontend/.env (GITHUB_CLIENT_ID は backend と同じ値)
ADMIN_LOGIN_PATH=<openssl rand -hex 16 の出力>
GITHUB_CLIENT_ID=<ローカル用 Client ID>
```

書き換えたら `direnv reload` と dev server の再起動 (起動時の環境変数が使われる)。

`direnv allow` → `just db-up` → `just be-dev` → `just fe-dev`。`http://localhost:3000/<ADMIN_LOGIN_PATH>/auth/login` にログインカードが出る。

### 本番

| 対象 | 変数 | 置き場所 |
|---|---|---|
| backend (Cloud Run) | `GITHUB_CLIENT_SECRET`, `GITHUB_CLIENT_ID`, `ADMIN_GITHUB_LOGIN` | Secret Manager (変数名と同じ名前)。Cloud Run が環境変数として注入 |
| frontend (Workers) | `ADMIN_LOGIN_PATH`, `GITHUB_CLIENT_ID` | ダッシュボードの Variables (Plaintext)。`keep_vars = true` で deploy 時に保持 |

設定とデプロイの手順は [docs/deploy.md](deploy.md) (GCP はコンソールで操作する)。順序は 秘密と環境変数 → マイグレーション (users / sessions テーブル) → API → frontend。

backend の 3 変数のいずれかが空だと起動時に警告が出て、`POST /auth/sessions` は常に 403 になる (未設定で開放しない)。frontend の `ADMIN_LOGIN_PATH` が空・16 文字未満なら秘匿パスは 404。

## 3. 変更と失効

| やりたいこと | 手順 | 影響 |
|---|---|---|
| 秘匿パスを変える | frontend の `ADMIN_LOGIN_PATH` を更新 | 旧パスは 404。ログイン状態は維持 |
| 許可ユーザー名を変える (改名含む) | backend の `ADMIN_GITHUB_LOGIN` を更新 | 次回ログインから有効。ログイン状態は維持 |
| 特定のログイン状態を失効 | `DELETE FROM sessions WHERE id = '<uuid>'` | そのブラウザだけ次の要求から 404 |
| 全ログイン状態を失効 | `TRUNCATE sessions` | 全ブラウザで再ログイン |
| GitHub の Client Secret を回転 | OAuth App で再生成 → Secret Manager に新版 → API を再デプロイ ([docs/deploy.md](deploy.md)) | 進行中のログインだけ失敗 |
| ログインを全面停止 | backend の 3 変数のどれかを外す (または frontend の `ADMIN_LOGIN_PATH`) | 秘匿パスも管理者専用ページも 404 |

ログイン状態は 30 日で切れ、延長しない。期限切れの行は次のログイン時に掃除される。

## 4. e2e テスト

```sh
just db-up
just be-dev-e2e      # GitHub モック (frontend/e2e/github-mock.ts) を向いた backend
just fe-test-e2e     # Playwright がモックと dev server を起動する
```

e2e 用の dev server は 3001 で起動する (開発用の 3000 と分けている)。変えるときは `E2E_PORT=<port> just fe-test-e2e`。
