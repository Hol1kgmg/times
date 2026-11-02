# 動作確認とテストの手引き

開発者が手元で確認するときに使う URL、コマンド、結果の見方をまとめる。テストの方針は [constitution](../.specify/memory/constitution.md) の原則 V、各機能の検証内容は `specs/*/tasks.md` が定義元で、ここには写さない。

## 1. ローカルの URL とポート

開発用のサーバーは portless のプロキシ (1355) を経由し、ポートは起動ごとに空きが割り当てられる。git worktree ではホスト名の先頭にブランチ名が付く (例: `http://fix-ui.times.localhost:1355`)。

| 用途 | 起動 | 開く URL |
|---|---|---|
| 開発用の dev server | `just fe-dev` | `http://times.localhost:1355` |
| backend | `just be-dev` | `http://api.times.localhost:1355/health` |
| 開発用の GitHub モック | `just be-dev` が一緒に起動 | 手では開かない |
| Markdown の配信 | `just docs` | `http://docs.times.localhost:1355` |

固定のポートを使うもの:

| ポート | 用途 | 起動 | 開く URL |
|---|---|---|---|
| 3000 | LAN の端末向けの dev server | `just fe-dev-host` | `http://<Mac の LAN IP>:3000` |
| 3001 | e2e 用の dev server | `just fe-test-e2e` が起動 | 手では開かない |
| 3100 | GitHub モック (e2e、`fe-dev-host`) | `just fe-test-e2e` / `just fe-dev-host` が起動 | 手では開かない |
| 8080 | compose の backend | `just be-up` または `just be-dev-e2e` | `http://localhost:8080/health` |
| 5432 | Postgres | `just db-up` | `psql` で接続 (4 章) |
| 9323 | Playwright のレポート | 3 章のコマンド | `http://localhost:9323` |

- `PORTLESS=0` を付けるとプロキシを通さず、`fe-dev` は 3000、`be-dev` は 8080、`docs` は 8080、`be-dev` のモックは 3100 で起動する。
- ポートを誰が使っているかは `lsof -iTCP:<port> -sTCP:LISTEN -P`、portless の経路は `portless list` で調べる。

## 2. 起動の組み合わせ

| 目的 | 起動するもの |
|---|---|
| 画面を手で確認する (GitHub モック) | `just db-up` → `just be-dev` → `just fe-dev` |
| 画面を手で確認する (実 GitHub、本体の worktree だけ) | `just db-up` → `GITHUB_AUTH=real just be-dev` → `GITHUB_AUTH=real just fe-dev` |
| スマホから確認する | `just db-up` → `just be-dev` → `just fe-dev-host` |
| e2e を回す (GitHub モック) | `just db-up` → `just be-dev-e2e` → `just fe-test-e2e` |

- `just be-dev` は既定で GitHub モックを向き、モックの「管理者として承認」で管理者として入れる。`GITHUB_AUTH=real` で `backend/.env` の値 (実 GitHub) に向く。`just be-dev-e2e` は e2e 用のモックを向いた compose の `api` を起動する。DB は同じ Postgres の中の別の DB (`times_e2e`) を使うので、e2e で登録した Digest は開発用のトップに出ない。
- portless の `be-dev` は 8080 を使わないので、`be-dev-e2e` と同時に動かせる。
- 環境変数を書き換えたら `direnv reload` と、dev server / backend の再起動が要る。起動時の値が使われる。
- 開発用の dev server は起動したままで e2e を回せる。e2e は 3001 に別の dev server を立てる。
- 起動の確認は `http://api.times.localhost:1355/health` (backend) と `http://times.localhost:1355/health` (frontend から backend への疎通)。

## 3. e2e (Playwright) の結果を見る

```sh
just fe-test-e2e                                  # 全件
just fe-test-e2e admin-login                      # ファイル名で絞る
just fe-test-e2e -g "ログアウト"                   # テスト名で絞る
just fe-test-e2e --headed                         # ブラウザを表示して実行
just fe-test-e2e --debug                          # 1 手ずつ止めながら実行
just fe-test-e2e --trace on                       # 操作の記録 (trace) を残す
just fe-test-e2e-ui                               # UI モード (対話的に実行と再実行)
```

| 見たいもの | 方法 |
|---|---|
| 直前の実行結果 | `pnpm -C frontend exec playwright show-report` → `http://localhost:9323` |
| 端末に 1 行ずつ結果を出す | `just fe-test-e2e --reporter=list` |
| 失敗時の画面の状態 | `frontend/test-results/<テスト名>/error-context.md` |
| 操作の記録 | `--trace on` で実行し、レポートの各テストから開く |

- ローカルでテストが失敗すると、Playwright がレポートを 9323 で配信したまま待つ。`Ctrl+C` で終了する。
- レポートの実体は `frontend/playwright-report/index.html`。実行のたびに上書きされる。
- `--reporter=list` を付けた実行ではレポートが更新されない。

### e2e が失敗するとき

