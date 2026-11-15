---
status: 'accepted'
date: 2026-11-15
decision-makers: 'Hol1kgmg'
---

# skill / rules の取得元をすべてルートの apm.yml に直接書き、区画で分ける

## Context and Problem Statement

[ADR 0008](0008-revert-skill-sources-to-flake-inputs.md) は、Dependabot の `apm` ecosystem が取得元ごとに PR を立てないことを理由に、APM から flake input に戻した。その後の調査で、0008 の判断の根拠は次のように整理し直せた。

- 0008 の「`git:` 形式は ref を書いても対象外」に当たる取得元は、gist の 2 件と yomiyasu だった。yomiyasu は `skills:` で skill を選ぶために `git:` 形式を外せない。gist は写しで文字列形式にできるので、yomiyasu を外せばこの制約に当たる取得元はなくなる
- [ADR 0007](0007-manage-skills-and-rules-with-apm.md) の構成では、外部の取得元はすべて `packages/template/apm.yml` に書かれ、ルートの `apm.yml` はそれをローカルパスで参照するだけだった。Dependabot が更新の候補にするのは、そのディレクトリの `apm.yml` に直接書かれ、ref の付いた依存だけである（ジョブ定義の `"update-subdependencies": false`）。ルートから見ると外部の取得元は推移的な依存になり、`packages/template` 側は ref がなかったため、どちらのディレクトリでもチェックの対象が 0 件になった
- 推移的な依存の commit はルートの `apm.lock.yaml` に記録されるので、版の固定はできる。できないのは、Dependabot による取得元ごとの更新である。`apm.yml` から別の `apm.yml` を呼び出すと、呼び出し先の依存はこの更新から外れる。呼び出し先がリポジトリの内か外かは関係しない

Dependabot で取得元ごとに更新するには、外部の取得元をすべてルートの `apm.yml` に ref 付きで直接書く必要がある。取得元にはリリースのタグがないため、ref はブランチになる。

## Decision

skill / rules の取得元と配置を APM に移す。0007 の構成のうち、宣言の置き場所を次のように変える。

