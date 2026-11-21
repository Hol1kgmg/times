# 動作確認とテストの手引き

開発者が手元で確認するときに使う URL、コマンド、結果の見方をまとめる。テストの方針は [constitution](../.specify/memory/constitution.md) の原則 V、各機能の検証内容は `specs/*/tasks.md` が定義元で、ここには写さない。

## 1. ローカルの URL とポート

| ポート | 用途 | 起動 | 開く URL |
|---|---|---|---|
| 3000 | 開発用の dev server | `just fe-dev` | `http://localhost:3000` |
| 3001 | e2e 用の dev server | `just fe-test-e2e` が起動 | 手では開かない |
| 3100 | e2e 用の GitHub モック | `just fe-test-e2e` が起動 | 手では開かない |
| 8080 | backend | `just be-dev` または `just be-dev-e2e` | `http://localhost:8080/health` |
| 5432 | Postgres | `just db-up` | `psql` で接続 (4 章) |
| 9323 | Playwright のレポート | 3 章のコマンド | `http://localhost:9323` |

- `just docs` (Markdown の配信) も 8080 を使う。backend と同時には起動できない。
- ポートを誰が使っているかは `lsof -iTCP:<port> -sTCP:LISTEN -P` で調べる。

## 2. 起動の組み合わせ

backend は 8080 を 1 つしか使えない。目的に合わせてどちらかを起動する。

| 目的 | 起動するもの |
|---|---|
| 画面を手で確認する (実 GitHub) | `just db-up` → `just be-dev` → `just fe-dev` |
| e2e を回す (GitHub モック) | `just db-up` → `just be-dev-e2e` → `just fe-test-e2e` |

- `just be-dev` は `backend/.env` の値で起動する。`just be-dev-e2e` は GitHub モックを向いた compose の `api` を起動する。DB は同じ Postgres の中の別の DB (`times_e2e`) を使うので、e2e で登録した Digest は開発用のトップに出ない。
- 環境変数を書き換えたら `direnv reload` と、dev server / backend の再起動が要る。起動時の値が使われる。
- 開発用の dev server (3000) は起動したままで e2e を回せる。e2e は 3001 に別の dev server を立てる。
- 起動の確認は `http://localhost:8080/health` (backend) と `http://localhost:3000/health` (frontend から backend への疎通)。

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
| 承認後にログイン画面へ戻り、通信失敗の表示になる | backend が GitHub モックを向いていない | `just be-dev` を止めて `just be-dev-e2e` を起動する |
| `just be-dev-e2e` がポートの衝突で起動しない | 8080 を `just be-dev` か `just docs` が使っている | 先に止める |
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

`backend/api/http/*.http` にリクエスト例がある。VS Code の REST Client 拡張 (推奨拡張に登録済み) で開き、各リクエストの上の「Send Request」を押す。`{{host}}` は `.vscode/settings.json` で `http://localhost:8080` に設定している。

| ファイル | 対象 |
|---|---|
| `health.http` | 疎通確認 |
| `digests.http` | Digest と記事 |
| `auth.http` | session の発行、照合、削除 |

curl で確認する例:

```sh
curl -i localhost:8080/health
curl -i -H "Authorization: Bearer garbage" localhost:8080/auth/sessions/current   # 401 application/problem+json
```

- ローカルでは `BACKEND_TOKEN` が空なので `X-Backend-Token` は要らない。設定した場合は全リクエストにこのヘッダが要る。
- `auth.http` の session 発行は、`just be-dev-e2e` の backend なら `code` に `admin` を指定すると通る。実 GitHub 向けの backend では、GitHub が発行した `code` が要る。

## 6. 画面を手で確認する

| 確認するもの | URL |
|---|---|
| トップページ (読者向けの一覧) | `http://localhost:3000/` |
| ログイン画面 | `http://localhost:3000/<ADMIN_LOGIN_PATH>/auth/login` |
| 404 の表示 | `http://localhost:3000/not-the-path` |

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

## 8. ミューテーションテストでテストの検出力を見る

