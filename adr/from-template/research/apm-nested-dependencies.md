# apm.yml から apm.yml を呼び出すと Dependabot で更新できなくなる

skill や rules を [APM](https://github.com/microsoft/apm)（Agent Package Manager）で取り込み、Dependabot の `apm` ecosystem で取得元ごとに更新 PR を受け取ろうとしたときに分かった制約をまとめる。調査は 2026-11 に、apm 0.35.0 と、2026-11-03 に提供が始まった Dependabot の `apm` 対応で行った。

## Dependabot が更新する依存

Dependabot は、指定したディレクトリにある `apm.yml` の依存を更新し、同じディレクトリに `apm.lock.yaml` があれば作り直す。GitHub のドキュメントによれば、更新の対象になるのは ref の付いた git の依存で、ref の種類ごとに次のように扱う。

| ref | 更新先 |
|---|---|
| SemVer のタグ（`#v1.2.0`） | 最新の SemVer のタグ |
| commit の SHA | 最新のリリース（注釈付きで、プレリリースでないタグ）が指す commit |
| ブランチ（`#main`） | ブランチの最新の commit。`apm.yml` は変えず、`apm.lock.yaml` だけを更新する。lock が必要 |

次のエントリは更新の対象外である。

- ref のないエントリ（`owner/repo/skills/foo`）
- ローカルパス（`./packages/foo`）
- オブジェクト形式（`git:`、`path:` などのマップ）
- 短縮した SHA

この表と対象外の一覧は、GitHub のドキュメントの APM の節を要約で読んだものであり、原文とは突き合わせていない。

## 呼び出し先の依存は推移的な依存になる

APM では、`apm.yml` の依存に別の APM パッケージを書ける。ローカルパスでも、リポジトリ外のパッケージでもよい。呼び出し先の `apm.yml` に書かれた依存は、呼び出し元から見ると推移的な依存になる。

推移的な依存の版は、呼び出し元の `apm.lock.yaml` に固定される。APM のドキュメントによれば、lock は直接の依存と推移的な依存の両方について、解決した commit と内容のハッシュを記録する。したがって `apm install --frozen` を実行すれば、推移的な依存も同じ版で再現される。

しかし、Dependabot の apm のジョブ定義は `"update-subdependencies": false` で、更新の候補にするのは、指定したディレクトリの `apm.yml` に直接書かれた依存だけである。推移的な依存は、呼び出し元の lock に記録されていても候補にならない。そのため `apm.yml` から別の `apm.yml` を呼び出すと、呼び出し先に書いた依存は、Dependabot による取得元ごとの更新から外れる。呼び出し先がリポジトリの内か外かは関係しない。

| 呼び出し方 | 呼び出し先のエントリ | 呼び出し先にある依存 |
|---|---|---|
| ローカル（`./packages/template`） | 更新されない（ローカルパスのため） | 個別には更新されない |
| リポジトリ外（`owner/repo#main`） | 更新される（そのリポジトリの commit を進める PR が 1 本立つ） | 個別には更新されない |

## 実際に起きたこと

最初に試した構成では、テンプレートが管理する依存と、テンプレートから生成したリポジトリ（派生先）が管理する依存を、別のファイルに分けた。

```yaml
# /apm.yml（派生先が管理する）
dependencies:
  apm:
    - ./packages/template
```

```yaml
# /packages/template/apm.yml（テンプレートが管理する）
dependencies:
  apm:
    - anthropics/skills/skills/frontend-design
    - vercel/ai/skills/adr-skill
    # ...
```

Dependabot には `directories: [/, /packages/template]` を指定した。この構成では、Dependabot の apm の実行でチェックされた依存は 0 件だった。同じ時刻に動いた nix の実行は 5 件をチェックしていた。

0 件になった理由は、上の 2 つの規則の組み合わせで説明できる。ルートの `apm.yml` にある直接の依存はローカルパスだけで、対象外である。`packages/template/apm.yml` の依存はどれも ref がなく、これも対象外である。ref を付けても、`packages/template` には lock がないので、ブランチを指定した依存は更新の条件を満たさない。lock はルートにしかない。

ref の有無だけが原因かを確かめるため、依存に `#main` を付けたブランチで Dependabot を動かした。Dependabot は `apm.lock.yaml` だけを更新する PR を立てたので、ブランチの ref は更新の対象になることが分かった。

さらに、外部の取得元をすべてルートの `apm.yml` に `#main` 付きで直接書いた構成で Dependabot を動かした。Dependabot はルートの 15 件をすべてチェックし、日付を戻した取得元ごとに `apm.lock.yaml` だけを変える PR を立てた。同じリポジトリの取得元も、1 本の PR にはまとめられなかった。

## 取得元にリリースのタグがないとき

APM のドキュメントは、再現性のためにタグか SHA で固定することを勧めている（"Branches move; tags and SHAs do not. For reproducibility, prefer tags or SHAs."）。しかし、skill だけを公開するリポジトリでリリースのタグを打つものは少ない。今回の取得元のうち、anthropics/skills、addyosmani/web-quality-skills、cloudflare/security-audit-skill にはタグもリリースもなかった。vercel/ai にはリリースがあるが、`@ai-sdk/vue@3.0.330` のようなパッケージ単位のタグで、Dependabot がパッケージ単位のタグとして扱う条件（タグがリポジトリ名で始まること）に合わない。

タグがないと、SHA で固定しても、Dependabot には進める先がない。`apm update` も、SHA で固定した依存はリリースのタグが指す commit にしか進めない。タグのない取得元を Dependabot で更新するには、ブランチを指定するしかない。

## ブランチを指定したときに残る問題

ブランチを指定した構成では、次の 2 つが残った。

- **cooldown が守られない**：`cooldown.default-days: 2` を指定していたが、Dependabot が選んだのは実行の約 4 時間前の commit だった（検証 PR #39）。その後の検証でも、作成から約 13 時間の commit で PR が立った。nix の ecosystem では、公開から 2 日未満の commit を飛ばしていた。
- **Dependabot が使う apm の版が古い**：Dependabot の apm は 0.34.0 に固定されている（`dependabot-core/apm/helpers/build`）。Dependabot が書き直した lock では、`apm_version` が 0.35.0 から 0.34.0 に下がり、ローカルパッケージの `content_hash` が消えた。手元と CI の apm 0.35.0 で `apm install --frozen` を実行すると、この lock では失敗した。0.35.0 で `apm install` をやり直すと通り、作り直した lock は 0.35.0 で最初から作った lock と一致した（検証 PR #48）。[dependabot-core#16792](https://github.com/dependabot/dependabot-core/pull/16792) がマージされるまでは、`just apm-fix-lock <PR 番号>` で lock を作り直す。

## gist を取り込むとき

gist には `SKILL.md` が 1 つだけ置かれていることが多い。これを APM で取り込む書き方は 2 通りあるが、どちらも Dependabot の更新と両立しない。

- **オブジェクト形式**（`git:` に `ref` と `alias` を付ける）：`alias` で skill の名前を付けられる。しかし、オブジェクト形式は Dependabot の対象外である。
- **文字列形式**（`https://gist.github.com/<user>/<id>.git#main`）：Dependabot の対象になりうる。しかし、`alias` は文字列形式では使えないとドキュメントに明記されている。apm 0.35.0 で試すと、配置先のディレクトリ名が gist の ID になった（`.agents/skills/fd287c3133457c4fd8f5601d34aa817d/SKILL.md`）。lock の `name` には `SKILL.md` のフロントマターの名前が入るが、配置先には使われない。Agent Skills の仕様はフロントマターの `name` と親ディレクトリ名の一致を求めているので、この配置は仕様に合わない。

今回は、gist を自分の skill のリポジトリに定期的に写し、そのリポジトリを `owner/repo/skills/<name>#main` で参照することにした。

## 構成の指針

すべての外部の取得元を Dependabot で取得元ごとに更新するには、それらを Dependabot に指定したディレクトリの `apm.yml` に、ref 付きで直接書く必要がある。

```yaml
# /apm.yml
dependencies:
  apm:
    # --- テンプレート管理 ---
    - anthropics/skills/skills/frontend-design#main
    - vercel/ai/skills/adr-skill#main
    - ./packages/template   # テンプレート独自の skill。更新は取り込み PR で届く
    # --- 派生先管理 ---
    - owner/repo/skills/foo#main
```

宣言を管理者ごとに分けたい場合も、ファイルを分けずに、同じファイルの中の区画で分けることになる。別の `apm.yml` を呼び出してよいのは、ローカルの skill のように、Dependabot で更新する必要のないものに限られる。

## 確かめていないこと

- 呼び出し元の lock を作り直すとき（Dependabot の `apm lock` を含む）、推移的なブランチの ref が最新に解決し直されるのか、lock の commit のまま残るのか
- 呼び出し先のリポジトリに置いた `apm.lock.yaml` を、呼び出し元が使うかどうか。APM のドキュメントにはそのような記述が見つからなかった。依存先の `apm.yml` に書かれたタグや SHA が呼び出し元でも守られることは、ドキュメントに書かれている
## 参考

- Dependabot の APM 対応（GitHub Changelog）: https://github.blog/changelog/2026-11-03-dependabot-version-updates-support-agent-package-manager/
- Dependabot が対応する ecosystem: https://docs.github.com/en/code-security/dependabot/ecosystems-supported-by-dependabot/supported-ecosystems-and-repositories
- APM の依存の書き方: https://github.com/microsoft/apm/blob/main/docs/src/content/docs/consumer/manage-dependencies.md