- 外部の取得元は、すべてルートの `apm.yml` に `owner/repo/path#main` の形で直接書く。テンプレート管理の区画と派生先管理の区画をコメントで分け、派生先は末尾の区画だけを編集する（[ADR 0005](0005-separate-template-and-project-files.md) の「別区画」）
- テンプレート独自の skill（init-from-template、template-sync-review、bot-pr-routine）は `packages/template/.apm/skills/` に置き、ルートからローカルパス `./packages/template` で参照する。ローカルなので Dependabot の対象外だが、テンプレート取り込み PR で届くので更新は要らない。テンプレート独自の rule を足すときは `packages/template/.apm/instructions/` に置く。パッケージ直下の `rules/` は apm が配置しないため、skill も rule と同じ `.apm/` の下に揃える
- 派生先の独自の skill / rule は `packages/project/.apm/skills/` と `packages/project/.apm/instructions/` に置き、ルートから `./packages/project` で参照する。`packages/project/apm.yml` はテンプレートが用意して変えないので、取り込みで衝突しない。リポジトリ直下の `skills/` と `rules/` は置かない
- gist の skill（cognitive-rhythm-writing、japanese-tech-writing）は、Hol1kgmg/skills に定期的に写したものを参照する（Hol1kgmg/skills#1）。gist を直接書くと、名前を付けられる `git:` 形式は Dependabot の対象外で、文字列形式では配置先のディレクトリ名が gist の ID になるため
- yomiyasu はテンプレートから外す
- Dependabot の `apm` は `directory: /` だけを見る
- cooldown は守られないことを受け入れる。skill / rules の PR は自動マージせず、レビューしてから手でマージするため
- Dependabot が書いた lock は、マージ前に `just apm-fix-lock <PR 番号>` で手元の apm で作り直す。Dependabot の apm は 0.34.0 に固定されていて（`dependabot-core/apm/helpers/build`）、ローカル依存の `content_hash` を記録しない。手元と CI の apm 0.35.0 の `apm install --frozen` は、その lock で失敗する。[dependabot-core#16792](https://github.com/dependabot/dependabot-core/pull/16792) がマージされたら、このレシピを消す

## Consequences

- Good, because 取得元ごとに Dependabot の PR が立ち、取得元ごとに採用するか見送るかを決められる
- Good, because 取得元の追加はルートの `apm.yml` の 1 行で済む
- Bad, because テンプレートと派生先が同じ `apm.yml` を編集する。区画を分けても、両側が近い行を変えれば衝突する。`apm.lock.yaml` の衝突は 0007 の `scripts/resolve-locks.sh` で解消する
- Bad, because ブランチの ref は、取得元のリポジトリに commit があれば、その skill に関係しない変更でも PR になる
- Bad, because gist の更新は Hol1kgmg/skills の同期を経由するので、同期の間隔に Dependabot の週次の間隔を足した分だけ遅れる。同期が週次なら最大 2 週間になる
- Bad, because cooldown がかからない。検証では、作成から約 13 時間の commit で PR が立った
- Bad, because dependabot-core#16792 がマージされるまで、skill / rules の PR ごとに `just apm-fix-lock` を実行する手間が増える。push すると Dependabot はその PR をリベースしなくなる

## Implementation Plan

- **Affected paths**: `apm.yml`、`apm.lock.yaml`、`packages/template/`、`packages/project/`、`flake.nix`、`flake.lock`、`justfile`、`scripts/resolve-locks.sh`、`.github/dependabot.yml`、`.github/workflows/`、`.gitignore`、`README.md`、`docs/lockfile-automation.md`、`.codex/rules/README.md`
- **Removed**: `sources*.nix`、`skills*.nix`、`rules*.nix`、`scripts/resolve-flake-lock.sh`、`rules/orca-worktree.md`（Hol1kgmg/rules から取得する）、`.claude/rules`（symlink）、`skills/` の 3 つの skill（`packages/template/.apm/skills/` に移す）、`skills/README.md`、`rules/README.md`（独自の skill / rule は `packages/project/.apm/` に置く）
- **Dependencies**: Hol1kgmg/skills#1（gist の写し）
- **Patterns to avoid**:
  - 外部の取得元を `packages/template/apm.yml` など、ルート以外の `apm.yml` に書くこと
  - ref のないエントリと `git:` 形式のエントリ

### Verification

- [x] 検証ブランチで、Dependabot がルートの `apm.yml` の 15 件をすべてチェックし、日付を戻した取得元ごとに `apm.lock.yaml` だけを変える PR を作成する。同じリポジトリの取得元もまとめられない
- [x] Dependabot が使う apm 0.34.0 の lock では `--frozen` が失敗し、0.35.0 で `apm install` をやり直すと通る（検証 PR #48 と手元の再現。作り直した lock は、0.35.0 で最初から作った lock と一致した）
- [x] `.agents/skills` と `.claude/rules` の一覧が、0008 の構成で配置していたものから yomiyasu を除いたものと一致する
- [ ] main で Dependabot の apm PR に `just apm-fix-lock` を実行し、CI の `check` が通る

## Alternatives Considered

- **0007 の構成（テンプレートの依存を `packages/template/apm.yml` に書く）**: 外部の取得元が推移的な依存になり、Dependabot の対象から外れる
- **テンプレートの依存一覧を Hol1kgmg/skills の直下の `apm.yml` に置き、`Hol1kgmg/skills#main` を取り込む**: 同じ理由で、取得元ごとの PR が立たない。Hol1kgmg/skills の commit を進める PR が 1 本立つだけで、更新は全採用か全却下になる
- **SHA で固定する**: APM の推奨はタグか SHA だが、Dependabot と `apm update` は SHA をリリースのタグが指す commit にしか進めない。取得元にリリースのタグがないため、更新されない
- **nix の構成（0008）を続ける**: 取得元の追加が 3 か所の編集のまま残る
- **dependabot-core#16792 のマージを待ってから移す**: マージの時期が分からない。手で直す手間は PR ごとに 1 回で、マージ後はレシピを消すだけで済む
- **CI で `--frozen` を外す**: lock と取得した中身の一致を CI で確かめられなくなる

## More Information

- 置き換え: [skill / rules の取得元を flake input に戻す](0008-revert-skill-sources-to-flake-inputs.md)
- 前提: [skill / rules を Nix から APM に移す](0007-manage-skills-and-rules-with-apm.md)
- 一部置き換え: [skill / rules の取得元を flake input にして Dependabot で更新する](0003-update-skill-sources-via-dependabot.md)、[skill / rules 以外の Dependabot PR を auto-merge する](0004-auto-merge-non-skill-dependabot-prs.md)、[テンプレート管理と派生先管理の宣言を別ファイル・別区画に分ける](0005-separate-template-and-project-files.md)（0007 で置き換え、0008 で戻した部分）
- 検証の記録: https://github.com/Hol1kgmg/claude-temp/issues/49
- 調査の詳細: [apm.yml から apm.yml を呼び出すと Dependabot で更新できなくなる](research/apm-nested-dependencies.md)
- APM の依存の書き方: https://github.com/microsoft/apm/blob/main/docs/src/content/docs/consumer/manage-dependencies.md
