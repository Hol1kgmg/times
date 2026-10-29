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

エージェント用スキルは `skills.nix` の宣言から devShell 起動時に `.agents/skills` へ同期されます
（`just skills` / `just skills-list`）。取得元は `flake.nix` の `flake = false` な input で、独自スキルは [skills/](skills/) に置きます。
エージェント用のルール（`.claude/rules/*.md`）も同じ流儀で、`rules.nix` の宣言から `.agents/rules` へ同期されます
（`just rules` / `just rules-list`）。独自ルールは [rules/](rules/) に置きます。

### テンプレート管理と派生先管理の分離

`just sync` の衝突を避けるため、テンプレートが更新する部分と派生先が編集する部分を分けています。派生先では左の列だけを編集してください。

| 派生先が編集する | テンプレートが管理する（編集しない） |
|---|---|
| `skills.nix` / `rules.nix`（`enable` で追加、`disable` で除外） | `skills.template.nix` / `rules.template.nix` |
| `sources.nix`（skill / rules の取得元） | `sources.template.nix` |
| `flake.nix` の `inputs` 末尾の「project inputs」区画 | `flake.nix` の `inputs` のそれ以外 |
| `flake.nix` 末尾の `devShells.default` | `flake.nix` の `devShells.template` |

`flake.lock` は両側が更新します。`just sync` が衝突を input 単位で自動解消します（下の「テンプレート同期」）。

取得元の更新は Dependabot（`nix` ecosystem）が input ごとに PR を出します。マージ前に `dependabot-review` スキルで差分をレビューしてください。

## 環境変数

`.env*` は [dotenvx](https://dotenvx.com/) で暗号化してコミットします。復号鍵の `.env.keys` は gitignore 済みなので、チームにはリポジトリ外で共有してください。

```bash
dotenvx set API_KEY xxx              # .env に暗号化して追加（初回は .env.keys も生成される）
dotenvx set API_KEY xxx -f .env.dev  # 環境ごとのファイル
dotenvx run -- <cmd>                 # 復号して <cmd> に渡す（-f .env.dev で切替）
```

CI などでは `.env.keys` の代わりに `DOTENV_PRIVATE_KEY`（`.env.dev` なら `DOTENV_PRIVATE_KEY_DEV`）を渡します。
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

## テンプレート同期

生成直後は `init-from-template` スキルで README / AGENTS.md のプレースホルダを埋めてください。同期対象のファイルは削除しないこと（[adr/from-template/0001](adr/from-template/0001-sync-template-via-merge-commit.md)）。

テンプレート元が更新されると、`template-sync` workflow が毎週土曜 09:00 に draft PR（`template-sync` ブランチ）を用意します。手元で `just sync-pr` を実行すると、PR が取り込みの差分に置き換わり ready for review になります。

```bash
just sync-pr   # テンプレート元の変更を取り込む PR を作る
just sync      # テンプレート元の変更を現在のブランチに取り込む
just update    # flake.lock を更新して検証する
```

- PR は **Create a merge commit** でマージしてください（squash / rebase は共通祖先を壊します）
- テンプレート元に open の Dependabot PR が残っていると、`just sync` / `just sync-pr` は止まります。処理が終わってから実行するか、`SYNC_IGNORE_OPEN_PRS=1` を付けて実行してください
- `flake.lock` の衝突は、テンプレートの input をテンプレート側、`flake = false` の project inputs を派生先側の値で解消します。それ以外の衝突では止まるので、手で解消してください
- テンプレートの input や workflow だけを更新する Dependabot PR は、取り込み PR と重複するため `template-dependabot-close` workflow が閉じます
- draft PR の作成には、リポジトリ設定の **Allow GitHub Actions to create and approve pull requests** が必要です（`init-from-template` スキルが有効にします）

設計: [adr/from-template/0006](adr/from-template/0006-automate-template-sync-pr.md)

- 設計判断の記録: [adr/](adr/)
- 技術スタック（backend / frontend）: [docs/tech-stack.md](docs/tech-stack.md)
- 管理者ログインの運用（GitHub OAuth App、環境変数、失効）: [docs/admin-login.md](docs/admin-login.md)
- 動作確認とテストの手引き（ポート、e2e の結果の見方、DB と API の確認）: [docs/testing.md](docs/testing.md)
