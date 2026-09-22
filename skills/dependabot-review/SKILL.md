---
name: dependabot-review
description: openなdependabotのPRを一覧し、ユーザーが選んだ対象PRについてマージ可能かをレビューする(デフォルトはcheck-only)。CI状態・コンフリクト有無を確認したうえで、ecosystemごとに専用skill(dependabot-review-semver / dependabot-review-nix-flake)へ委譲してバージョン差分と判定を行い、レポートに統合する。ユーザーが複数PRのマージを明示指示した場合のみ、1件ずつマージ→残りをrebaseする手順に従いマージを実施する。
allowed-tools: Bash(gh pr list:*), Bash(gh pr view:*), Bash(gh pr diff:*), Bash(gh pr checks:*), Bash(gh pr merge:*), Bash(gh pr comment:*), Bash(gh run list:*), Read, Grep, Glob, Skill, AskUserQuestion
---

# dependabot-review — dependabot PR マージ可否レビュー(デフォルトcheck-only)

openな dependabot PR を洗い出し、ユーザーが選んだ対象について CI・コンフリクト・変更内容を確認し、マージ可否を判定してレポートする。
変更内容の確認と判定は、対象PRのecosystemに応じて専用のsub-skillに委譲する。ecosystemは `.github/dependabot.yml` に定義されているものが全てで、以下の通り:

| ecosystem | directory | 委譲先skill | 対象ファイル |
|---|---|---|---|
| `npm` | `/` | [dependabot-review-semver](../dependabot-review-semver/SKILL.md) | ルート `package.json` の `packageManager`(pnpm本体) |
| `npm` | `/frontend` | dependabot-review-semver | `frontend/package.json`, `frontend/pnpm-lock.yaml` |
| `github-actions` | `/` | dependabot-review-semver | `.github/workflows/*.yml`(SHA pin と `# vN` コメント) |
| `gomod` | `/backend` | dependabot-review-semver | `backend/go.mod`, `backend/go.sum` |
| `docker` | `/`, `/backend` | dependabot-review-semver | `compose.yaml`, `backend/Dockerfile` のイメージタグ |
| `nix` | `/` | [dependabot-review-nix-flake](../dependabot-review-nix-flake/SKILL.md) | `flake.lock` |

sub-skillはSkillツールで呼び出す。同一セッション内で継続実行されるため、sub-skillが出した判定結果をそのまま使ってレポートを作成できる。

**デフォルトはチェックと報告のみを行う。`gh pr merge` / `gh pr close` などの状態変更操作は、ユーザーが明示的にマージを指示するまで行わない。**
- 1件のみのマージ指示 → `gh pr merge <番号> --squash --delete-branch` でよい
- 同一 ecosystem / directory(= 同一lockfileに触る)の**複数PR**のマージ指示 → 下記「複数PR承認時のマージ手順」に従う

## 手順

### 1. openな dependabot PR の一覧取得

```
gh pr list --author "app/dependabot" --state open --json number,title,headRefName,createdAt,url
```

- 結果が0件なら「openなdependabot PRはありません」と報告して終了する

### 2. ユーザーに対象PRを確認

AskUserQuestion で取得した一覧を提示し、どのPRをレビュー対象にするか選んでもらう。
- 選択肢には「すべてレビューする」を含める
- `$ARGUMENTS` にPR番号が明示されていればこのステップは省略し、指定されたPRを対象とする

### 3. ecosystemの判定

各対象PRの `headRefName` の先頭セグメントからecosystemを判定する(dependabotのブランチ命名規則: `dependabot/<package-manager>/<directory>/...`)。

| `headRefName` プレフィックス | ecosystem |
|---|---|
| `dependabot/npm_and_yarn/` | npm(直後のセグメントが `frontend/` なら `/frontend`、なければ `/`) |
| `dependabot/github_actions/` | github-actions |
| `dependabot/go_modules/` | gomod |
| `dependabot/docker/` | docker |
| `dependabot/nix/` | nix |

判定に迷う場合は `gh pr view <番号> --json files` で変更ファイルを確認する。

対象PRを ecosystem / directory ごとにグルーピングする。

### 4. 対象PRごとの詳細確認

各PRについて以下を取得・確認する(ecosystem共通の部分)。

**基本情報とマージ可否**
```
gh pr view <番号> --json number,title,body,mergeable,mergeStateStatus,additions,deletions,changedFiles,labels,url
```
- `mergeable` が `CONFLICTING` の場合はコンフリクトありとして明記する
- `mergeStateStatus` が `BLOCKED` の場合は理由(レビュー必須・CI未完了等)を推測して記載する