| 症状 | 原因 | 対処 |
|---|---|---|
| 「GitHub でログイン」ボタンを待って 30 秒でタイムアウト | e2e 用ではない dev server を再利用している | 3001 (または `E2E_PORT` のポート) を使っているプロセスを止める |
| 承認後にログイン画面へ戻り、通信失敗の表示になる | 8080 の backend が e2e 用のモックを向いていない | `just be-up` などを止めて `just be-dev-e2e` を起動する |
| `just be-dev-e2e` がポートの衝突で起動しない | 8080 を `just be-up` か `PORTLESS=0` で起動したものが使っている | 先に止める |
| backend への接続で失敗する | DB か backend が起動していない | `just db-up` → `just be-dev-e2e` |

## 4. DB の中身を確認する

```sh
docker compose exec db psql -U times -d times
```

```sql
SELECT id, login FROM users;
```

```sql
SELECT id, user_id, expires_at FROM sessions;
```

| やりたいこと | コマンド |
|---|---|
| 開発用のダミーデータを入れる (`backend/db/seed.md`、昨日と一昨日の日付で登録) | `just db-seed` |
| マイグレーションの版を見る | `just db-migrate version` |
| 1 つ戻す | `just db-migrate down 1` |
| データを消して作り直す | `just db-reset` → `just db-up` |

e2e はログインのたびに `users` と `sessions` に行を作る。開発用の DB と共用なので、行が残っていても異常ではない。

## 5. backend の API を直接叩く

`backend/api/http/*.http` にリクエスト例がある。VS Code の REST Client 拡張 (推奨拡張に登録済み) で開き、各リクエストの上の「Send Request」を押す。`{{host}}` は `.vscode/settings.json` で本体の worktree の `just be-dev` (`http://api.times.localhost:1355`) に設定している。compose の backend を叩くときは `http://localhost:8080` に書き換える。

| ファイル | 対象 |
|---|---|
| `health.http` | 疎通確認 |
| `digests.http` | Digest と記事 |
| `auth.http` | session の発行、照合、削除 |

curl で確認する例:

```sh
curl -i http://api.times.localhost:1355/health
curl -i -H "Authorization: Bearer garbage" http://api.times.localhost:1355/auth/sessions/current   # 401 application/problem+json
```

- ローカルでは `BACKEND_TOKEN` が空なので `X-Backend-Token` は要らない。設定した場合は全リクエストにこのヘッダが要る。
- `auth.http` の session 発行は、GitHub モックを向いた backend (`just be-dev` の既定、`just be-dev-e2e`) なら `code` に `admin` を指定すると通る。実 GitHub 向けの backend では、GitHub が発行した `code` が要る。

## 6. 画面を手で確認する

| 確認するもの | URL |
|---|---|
| トップページ (読者向けの一覧) | `http://times.localhost:1355/` |
| ログイン画面 | `http://times.localhost:1355/<ADMIN_LOGIN_PATH>/auth/login` |
| 404 の表示 | `http://times.localhost:1355/not-the-path` |

- Safari は `.localhost` のサブドメインを解決できないので、Chrome / Firefox / Edge で開く。

- `ADMIN_LOGIN_PATH` は `frontend/.env` の値。未設定または 16 文字未満だとログイン画面は 404 になる。
- ログイン状態は Cookie `times_admin` が持つ。ブラウザの開発者ツールの Application → Cookies で確認、削除できる。
- ログイン前の状態を試すときは、シークレットウィンドウを使うと Cookie を消さずに済む。
- 実 GitHub を使う確認の手順と期待値は [specs/003-admin-login/quickstart.md](../specs/003-admin-login/quickstart.md) の「4. 動作確認」。OAuth App の作成と環境変数は [docs/admin-login.md](admin-login.md)。

## 7. ユニットテストを絞って実行する

```sh
just fe-test src/shared/auth                      # パスで絞る
just fe-test -t "requireAdminToken"                 # テスト名で絞る
pnpm -C frontend test:watch                       # 変更を監視して再実行
pnpm -C frontend test:coverage                    # カバレッジ。結果は frontend/coverage/index.html

just be-test -run TestBearerAuth                  # テスト名で絞る
just be-test -v                                   # 各テストの結果を表示
just be-test -count=1                             # キャッシュを使わずに実行
```

`go test` は結果をキャッシュする。出力に `(cached)` とあれば再実行されていない。

## 8. コミット前の確認

```sh
just be-gen            # OpenAPI か SQL を変えたとき。生成物に差分が出たら一緒にコミットする
just lint && just test
just fe-typecheck
just fe-test-e2e       # 画面の遷移やログインに触れたとき
```

- pre-commit (lefthook) は lint、markuplint、typecheck、Vitest、gofmt、go vet、go test、gitleaks を実行する。
- e2e と `be-gen` の差分確認は pre-commit に含まれない。e2e は CI でも実行されないので、手元で回す。
- `just fe-lint-markup` は既存の `__root.tsx` への指摘で落ちる。
