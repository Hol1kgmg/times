# times
記事リンクを日付・カテゴリごとにまとめた Digest を公開する個人サイト。

## 前提条件

- [Nix](https://nixos.org/)（Flakes 有効）と [direnv](https://direnv.net/) がインストールされ、シェルに統合されていること
- [Docker](https://www.docker.com/)（Compose 付き）。Postgres と golang-migrate はコンテナで動かす

macOS (Homebrew):

```bash
brew install nix direnv
brew install --cask docker
```

Flakes の有効化:

```bash
mkdir -p ~/.config/nix
echo 'experimental-features = nix-command flakes' >> ~/.config/nix/nix.conf
```

シェル統合 (zsh):

```bash
echo 'eval "$(direnv hook zsh)"' >> ~/.zshrc
source ~/.zshrc
```

## セットアップ

```bash
direnv allow        # ツールのインストールと Git フックの設定
just fe-install     # frontend の依存をインストール
just db-up          # Postgres を起動してマイグレーションを適用
```

以降はリポジトリのディレクトリに入るだけで自動的に環境が有効になります。

## 開発サーバー

別々のターミナルで起動します。

```bash
just fe-dev    # frontend: http://localhost:3000
just be-dev    # backend:  http://localhost:8080
```

## 開発環境

`direnv` が `flake.nix` の devShell を読み込み、次のツールが PATH に入ります。

| ツール | 用途 |
|---|---|
| just | タスクランナー（[justfile](justfile)） |
| gitleaks / lefthook | pre-commit でステージ済みの差分をシークレット走査し、平文の `.env*` のコミットを止める（[lefthook.yaml](lefthook.yaml)） |
| dotenvx | `.env*` を暗号化してコミットし、`dotenvx run -- <cmd>` で復号して渡す |
| portless | 開発サーバーを固定のポート番号ではなく `http://<name>.localhost:1355` で公開する |
| gh / gh-dash | GitHub 操作 |
| markserv | `just docs` で Markdown を http://docs.<リポジトリ名>.localhost:1355 に配信する |
| claude / codex | コーディングエージェント（`AGENTS.md` と `.agents/` を共有して参照する） |
| go / gopls / sqlc / oapi-codegen | backend 開発（[docs/tech-stack.md](docs/tech-stack.md)）。Postgres と golang-migrate は Docker Compose で動かす |
| jactionlint / gh-actions-lock | workflow と `dependabot.yml` の検査、`actions.lock` の生成と検証（下の「GitHub Actions の lockfile」） |

エージェント用のスキルとルールは [APM](https://github.com/microsoft/apm) で管理し、`apm.yml` の宣言から devShell 起動時に
スキルは `.agents/skills`、ルールは `.claude/rules` へ同期されます（`just apm` / `just apm-list`）。
取得元の版は `apm.lock.yaml` に固定し、独自スキルは `packages/project/.apm/skills/<id>/`、独自ルールは `packages/project/.apm/instructions/<id>.instructions.md` に置きます。

### テンプレート管理と派生先管理の分離

`just sync` の衝突を避けるため、テンプレートが更新する部分と派生先が編集する部分を分けています。派生先では左の列だけを編集してください。

| 派生先が編集する | テンプレートが管理する（編集しない） |
|---|---|
| `apm.yml` の `dependencies.apm` 末尾の「派生先が管理」区画（外部の skill / rule の追加）、`packages/project/.apm/`（独自の skill / rule） | `apm.yml` のそれ以外、`packages/template/`、`packages/project/apm.yml` |
| `flake.nix` の `inputs` 末尾の「project inputs」区画 | `flake.nix` の `inputs` のそれ以外 |
| `flake.nix` 末尾の `devShells.default` | `flake.nix` の `devShells.template` |

`flake.lock` と `apm.lock.yaml` は両側が更新します。`just sync` が衝突を自動解消し、派生先だけの取得元の版は派生先の lock から書き戻します（下の「テンプレート同期」）。

skill / rule の取得元の更新は Dependabot（`apm` ecosystem）が取得元ごとに PR を出します。Dependabot が更新するのは `apm.yml` に `#main` などの ref 付きで直接書いた依存だけなので、取得元は `packages/template/apm.yml` や別の `apm.yml` を経由させず、`apm.yml` に直接書いてください（[adr/from-template/0009](adr/from-template/0009-declare-all-skill-sources-in-root-apm-yml.md)）。マージ前に `dependabot-review` スキルで差分をレビューし、`just apm-fix-lock <PR 番号>` で lock を直してください（下の「Dependabot の apm PR」）。

### Dependabot の apm PR

Dependabot が使う apm（0.34.0）は手元と CI の apm（0.35.0）より古く、lock の書き方がずれます。PR の lock からローカルパッケージ（`./packages/template`、`./packages/project`）の `content_hash` が消え、CI の `apm install --frozen` が失敗します。マージ前に `just apm-fix-lock <PR 番号>` を実行すると、PR のブランチで `apm install` をやり直した lock を push します。[dependabot-core#16792](https://github.com/dependabot/dependabot-core/pull/16792) がマージされれば、この手順は不要になります。

`just apm-fix-lock` で commit を足した PR は、Dependabot が rebase しなくなります。apm の PR が複数あるときは 1 件ずつマージし、そのたびに残りの PR に `@dependabot recreate` とコメントしてから、作り直された PR で `just apm-fix-lock` をやり直してください。

### GitHub Actions の lockfile

workflow の `uses:` はタグで書き、実行するコミットは [`.github/workflows/actions.lock`](.github/workflows/actions.lock) に固定します（[workflow dependency lockfiles](https://docs.github.com/en/actions/concepts/security/workflow-dependency-lockfiles)）。CI の `check` は `just lint-actions` で次の 2 つを実行します。

- `jactionlint`: workflow、`dependabot.yml`、`actions.lock` を検査する（設定は [.github/jactionlint.yaml](.github/jactionlint.yaml)）
- `gh-actions-lock --verify`: lockfile が workflow と一致し、固定したコミットが GitHub 上で正しいかを確かめる

workflow の `uses:` を追加・変更したら、`gh-actions-lock` を実行して lockfile を更新し、workflow と一緒にコミットしてください。SHA で書いた `uses:` は、実行時点のコミットを指すタグに書き換えられます。
CI が `is not in .github/workflows/actions.lock` や `listed ... but the workflow does not use it` で落ちたときも、同じく `gh-actions-lock` を実行して差分をコミットします。手元で検証するときは `just lint-actions` を使います。

## 環境変数

ローカル用の `backend/.env` と `frontend/.env` は [dotenvx](https://dotenvx.com/) で暗号化してコミットしています。復号鍵は各ディレクトリの `.env.keys`（gitignore 済み）で、リポジトリ外で共有してください。[.envrc](.envrc) が復号して読むので、`just` のレシピにはそのまま届きます。

```bash
dotenvx set API_KEY xxx -f backend/.env  # 暗号化して追加（鍵は backend/.env.keys）
```

`-f` を省くとルートに `.env` と `.env.keys` ができます。ルートの `.env` / `.env.*` は gitignore 済みです。2 つのファイルの鍵はどちらも `DOTENV_PRIVATE_KEY` という名前なので、`.env.keys` は各ディレクトリに分けてください。
本番の値は Cloud Run / Workers のダッシュボードに置き、`.env` は読みません（[docs/admin-login.md](docs/admin-login.md)）。
暗号化していない `.env*` は pre-commit で止まります（`.env*.local` は gitignore 済みなので、平文の個人用設定に使えます）。

## タスク

```bash
just          # 利用可能なタスク一覧
just docs     # Markdown を http://docs.<リポジトリ名>.localhost:1355 で閲覧する
```

`just docs` は portless のプロキシを経由します。アプリのポートは起動ごとに空きが割り当てられ、git worktree ではブランチ名が前置されます（例: `feat/fix-ui` → `http://fix-ui.docs.<リポジトリ名>.localhost:1355`）。
sudo を不要にするため、[.envrc](.envrc) でプロキシを 1355 番・HTTP にし、`/etc/hosts` の同期を止めています。Safari は `.localhost` のサブドメインを解決できないため、Chrome / Firefox / Edge で開いてください。
プロキシを通さずに起動する場合は `PORTLESS=0 just docs` を使います（http://127.0.0.1:8080）。

レシピ名は frontend のみ `fe-*`、backend のみ `be-*`、DB / マイグレーションは `db-*`、両方 / リポジトリ全体は prefix なし。

```bash
just test         # fe-test + be-test
just lint         # fe-lint + be-lint
just format       # fe-format + be-format
just be-gen       # OpenAPI / SQL を変えたら再生成
just db-reset     # DB のデータを消して作り直す
```

## 設計の可視化

```bash
just db-doc       # ER 図とテーブル定義を docs/schema に生成する。just docs で閲覧
just be-api-doc   # OpenAPI のリファレンス (Redoc) を http://api-docs.<リポジトリ名>.localhost:1355 で閲覧する
```

`docs/schema` はコミットします。マイグレーションを変えたら `just db-doc` で再生成してください。CI (`backend-ci`) が `tbls diff` で古いままになっていないか検査します。

## テンプレート同期

生成直後は `init-from-template` スキルで README / AGENTS.md のプレースホルダを埋めてください。同期対象のファイルは削除しないこと（[adr/from-template/0001](adr/from-template/0001-sync-template-via-merge-commit.md)）。

テンプレート元が更新されると、`template-sync` workflow が毎週土曜 09:00 に draft PR（`template-sync` ブランチ）を用意します。手元で `just sync-pr` を実行すると、PR が取り込みの差分に置き換わり ready for review になります。

週次の対応は `bot-pr-routine` スキルで行えます。取り込み PR（`template-sync-review`）、Dependabot PR（`dependabot-review`）の順にレビューします。

```bash
just sync-pr   # テンプレート元の変更を取り込む PR を作る
just sync      # テンプレート元の変更を現在のブランチに取り込む
just update    # flake.lock を更新して検証する
```

- PR は **Create a merge commit** でマージしてください（squash / rebase は共通祖先を壊します）
- テンプレート元に open の Dependabot PR が残っていると、`just sync` / `just sync-pr` は止まります。処理が終わってから実行するか、`SYNC_IGNORE_OPEN_PRS=1` を付けて実行してください
- `flake.lock` の衝突は、テンプレートの input をテンプレート側、`flake = false` の project inputs を派生先側の値で解消します
- `apm.lock.yaml` の衝突は、テンプレート側の lock に派生先だけの依存を派生先側の版で書き戻し、`apm install` で解消します
- `.github/workflows/actions.lock` の衝突は、テンプレート側の lock に派生先だけの workflow と action を書き戻して解消します
- それ以外の衝突では止まるので、手で解消してください
- テンプレートの input や workflow だけを更新する Dependabot PR は、取り込み PR と重複するため `template-dependabot-close` workflow が閉じます
- draft PR の作成には、リポジトリ設定の **Allow GitHub Actions to create and approve pull requests** が必要です（`init-from-template` スキルが有効にします）

設計: [adr/from-template/0006](adr/from-template/0006-automate-template-sync-pr.md)

- 設計判断の記録: [adr/](adr/)
- 技術スタック（backend / frontend）: [docs/tech-stack.md](docs/tech-stack.md)
- 管理者ログインの運用（GitHub OAuth App、環境変数、失効）: [docs/admin-login.md](docs/admin-login.md)
- 動作確認とテストの手引き（ポート、e2e の結果の見方、DB と API の確認）: [docs/testing.md](docs/testing.md)
