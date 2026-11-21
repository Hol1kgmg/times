---
status: 'accepted'
date: 2026-11-16
decision-makers: 'Hol1kgmg'
---

# GitHub Actions の依存を workflow lockfile で固定し、jactionlint で検査する

## Context and Problem Statement

workflow の `uses:` はフル SHA と `# vN` コメントで固定していた。この方法では、composite action などが内部で使う推移的な依存を固定できない。2026-10-28 に GA になった workflow dependency lockfiles（`.github/workflows/actions.lock`）を使うと、`uses:` をタグで書いたまま、実行するコミットと推移的な依存を固定できる（#55）。

`gh actions-lock` は lockfile をタグをキーにして記録する。SHA pin を残すと、lockfile のエントリが workflow のどの参照とも対応せず、ツールも「bare SHA」と警告するだけになる。

## Decision

- `uses:` はタグで書き、コミットを `.github/workflows/actions.lock` に固定する。移行時のコミットは SHA pin と同じ（`actions/checkout` は `fbc6f39`、`nix-installer-action` は `786fff0`）
- `jactionlint`（default プロファイル）と `gh-actions-lock --verify` を `just lint-actions` にまとめ、CI の `check` で実行する。必須チェックの名前は変えない
- 両ツールは nixpkgs-unstable から入れる。devenv-nixpkgs の `jactionlint` と `gh-actions-lock` は古い
- `dependabot-cooldown` の下限は 2 日に下げる。テンプレートの Dependabot PR を、派生側の template-sync（土曜 09:00）より前に処理するため
- `actions.lock` の衝突は `scripts/resolve-locks.sh` で解消する。テンプレート側の lock に、派生側だけの workflow と action を書き戻す
- Require lockfile ポリシーはまだ有効にしない

## Consequences

- Good, because 推移的な依存も固定され、lockfile の更新漏れを `check` が検出する
- Good, because `jactionlint` が permissions、timeout、pipefail などの問題を PR の時点で検出する
- Bad, because `resolve-locks.sh` が yq で書き直した lockfile は、ヘッダーのコメントとクォートを失う。ツールは読めるが、次に `gh-actions-lock` を実行したときに差分が出る
- Neutral, because Dependabot の `github-actions` 更新が lockfile も一緒に更新するかは、まだ本番で確認していない。更新しなかった場合は `check` が落ちて自動マージが止まるので、PR のブランチで `gh-actions-lock` を実行して push する

## Implementation Plan

- **Affected paths**: `.github/workflows/`、`.github/workflows/actions.lock`、`.github/jactionlint.yaml`、`.github/dependabot.yml`、`flake.nix`、`justfile`、`scripts/resolve-locks.sh`、`README.md`
- **Patterns to avoid**:
  - `uses:` を SHA で書くこと（lockfile と対応しなくなる）
  - workflow だけを変えて `actions.lock` を更新しないこと

### Verification

- [x] `gh-actions-lock --verify` と `jactionlint` が通る
- [x] `uses:` の版を lockfile と食い違わせると、`just lint-actions` が `actions-lock` ルールで失敗する
- [x] `actions.lock` が衝突した場合に、`resolve-locks.sh` がテンプレート側の版に揃え、派生側だけの workflow と action を残す
- [ ] Dependabot の `github-actions` PR で `actions.lock` が一緒に更新され、自動マージされる
- [ ] 派生リポジトリの取り込み PR で `check` が通る

## Alternatives Considered

- **SHA pin を残して lockfile を足す**: lockfile が workflow の参照と対応せず、推移的な依存も固定されない
- **lint 用に別の workflow を作る**: ブランチ保護の必須チェックを足す必要があり、派生側の設定も変わる
- **jactionlint の correctness プロファイル**: セキュリティとポリシーのルールが入らない
- **pedantic プロファイル**: 指摘の大半がスタイル（`shell:` の明示、式の括弧など）で、検査の効果に対して書き換えが多い

## More Information

- issue: https://github.com/Hol1kgmg/claude-temp/issues/55
- workflow dependency lockfiles: https://docs.github.com/en/actions/concepts/security/workflow-dependency-lockfiles
- jactionlint: https://jactionlint.jdx.dev/usage
