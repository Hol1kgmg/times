# Quickstart: 記事の再掲載と関連記事

## 前提

```sh
just db-up
just db-migrate up   # 000013 まで
just db-seed
just be-dev          # 別のターミナル
just fe-dev          # 別のターミナル
```

## 1. 移行で表示が変わらない (FR-015, SC-005)

1. 移行の前に、トップとタイムラインで親子・HOT・並びのある Digest を開いて控える
2. `just db-migrate up` のあと、同じ画面を開き、控えと同じであることを確かめる

## 2. 再掲載を登録する (US1)

1. 公開済みの Digest に載っている記事 A の URL を控える
2. `/admin/digests/new` で A の URL と新しい URL B を入れ、B を A の関連記事にして公開で保存する
3. 編集画面に移り、A の行に「再掲載として登録しました」が出ることを確かめる
4. A の行を消して保存し直すと、元の日の A はタイムラインに残ることを確かめる

## 3. 当日の表示 (US2)

1. トップで A の下に B が並び、A のタイトルの下に「再掲載」が出て、編集画面の A の行に「再掲載 · 〜に初掲載」(元の日付) が出ることを確かめる
2. タイムラインで元の日の Digest を見ると、A に B が付いていないことを確かめる

## 4. 断られる (US3)

| 操作 | 期待 |
|---|---|
| A を子なしの親として保存 | A の行に「再掲載には新しい記事を子に付けてください」 |
| A を別の記事の子として保存 | A の行に「既に登録済みです」 |
| 下書きの Digest にだけ載っている記事を親にして子を付けて保存 | その行に「既に登録済みです」 |

## 5. Storybook のデモ

```sh
just fe-storybook
```

`shared/ui/DigestPost` の `Repost` / `RepostWithAskAi` と、`pages/digest-editor/ui/LinkMeta` の `Reposted` / `RepostNotice` / `RepostNeedsChild` を開く (contracts/ui.md)。ライトとダークの両方で確かめる。

## 6. 自動テスト

```sh
just be-gen
just lint && just test        # classifyReposts・toDigest・apperr の unit、rejection-of と search の Vitest
just fe-typecheck
just fe-test-e2e digest-repost  # quality.md の手順で be-dev-e2e に切り替えて回す
```
