# {app name}
{アプリの概要}

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

`just docs` も 8080 番を使うため、`be-dev` と同時には動かせません（`PORT=8081 just be-dev` で回避）。

## 開発環境

`direnv` が `flake.nix` の devShell を読み込み、次のツールが PATH に入ります。

| ツール | 用途 |
|---|---|
| just | タスクランナー（[justfile](justfile)） |
| gitleaks / lefthook | pre-commit でステージ済みの差分をシークレット走査する（[lefthook.yaml](lefthook.yaml)） |
| gh / gh-dash | GitHub 操作 |
| markserv | `just docs` で Markdown を http://localhost:8080 に配信する |
| go / gopls / sqlc / oapi-codegen | backend 開発（[docs/tech-stack.md](docs/tech-stack.md)）。Postgres と golang-migrate は Docker Compose で動かす |

エージェント用スキルは `skills.nix` の宣言から devShell 起動時に `.agents/skills` へ同期されます
（`just skills` / `just skills-list` / `just skills-update`）。独自スキルは [skills/](skills/) に置きます。

## タスク

```bash
just          # 利用可能なタスク一覧
just docs     # Markdown を http://localhost:8080 で閲覧する
```

レシピ名は frontend のみ `fe-*`、backend のみ `be-*`、DB / マイグレーションは `db-*`、両方 / リポジトリ全体は prefix なし。

```bash
just test         # fe-test + be-test
just lint         # fe-lint + be-lint
just format       # fe-format + be-format
just be-gen       # OpenAPI / SQL を変えたら再生成
just db-reset     # DB のデータを消して作り直す
```

## テンプレート同期

テンプレート元の変更と lockfile の更新は、必要なときに手動で取り込みます。

```bash
just sync      # テンプレート元の変更を取り込む
just update    # flake.lock / sources.lock.json を更新して検証する
```

`just sync` はマージコミットで取り込みます。PR 経由にする場合も **Create a merge commit** を使ってください（squash / rebase は共通祖先を壊します）。

- 設計判断の記録: [adr/](adr/)
- 技術スタック（backend / frontend）: [docs/tech-stack.md](docs/tech-stack.md)
