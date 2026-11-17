# Data Model: 記事の再掲載と関連記事

## テーブル

### articles (変更)

記事そのもの。利用者ごとに URL で一意。

| 列 | 型 | 制約 | 変更 |
|---|---|---|---|
| id | uuid | PK | そのまま |
| category | text | NOT NULL、CHECK (固定 6 カテゴリ) | そのまま |
| title | text | NOT NULL、CHECK (空文字禁止) | そのまま |
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
| is_hot | boolean | NOT NULL DEFAULT false。子は親の値を写す (今と同じ) |

- `PRIMARY KEY (digest_id, article_id)`: 同じ Digest に同じ記事は 1 回 (Edge Cases)
- `UNIQUE (digest_id, position)`
- `FOREIGN KEY (digest_id, parent_id) REFERENCES digest_articles (digest_id, article_id) ON DELETE CASCADE`: 親は同じ Digest に載っている記事 (FR-003)
- `CHECK (parent_id <> article_id)`

### article_links (削除)

`digest_articles.parent_id` に吸収する。子の順は `position` の順 (research R3)。

## 導出する値 (保存しない)

| 値 | 導き方 | 使う所 |
|---|---|---|
| 再掲載か | この Digest 以外の公開済み Digest にも掲載がある | 保存時の判定 (R4) |
| 「〜に掲載」の日付 (`first_published_on`) | 記事の掲載のうち、`status = 'published'` で表示中の Digest より前の `entry_date` の最小値 | 表示 (FR-010) |
| 今回の保存で再掲載になった URL (`repostedUrls`) | 保存前にこの Digest に載っていなかった登録済みの記事のうち、再掲載として通したもの | 保存後の案内 (FR-006) |

## 保存時の業務ルール (handler)

対象は「登録済みで、この Digest にまだ載っていない記事」だけ (FR-009)。

| 入力 | 結果 | Problem |
|---|---|---|
| 子として入れた | 断る | `/problems/url-already-registered` (`duplicateUrls`) |
| 親として入れたが、ほかの公開済み Digest に掲載がない | 断る | `/problems/url-already-registered` (`duplicateUrls`) |
| 親として入れたが、子がない | 断る | `/problems/repost-needs-child` (`duplicateUrls`) |
| 親として入れ、新規の子が 1 件以上、ほかの公開済み Digest に掲載がある | 再掲載として保存 | なし。`repostedUrls` に入る |

- 断る理由が複数の URL にまたがるときは、`url-already-registered` を先に返す (今の画面の表示と同じ流れで、直す数が多い方を先に出す)
- 再掲載の子は新しい記事だけ。登録済みの子は「子として入れた」に当たる

## 状態の変化

- 元の Digest が下書き (`private` を含む、公開以外) に戻る・削除される: 再掲載の掲載はそのまま。`first_published_on` は次に古い公開の掲載の日付になり、なければ NULL
- 編集で掲載を外した結果、どの掲載もない記事: `articles` から消す (FR-013)。同じ URL は次から新規として登録できる

## 移行 (000013)

1. `digest_articles` を作る
2. `INSERT INTO digest_articles SELECT a.digest_id, a.id, l.parent_id, a.position, a.is_hot FROM articles a LEFT JOIN article_links l ON l.child_id = a.id`
3. `DROP TABLE article_links`、`articles` から `digest_id` / `position` / `is_hot` を消す

down は各記事のいちばん古い掲載 (`entry_date` の最小) を `articles` に戻し、`article_links` を作り直す。ほかの掲載 (再掲載) は捨てる (research R9)。
