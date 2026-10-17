---
name: init-from-template
description: Hol1kgmg/claude-temp をテンプレートにして生成した直後のリポジトリで、README.md / AGENTS.md / adr/README.md に残るテンプレートのプレースホルダ（{app name} など）を埋め、不要なセクションを削る。「テンプレートの初期化」「プレースホルダを埋めて」「テンプレート固有のものを消して」と言われたとき、または生成直後のリポジトリで README に {app name} が残っているときに使う。
allowed-tools: Bash(git remote:*), Bash(nix flake check:*), Read, Edit, Grep, Glob, AskUserQuestion
---

# init-from-template — テンプレート生成直後の初期化

テンプレートから生成したリポジトリに残るプレースホルダを、そのリポジトリの情報で置き換える。

## 消してはいけないもの

`just sync` はテンプレート元を **マージコミット** で取り込み続ける（[adr/from-template/0001](../../adr/from-template/0001-sync-template-via-merge-commit.md)）。同期対象のファイルを派生側で削除すると、テンプレート元がそのファイルを後で変更した時点で modify/delete 衝突が毎回起きる。したがって次は削除しない:

- `adr/from-template/`、`docs/`、`justfile` の `sync` レシピ、`.github/`、`skills/init-from-template/`（このスキル自身）
- README.md の「テンプレート同期」節

やることはプレースホルダの **置換** と、AGENTS.md の任意セクションの削除だけ。

## 手順

### 1. ガード

```bash
git remote get-url origin
```

`Hol1kgmg/claude-temp` 自身なら中断する（テンプレート本体のプレースホルダを埋めてしまう）。

対象ファイルにプレースホルダが残っているかを Grep で確認する。1 つも無ければ「すでに初期化済み」と報告して終了する。

```
pattern: \{app name\}|\{アプリの概要\}|\{プロジェクトの概要|\{※|\{DIRECTORY_STRUCTURE_FILE\}|\{TROUBLESHOOTING_FILE\}
files: README.md AGENTS.md adr/README.md
```

### 2. 情報を集める

AskUserQuestion で一度にまとめて聞く。引数で渡されていればその分は聞かない。

| 項目 | 使う場所 |
|---|---|
| アプリ名 | README.md の見出し、adr/README.md のディレクトリ名 |
| 概要（1〜2 文） | README.md 2 行目、AGENTS.md の Project Overview |
| Directory Structure ドキュメントの要否（要るならファイル名） | AGENTS.md |
| Troubleshooting ドキュメントの要否（要るならファイル名） | AGENTS.md |

### 3. 置換する

Edit で行う。sed は使わない。

**README.md**

- `# {app name}` → `# <アプリ名>`
- `{アプリの概要}` → 概要

**AGENTS.md**

- `{プロジェクトの概要を記述 (例: ...)}` の行 → 概要（AGENTS.md は英語セクション見出しだが本文は日本語でよい）
- Directory Structure: 不要なら `# Directory Structure` から次の `#` 見出しの直前まで削除。要るなら `{※...}` の行を消し、`{DIRECTORY_STRUCTURE_FILE}` 2 箇所をファイル名（拡張子なし）に置換
- Troubleshooting: 同様に削除、または `{※...}` の行を消して `{TROUBLESHOOTING_FILE}` 2 箇所を置換

**adr/README.md**

- 表の `` `{app name}/` `` → `` `<アプリ名>/` ``

ディレクトリ `adr/<アプリ名>/` はこの時点では作らない。最初の ADR を書くときに `adr-skill` が作る。

### 4. 確認

- 手順 1 の Grep を再実行し、ヒットが 0 であること
- 参照先ファイルを指定した場合、そのファイルが存在するか Glob で確認し、無ければ「作成が必要」と報告する（勝手に作らない）
- `nix flake check` を実行（skills.nix / rules.nix の解決が壊れていないことの確認）

### 5. 後片付けの提案

変更は自動でコミットしない。差分を要約し、次を提案する:

- コミット（例: `chore: テンプレートのプレースホルダを埋める`）
- `skills.nix` で不要なスキルを行ごと消す（派生ごとに判断が異なるため、このスキルでは触らない）
