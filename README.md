# {app name}
{アプリの概要}

## 前提条件

[Nix](https://nixos.org/)（Flakes 有効）と [direnv](https://direnv.net/) がインストールされ、シェルに統合されていること。

macOS (Homebrew):

```bash
brew install nix direnv
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
direnv allow
```

just / gitleaks / lefthook のインストールと Git フックの設定が一括で行われます。
以降はリポジトリのディレクトリに入るだけで自動的に環境が有効になります。

## タスク

```bash
just          # 利用可能なタスク一覧
```

## テンプレート同期

テンプレート元の変更と lockfile の更新は、必要なときに手動で取り込みます。

```bash
just sync      # テンプレート元の変更を取り込む
just update    # flake.lock / sources.lock.json を更新して検証する
```

`just sync` はマージコミットで取り込みます。PR 経由にする場合も **Create a merge commit** を使ってください（squash / rebase は共通祖先を壊します）。

- 設計判断の記録: [adr/](adr/)
