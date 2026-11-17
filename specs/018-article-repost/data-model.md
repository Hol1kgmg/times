# Data Model: 記事の再掲載と関連記事

## テーブル

### articles (変更)

記事そのもの。利用者ごとに URL で一意。

| 列 | 型 | 制約 | 変更 |
|---|---|---|---|
| id | uuid | PK | そのまま |
| category | text | NOT NULL、CHECK (固定 6 カテゴリ) | そのまま。元の記事のカテゴリで、再掲載では書き換えない |
| title | text | NOT NULL、CHECK (空文字禁止) | そのまま。再掲載では書き換えない |
| url | text | NOT NULL、CHECK (`^https?://`) | そのまま |
| description | text | NULL 可 | そのまま |
| created_by | bigint | NOT NULL、FK users | そのまま |
| created_at | timestamptz | NOT NULL DEFAULT now() | そのまま |
| digest_id | | | **削除** (digest_articles へ) |
| position | | | **削除** (digest_articles へ) |
| is_hot | | | **削除** (digest_articles へ) |

- `UNIQUE (created_by, url)` はそのまま (FR-001)
- `UNIQUE (digest_id, position)` は列と一緒に消える

### digest_articles (新規)

掲載。記事が 1 つの Digest にどう載ったか。

| 列 | 型 | 制約 |
|---|---|---|
| digest_id | uuid | NOT NULL、FK digests ON DELETE CASCADE |
| article_id | uuid | NOT NULL、FK articles (削除は制限。孤立した記事は保存処理で消す) |
| parent_id | uuid | NULL 可。NULL ならその日の親 |
| position | integer | NOT NULL。Digest 内の通し番号 |
| is_hot | boolean | NOT NULL DEFAULT false。子は自分の値を持つ。親が HOT なら子も true で保存する (FR-016) |
| is_repost | boolean | NOT NULL DEFAULT false。元の記事を参照する掲載 (FR-004) |

- `PRIMARY KEY (digest_id, article_id)`: 同じ Digest に同じ記事は 1 回 (Edge Cases)
- `UNIQUE (digest_id, position)`
- `FOREIGN KEY (digest_id, parent_id) REFERENCES digest_articles (digest_id, article_id) ON DELETE CASCADE`: 親は同じ Digest に載っている記事 (FR-003)
- `CHECK (parent_id <> article_id)`
- `CHECK (NOT is_repost OR (parent_id IS NULL AND NOT is_hot))`: 再掲載は親としてだけ載り、HOT を持たない (FR-004・FR-016)
- `UNIQUE (article_id) WHERE NOT is_repost`: 再掲載でない掲載は記事ごとに 1 つ。登録済みの URL を普通の親として通す抜けを DB でも止める (FR-006)

### article_links (削除)

`digest_articles.parent_id` に吸収する。子の順は `position` の順 (research R3)。

## 導出する値 (保存しない)

| 値 | 導き方 | 使う所 |
|---|---|---|
| 「〜に初掲載」の日付 (`first_published_on`) | 再掲載の掲載についてだけ、記事の掲載のうち `status = 'published'` で表示中の Digest より前の `entry_date` の最小値 | 編集画面 (FR-010)、再掲載できるかの判定 (FR-005) |
| 再掲載の投稿のカテゴリ | 子があれば先頭の子の記事のカテゴリ、なければ記事のカテゴリ | 表示 (FR-014) |

## 保存時の業務ルール (handler)

判定の対象は「登録済みで、この Digest に同じ形 (再掲載か否か) で載っていない記事」だけ (FR-009)。元の掲載を再掲載に変える・再掲載を普通の親や子に変えるのは新しく加わる掲載として確かめる。

| 入力 | 結果 | Problem |
|---|---|---|
| 登録済みの URL を子として入れた | 断る | `/problems/url-already-registered` (`duplicateUrls`) |
| 登録済みの URL を普通の親として入れ、前の日付の公開済み Digest に掲載がない | 断る | `/problems/url-already-registered` (`duplicateUrls`) |
| 登録済みの URL を普通の親として入れ、前の日付の公開済み Digest に掲載がある | 断る | `/problems/url-already-registered` (`duplicateUrls` と `repostable`) |
| 再掲載として入れたが、記事がない、または前の日付の公開済み Digest に掲載がない | 断る | `/problems/repost-unavailable` (`duplicateUrls`) |
| 再掲載として入れ、子がなく、カテゴリが記事と違う | 断る | `/problems/validation-failed` (画面で選べないので、文言は出し分けない) |
| 再掲載として入れ、上のどれにも当たらない | 保存。記事の行は書き換えず、掲載だけ作る | なし |

- 断る理由が両方あるときは `url-already-registered` を先に返す (行の切り替えが先に要るため)
- 子の HOT は「親の HOT か、子自身の HOT か」で保存する。再掲載の親は HOT を送れない (`RepostArticle` が `hot` を持たない)
- 再掲載の子の記事は、再掲載に送ったカテゴリで作る

## 状態の変化

- 元の Digest が下書き (`private` を含む、公開以外) に戻る・削除される: 再掲載の掲載はそのまま。`first_published_on` は次に古い公開の掲載の日付になり、なければ NULL
- 編集で掲載を外した結果、どの掲載もない記事: `articles` から消す (FR-013)。同じ URL は次から新規として登録できる

## 移行 (000013)

1. `digest_articles` を作る
2. `INSERT INTO digest_articles SELECT a.digest_id, a.id, l.parent_id, a.position, a.is_hot FROM articles a LEFT JOIN article_links l ON l.child_id = a.id` (`is_repost` は既定の false)
3. `DROP TABLE article_links`、`articles` から `digest_id` / `position` / `is_hot` を消す

down は再掲載でない掲載を `articles` に戻し、`article_links` を作り直す。再掲載は捨てる (research R9)。
