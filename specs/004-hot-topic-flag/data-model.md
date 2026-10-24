# Data Model: ホットトピックをカテゴリから記事のフラグへ移す

## articles (変更)

| 列 | 型 | 制約 | 変更 |
|---|---|---|---|
| `category` | text | NOT NULL、CHECK 6 値 (セキュリティ、IT系、UI系、AI系、面白そうなツール・サービス、その他) | CHECK から `'ホットトピック'` を外す |
| `is_hot` | boolean | NOT NULL DEFAULT false | 追加 |

ほかの列 (`id`, `digest_id`, `position`, `title`, `url`, `description`) と制約、`digests` / `article_links` は変えない。

### 値の決まり

- 親の行の `is_hot` が、その記事がホットトピックかどうかを表す (FR-002)。
- 子の行は `category` と同じく、親の `is_hot` を引き継いで持つ (research R2)。API では子の値を出さない。
- 登録で `hot` が省略された記事は `false` (FR-003)。DB の DEFAULT と handler の nil → false の両方で守る。
- 1 Digest あたりの `is_hot = true` の件数に上限はない。

## migration 000006

**up** (1 トランザクション):

1. `is_hot` 列を追加する (既存行は DEFAULT で false)
2. `articles_category_check` を外す
3. `category = 'ホットトピック'` の行 (親も子も) を `is_hot = true, category = 'その他'` にする (FR-009)
4. 6 値の `articles_category_check` を付け直す

**down**:

1. `articles_category_check` を外す
2. `is_hot = true` の行を `category = 'ホットトピック'` にする (訂正した本来のカテゴリは失われる。spec Edge Cases)
3. 7 値の `articles_category_check` を付け直す
4. `is_hot` 列を削除する

## API の形

[contracts/openapi.md](./contracts/openapi.md) を参照。

## 表示 (派生値、保存しない)

- 区画はカテゴリだけ。カテゴリは固定順、中は登録順 (`position`)。`hot` で並びは変えない。
- `hot = true` の親の記事行にだけ、ホットトピックの印 (炎 + HOT) を付ける。
