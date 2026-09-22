---
name: dependabot-review-nix-flake
description: dependabot-reviewから委譲される、nix ecosystem(flake.lock)向けのバージョン差分判定sub-skill。flake.lockはrevハッシュの差分しか見えずsemver判定ができないため、nix evalでPR前後のflake.nix管理パッケージの実バージョンを解決して比較する。単独では呼び出さない。
allowed-tools: Bash(gh pr diff:*), Bash(nix eval:*), Read
---

# dependabot-review-nix-flake — nix flake.lock のバージョン差分判定

[dependabot-review](../dependabot-review/SKILL.md) から `nix` ecosystem のPR番号を渡されて呼び出される。単独では使わない。

## なぜ semver 判定ができないか

`flake.nix` の input はすべてタグなしのコミット追従(`nixpkgs` は `cachix/devenv-nixpkgs/rolling`)。dependabot のPRタイトルは `bump nixpkgs from <hash> to <hash>` の形式で、`gh pr diff` で見える `flake.lock` の差分も rev/narHash の変化だけ。実際にどのツールがいくつからいくつに動いたかは分からないため、`nix eval` で実バージョンを解決して比較する。

## 手順

### 1. 変化したinputの特定

```
gh pr diff <番号> -- flake.lock
```

差分の中で `locked.rev` が変わっている**直接 input**(`flake.nix` の `inputs` に列挙されているもの)を特定し、旧rev・新revを控える。直接 input は以下の4つ:

| input | 中身 | 影響 |
|---|---|---|
| `nixpkgs` | devShell のツール一式 | ステップ3で実バージョンを比較 |
| `nur-packages` | `markserv`, `spec-kit` | ステップ4で実バージョンを比較 |
| `agent-skills` | スキル配布ライブラリ | `nix flake check`(CI)が通れば追加確認不要 |
| `flake-utils` | ビルドヘルパー | CI が通れば追加確認不要 |

各 input の下位(`nur-packages` 配下の `nixpkgs` や `rust-overlay` 等)だけが変わっている場合も、その親 input の rev が変わっているので親で扱う。

### 2. 旧・新の解決方法

**旧側は必ずローカルの `flake.lock`(main の checkout)から解決する。** `nixpkgs` の `rolling` ブランチは履歴が書き換えられるため、旧 rev を `github:...` で直接指定すると tarball が 404 になることがある(ローカルの lock 済み rev は nix store にキャッシュ済みなので解決できる)。

```
# 旧(ローカル lock)
nix eval --impure --raw --expr '(builtins.getFlake (toString ./.)).inputs.<input>.<attrPath>.${builtins.currentSystem}.<attr>.version'
# 新(PR の新 rev)
nix eval --impure --raw --expr '(builtins.getFlake "github:<owner>/<repo>/<NEW_REV>").<attrPath>.${builtins.currentSystem}.<attr>.version'
```

新側の解決に失敗した場合はネットワークか rev の問題なので、「属性解決失敗」ではなく「解決不能」として要確認扱いにする。

### 3. `nixpkgs` が変化している場合

`flake.nix` の `devShells.default.packages` に列挙された nixpkgs 属性のうち、以下を旧・新で解決して比較する(`flake.nix` に追加/削除があれば追随する)。`<input>` は `nixpkgs`、`<attrPath>` は `legacyPackages`、`<owner>/<repo>` は `cachix/devenv-nixpkgs`。

- 判定に影響する属性: `nodejs_24`, `go`, `sqlc`, `oapi-codegen`
- 参考として一覧に載せる属性: `just`, `gitleaks`, `lefthook`, `gh`, `gh-dash`, `gopls`

`nodejs_24` の旧側は CI も参照している `packages.node` で代用できる(`nix eval --raw .#node.version`)。

- 各属性について旧→新のバージョンを一覧化する(変化なしも「変化なし」と明記する)
- 旧側では解決できたが新側で属性が見つからない場合(nixpkgs の属性パスがリネームされた等)は「属性解決失敗」として要確認扱いにする

### 4. `nur-packages` が変化している場合

`<input>` は `nur-packages`、`<attrPath>` は `packages`、`<owner>/<repo>` は `Hol1kgmg/nur-packages`。対象属性は `markserv` と `spec-kit`。

旧→新を一覧化する。`spec-kit` が変わっていれば、`skills/README.md` に従い `specify integration upgrade` 後の `speckit-*` スキル移動が必要になりうる旨を確認事項に書く。

### 5. 判定基準

| 判定 | 条件 |
|---|---|
| ✅ マージ推奨 | CI全て成功 かつ コンフリクトなし かつ `nodejs_24` / `go` / `sqlc` / `oapi-codegen` / `spec-kit` に変化なし |
| ⚠️ 要確認 | 上記いずれかのバージョンが変化/属性解決失敗、のいずれかに該当 |
| ❌ マージ非推奨 | CI失敗 または コンフリクトあり |

⚠️ にする理由と、記載すべき確認事項:

- **`nodejs_24`**: frontend のランタイム。`docs/tech-stack.md` の記載との整合性と、Cloudflare Workers 側の対応状況を確認する。CI の setup-node は `packages.node` に自動追従する
- **`go`**: backend のランタイム。`backend/go.mod` の `go` ディレクティブとの整合性を確認する
- **`sqlc` / `oapi-codegen`**: 生成コードが変わりうる。マージ後に再生成して差分が出ないか(出るならコミットが必要か)を確認する
- **`spec-kit`**: `speckit-*` スキルの更新が必要になりうる(ステップ4参照)

### 6. 呼び出し元への結果の受け渡し

同一セッション内で継続実行されるため、明示的な戻り値の受け渡しは不要。PRごとに「変化したinput」「主要パッケージのバージョン比較表」「判定」「⚠️の場合の確認事項」を確定させ、呼び出し元のレポート出力ステップでそのまま使う。