**CI状態**
```
gh pr checks <番号>
```
- 失敗しているチェックがあれば名前と結果を記載する
- pending中のチェックがあれば「CI実行中のため判定保留」と明記する

**変更内容とバージョン差分の判定(ecosystem別に委譲)**

ステップ3でグルーピングしたecosystemごとに、対応するsub-skillをSkillツールで呼び出す。呼び出し時は対象PR番号(複数可)を渡す。

- npm / github-actions / gomod / docker のPR → `Skill(skill: "dependabot-review-semver", args: "<対象PR番号...>")`
- nix のPR → `Skill(skill: "dependabot-review-nix-flake", args: "<対象PR番号...>")`

各sub-skillは、PRごとに「バージョン差分の種別」「判定(✅/⚠️/❌)」「⚠️の場合の確認事項」を返す。これを次のステップのレポートに使う。

### 5. レポート出力

チャット上に以下の形式で報告する:

```
## dependabot PR レビューレポート

| PR | パッケージ | バージョン | 種別 | CI | コンフリクト | 判定 | 備考 |
|---|---|---|---|---|---|---|---|
| #12 | eslint-plugin-... | 1.0.0→1.0.1 | patch | ✅ | なし | ✅ マージ推奨 | - |
| #5  | npm-minor-patch (group) | ... | minor | ✅ | なし | ⚠️ 要確認 | 8パッケージ一括更新、@tanstack/* を個別確認推奨 |
| #33 | nixpkgs | rev変更 | nodejs_24 変化 | ✅ | なし | ⚠️ 要確認 | nodejs_24: 24.15.0→24.16.0、go/sqlc/oapi-codegen 変化なし |

### 詳細(要確認・非推奨のPRのみ)
- PR番号ごとに判定理由と確認事項を記載

### 対象外(レビュー未実施)
- 一覧取得したがユーザーが選ばなかったPRの番号とタイトル
```

- レポート末尾に「マージを進める場合は対象PR番号を指定してください」と付記し、実際のマージはユーザー指示を待つ

## 複数PR承認時のマージ手順

ユーザーが同一 ecosystem / directory(例: `npm` / `/frontend`、`gomod` / `/backend`、`nix` / `/`)の dependabot PR を**2件以上まとめてマージ**するよう指示した場合にのみ、この手順を使う。対象PRが1件のみ、または互いに異なる ecosystem / directory(同一lockfileを触らない)の場合は、個別に `gh pr merge <番号> --squash --delete-branch` すればよい。

### なぜ必要か

同一lockfileを触る複数PRを連続squashマージすると、各PRの lockfile 差分が「PR作成時点のmain」を基準にしたテキストパッチであるため、GitHub上ではコンフリクトとして検出されないまま lockfile が破損することがある(例: `pnpm-lock.yaml` に同じパッケージのエントリが重複して main のCIが壊れる)。これを防ぐため、1件マージするごとに残りのPRを dependabot に最新mainで作り直させてから次をマージする。

### 手順

1. マージ順を決める(通常はPR番号の昇順。ユーザー指定があればそれに従う)
2. 先頭のPRをマージする:
   ```
   gh pr merge <PR番号1> --squash --delete-branch
   ```
3. 残りの各PRに dependabot の rebase を依頼する(dependabot が最新mainを基準に lockfile を再生成して force-push する):
   ```
   gh pr comment <PR番号2> --body "@dependabot rebase"
   ```
4. rebase 完了後に再実行されたCIの結果を確認する(数分かかる。完了まで待つ):
   ```
   gh pr checks <PR番号2> --watch
   ```
   全てpassしたら次をマージする。失敗していれば内容をユーザーに提示し、指示を仰ぐ(自動で修正しない)
5. 残りPRがなくなるまで 2〜4 を、次のPRを対象にして繰り返す
6. 全マージ後、mainのCIが成功していることを確認する:
   ```
   gh run list --branch main --limit 1
   ```

### 注意事項

- rebase で dependabot がコンフリクトを解消できなかった場合、PRに dependabot がその旨コメントする。その場合は自動解決せず、ユーザーに提示して指示を仰ぐ
- `@dependabot rebase` はPRに手動コミットがあると拒否される。dependabot PR に手を入れている場合はユーザーに知らせる
