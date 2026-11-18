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

- `PRIMARY KEY (digest_id, article_id)`: 同じ Digest に同じ記事は 1 回 (Edge Cases)
- `UNIQUE (digest_id, position)`
- `FOREIGN KEY (digest_id, parent_id) REFERENCES digest_articles (digest_id, article_id) ON DELETE CASCADE`: 親は同じ Digest に載っている記事 (FR-003)
- `CHECK (parent_id <> article_id)`
- `INDEX (article_id)`: 孤立した記事の削除と、元の掲載・初掲載の日付を導くとき、記事から掲載を引く
- 再掲載かどうかは列に持たない (FR-019)。元の掲載かどうかは別の行の日付と比べないと決まらず、CHECK や部分 UNIQUE では表せないため、再掲載の形の制限 (親だけ・HOT なし) は handler で守る

### article_links (削除)

`digest_articles.parent_id` に吸収する。子の順は `position` の順 (research R3)。

## 導出する値 (保存しない)

| 値 | 導き方 | 使う所 |
|---|---|---|
| 元の掲載か (`is_original`) | 記事の掲載のうち、Digest の `entry_date` がいちばん古いものなら true。Digest の状態 (`draft` / `published` / `private`) は問わない | 編集画面の行のロック (FR-008)、保存時の形の制限、編集画面の「再掲載」の印 (FR-010) |
| 「〜に初掲載」の日付 (`first_published_on`) | 記事の掲載のうち、`status = 'published'` で表示中の Digest より前の `entry_date` の最小値。`draft` と `private` は数えない。元の掲載では前の掲載がないので常に NULL | 編集画面の日付 (FR-010)、再掲載できるかの判定 (FR-005)、公開ページの「再掲載」の印と細い行 (FR-010・FR-014: 親で、この値があるとき) |
| 再掲載の投稿のカテゴリ | 子があれば先頭の子の記事のカテゴリ、なければ記事のカテゴリ | 表示 (FR-014) |

- 記事と Digest はどちらも利用者ごとで、Digest は利用者ごとに日付で一意 (`UNIQUE (created_by, entry_date)`、000008)。記事の掲載どうしで日付は重ならず、いちばん古い掲載は 1 つに決まる
- 2 つの値は別のことを決める。`is_original` は管理者の編集の範囲で、見えない掲載も含めて決める。`first_published_on` は閲覧者に見える根拠で、公開の掲載だけで決める

| 元の掲載の Digest | `is_original` (再掲載の行) | `first_published_on` | 公開ページ | 編集画面の行 |
|---|---|---|---|---|
| 公開 | false | 元の日付 | 印と細い行 (子があれば) | 印と「〜に初掲載」 |
| 非公開 | false | NULL (ほかに前の公開の掲載がなければ) | 普通の行 | 印だけ |
| 下書き (日付の変更で前に来た) | false | NULL (同上) | 普通の行 | 印だけ |

## 保存時の業務ルール (handler)

FR-005・FR-006 の判定の対象は「登録済みで、この Digest に載っていない記事」だけ (FR-009)。この Digest に載っている記事は、再掲載の掲載が普通の親・子として送られていないかを保存のたびに確かめる。`is_original` は保存後の日付で導く (`UpdateDigest` が記事より先に日付を書き換えるため)。

| この Digest に載っている記事の送り方 | 結果 | Problem |
|---|---|---|
| 元の掲載 (`is_original`) を普通の親・子として送る | 保存。タイトル・カテゴリを記事に書き込む | なし |
| 元の掲載を再掲載として送る | 保存。記事を書き換えないだけで、いちばん古い掲載なので元の掲載のまま | なし |
| 再掲載の掲載を再掲載として送る | 保存。FR-005 は確かめ直さない | なし |
| 再掲載の掲載を普通の親・子として送る (日付を変えて前に別の掲載が来た場合を含む) | 断る | `/problems/url-already-registered` (`duplicateUrls` と、FR-005 を満たせば `repostable`) |

この Digest に載っていない記事:

| 入力 | 結果 | Problem |
|---|---|---|
| 登録済みの URL を子として入れた | 断る | `/problems/url-already-registered` (`duplicateUrls`) |
| 登録済みの URL を普通の親として入れ、前の日付の公開済み Digest に掲載がない | 断る | `/problems/url-already-registered` (`duplicateUrls`) |
| 登録済みの URL を普通の親として入れ、前の日付の公開済み Digest に掲載がある | 断る | `/problems/url-already-registered` (`duplicateUrls` と `repostable`) |
| 再掲載として入れたが、記事がない、または前の日付の公開済み Digest に掲載がない | 断る | `/problems/repost-unavailable` (`duplicateUrls`) |
| 再掲載として入れ、子がなく、カテゴリが記事と違う | 断る | `/problems/validation-failed` (画面で選べないので、文言は出し分けない) |
| 再掲載として入れ、上のどれにも当たらない | 保存。記事の行は書き換えず、掲載だけ作る | なし |

- 断る理由が両方あるときは `url-already-registered` を先に返す (行の切り替えが先に要るため)
- 子の HOT は「親の HOT か、子自身の HOT か」で保存する。再掲載の親は HOT を送れず (`RepostArticle` が `hot` を持たない)、`is_hot = false` で保存する
- 再掲載の子の記事は、再掲載に送ったカテゴリで作る
- 保存する Digest の日付を変えると、その Digest に載っている記事の `is_original` が変わりうる。前に別の掲載が来た記事を普通の親で送っていれば断り、FR-005 を満たせば行を再掲載に切り替える (FR-007 と同じ流れ)

## 状態の変化

保存した列は変えず、読むたびに `is_original` と `first_published_on` を導き直す。

- 元の Digest を非公開にする (公開 → 非公開): 再掲載の掲載はそのまま。`first_published_on` は次に古い公開の掲載の日付になり、なければ NULL。公開ページでは印と細い行が消え、公開に戻すと出る
- 下書きには戻せない (specs/006)。下書きの Digest が元の掲載になるのは、日付を変えて既存の掲載より前にしたときだけ
- 元の掲載を外す・元の Digest を削除する: 残った掲載のうちいちばん古いものが `is_original` になり、その行でタイトル・カテゴリを編集できる。その行に保存済みの HOT は残っていない (再掲載だった間は `false` で保存しているため)
- Digest の日付を変えて掲載の前後が入れ替わる: `is_original` も入れ替わる。前の元の掲載の `is_hot` は残るので、再掲載の掲載では読むときに HOT を false にする (Edge Cases)
- 編集で掲載を外した結果、どの掲載もない記事: `articles` から消す (FR-013)。同じ URL は次から新規として登録できる

## 移行 (000013)

1. `digest_articles` を作る
2. `INSERT INTO digest_articles SELECT a.digest_id, a.id, l.parent_id, a.position, a.is_hot FROM articles a LEFT JOIN article_links l ON l.child_id = a.id`
3. `DROP TABLE article_links`、`articles` から `digest_id` / `position` / `is_hot` を消す

000013 は main に入っていないので、番号を足さずに書き換える (`is_repost`・その CHECK・`digest_articles_original_key` を消す)。手元の DB は作り直す。

down は各記事のいちばん古い掲載 (元の掲載) を `articles` に戻し、`article_links` を作り直す。再掲載は捨てる (research R9)。
