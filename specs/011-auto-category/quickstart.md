# Quickstart: 記事のカテゴリを AI で推定して振り分ける

## ローカル (推定なし、方針 A)

1. `just be-dev` と `just fe-dev` を起動し、管理者でログインする。
2. `/admin/digests/new` で URL を追加する。
3. 期待すること: タイトルが入り、候補は未分類に残る。エラーは出ない (US1 のシナリオ 5)。

## 自動テスト

```sh
just lint && just test     # board.test.ts、category-suggestion.server.test.ts
just fe-typecheck
pnpm -C frontend build     # cloudflare:workers の external がビルドを通すこと
```

e2e は回さない。保存の形とサーバー関数 → backend の受け渡しは変えないため。

## デプロイ先 (推定あり)

main に入れると、Workers Builds が `wrangler.toml` の `[ai]` binding 込みでデプロイする。

1. 本番の `/admin/digests/new` で、分野のはっきりした記事 (AI のニュースなど) を追加する。
2. 期待すること: 候補が「AI系」の箱の末尾に入り、推定の印が付く (US1-1、US2-1)。
3. その候補を別の箱へドラッグすると、印が消える (US2-3)。同じ箱で並び替えたときは残る (US2-4)。
4. 登録してから編集画面で開き直すと、印はどこにもない (US2-5)。