コードをわざと壊したもの (ミュータント) をテストが落とせるかを試し、行カバレッジでは分からない「通っているが何も確かめていない」テストを見つける (#177)。frontend の Vitest だけが対象で、ツールは [`@mizchi/mutator`](https://www.npmjs.com/package/@mizchi/mutator)。

```sh
just fe-test-mutation --since main                  # main との差分だけ。日常はこれ
just fe-test-mutation --since main --include-test-changes  # テストだけ直したときも、そのテストが通るコードを試す
just fe-test-mutation                               # 全件 (初回約 8 分、2 回目以降はキャッシュで数秒)
just fe-test-mutation --reporter html               # レポートは frontend/.mutator/report/index.html
just fe-test-mutation --since main --reporter agent > frontend/.mutator/agent.json  # AI エージェントに渡す JSON
```

- 対象と除外は `frontend/mutator.config.json`。純粋なロジックの層 (`shared/lib`、`pages/*/model`、`pages/*/lib`) だけを試し、UI・サーバー関数・`*.gen.ts`・`index.ts`・型宣言は外す。UI の Vitest はほとんどないので、試しても NoCoverage が並ぶだけになる。
- 結果の読み方 (スコアは Killed + Timeout + RuntimeError を、それに Survived と NoCoverage を足したもので割る。CompileError は分母に入らない):

  | 結果 | 意味 | すること |
  |---|---|---|
  | Killed / RuntimeError / Timeout | テストが落ちた (例外・無限ループも含む) | なし |
  | Survived (not detected) | テストは通るが、どれも落ちない | 結果を確かめる assertion を足す・強める |
  | Survived (not infected) | テストは通るが、元と変異後で値が変わる入力がない | 境界の値など、両者が分かれる入力を足す |
  | NoCoverage (not reached) | どのテストも通らない | テストが要るかを [品質ルール](../.claude/rules/quality.md#テストの置き場所) で判断する |
  | CompileError | 型チェックで落ちたので試していない | なし (型が守っている) |

- 等価ミュータント (変えても結果が同じもの) は `pnpm -C frontend exec mutator accept <key> --reason "<理由>"` で `frontend/mutator.accepted.json` に理由を残す。100% は目指さない。
- `src/app/styles/fonts/fixed-chars.test.ts` は子プロセスで `scripts/fixed-chars.ts` を動かすので、mutator からは見えない (毎回警告が出る)。
- 改善の例: `digest-urls.ts` の `some` → `every` の 2 件が生き残っていた。記事も子も 1 件しかない fixture では `some` と `every` が同じ値になるため。記事を 2 件、子を 2 件にしたテストを足して殺した。

### CI

`frontend-mutation` workflow を Actions の画面から手動で起動する (`since` に ref を入れると差分だけ)。レポートは artifact `mutation-report` に残る。PR の必須チェックには入れず、閾値で落とすこともしない。

### ツールの比較 (2026-11、`entry-date.ts` / `group-by-category.ts` / `digest-urls.ts` の 3 ファイルと同じテストで、手元で 4 並列)

| | `@mizchi/mutator` 0.4.5 | StrykerJS 10.1.1 |
|---|---|---|
| 全件 | 31 秒 (型チェック 12 秒を含む) | 20 秒 |
| 2 回目 | 10 秒 (キャッシュ) | 7 秒 (`--incremental`) |
| 差分だけ | `--since` で 1〜11 秒。テストの変更も拾える | なし (`--incremental` は前回の結果の使い回しだけ) |
| ミュータント | 67 (型の合わない 35 件を先に除く) | 65 (型エラーも実行して errors 14 件) |
| スコア | 65.6% | 74.5% (数え方が違うので比べられない) |
| 生き残り | `some` → `every` 2 件 | 同じ 2 件 + 関数を丸ごと空にする変異など 4 件 |
| 導入の手間 | 設定ファイルだけで動いた | pnpm だとプラグインが自動で見つからない。サンドボックスに写すと Vite の `fs.allow` に弾かれ、`--inPlace` は読み取り専用の `.agents` で復元の途中に落ちて作業ツリーを書き換えたまま止まった |
| AI エージェント | `--reporter agent` の JSON と `mutation-test-loop` skill を同梱 | なし |

mutator を選んだ。差分だけを数秒で回せて、テストの変更も追えるので、日常の開発で回せる。型チェックで変異を先に減らすので、TypeScript の型が守っている所を数えずに済む。弱いのは 0.x で更新が速い (0.4.0 → 0.5.0 が 2 日) ことで、上げるときは `minimumReleaseAge` を待ってから CLI の `--help` で手順を確かめる。

AI エージェント向けのレポートは、生き残りごとに種類 (`notDetected` / `notInfected` / `notReached`)、囲む関数、それを通るテストが入っていて、上の改善例はこの JSON だけで直せた。`mutation-test-loop` skill はこのリポジトリには入れていない。skill は apm が配置するので、使うなら `packages/project/.apm/` に入れる。

全件の実測 (対象 25 ファイル): ミュータント 1,735 件、うち型チェックで落ちたもの 703 件、実行したもの 673 件。466 秒 (型チェックが 326 秒) で、メモリは最大 1.8GB。スコアは 47.9%。NoCoverage が多いのは `not-found/lib/load-favicon.ts` など、テストを書かない方針の部分。

### backend (Go)

まだ入れていない。候補は [gremlins](https://github.com/go-gremlins/gremlins) (v0.6.0、2025-12) と [avito-tech/go-mutesting](https://github.com/avito-tech/go-mutesting) (v2.3.1、2025-12)。どちらも保守はされているが、Go 1.26 での試走はしていない。試すなら、DB に触れない `internal/auth` と `internal/feed` から始める。入れるかは #204 で決める。

## 9. コミット前の確認

```sh
just be-gen            # OpenAPI か SQL を変えたとき。生成物に差分が出たら一緒にコミットする
just lint && just test
just fe-typecheck
just fe-test-e2e       # サーバー関数と backend の受け渡し・SQL・セッションと Cookie に触れたとき
```

- pre-commit (lefthook) は lint、markuplint、typecheck、Vitest、gofmt、go vet、go test、gitleaks を実行する。
- e2e と `be-gen` の差分確認は pre-commit に含まれない。e2e は CI でも実行されないので、手元で回す。
- `just fe-lint-markup` は既存の `__root.tsx` への指摘で落ちる。
