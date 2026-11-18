# Data Model: 記事の再掲載と関連記事

## テーブル

### articles (変更)

記事そのもの。利用者ごとに URL で一意。親子もここに持つ (Revision 3)。

| 列 | 型 | 制約 | 変更 |
|---|---|---|---|
| id | uuid | PK | そのまま |
| category | text | NOT NULL、CHECK (固定 6 カテゴリ) | そのまま。元の掲載の保存でだけ書き換える |
| title | text | NOT NULL、CHECK (空文字禁止) | そのまま。再掲載では書き換えない |
| url | text | NOT NULL、CHECK (`^https?://`) | そのまま |
| description | text | NULL 可 | そのまま |
| created_by | bigint | NOT NULL、FK users | そのまま |
| created_at | timestamptz | NOT NULL DEFAULT now() | そのまま |
| parent_id | uuid | NULL 可。CHECK (`parent_id <> id`) | **追加**。子の親。子の元の掲載の保存でだけ書き換える |
| is_child | boolean | `GENERATED ALWAYS AS (parent_id IS NOT NULL) STORED` | **追加**。孫を止める複合 FK の参照先 |
| parent_is_child | boolean | NOT NULL DEFAULT false、CHECK (`NOT parent_is_child`) | **追加**。複合 FK の参照元。常に false |
| hidden | boolean | NOT NULL DEFAULT false | **追加**。外す代わりに隠した親 (FR-020) |
| digest_id / position / is_hot | | | **削除** (digest_articles へ) |

- `UNIQUE (created_by, url)` はそのまま (FR-001)
- `UNIQUE (id, is_child)` と `FOREIGN KEY (parent_id, parent_is_child) REFERENCES articles (id, is_child)`: 親に指せるのは子でない記事だけ。子を持つ記事に親を付けると、子からの FK が止める。どちらも 23503 (`articles_parent_id_parent_is_child_fkey`) で、handler が 400 に写す。子のいる親の削除もこの FK が止めるが、保存処理が先に避けるので 400 にはしない
- 深さが 1 段までで自分も指せないので、循環は起きない

### digest_articles (新規)

掲載。記事が 1 つの Digest にどう載ったか。

| 列 | 型 | 制約 |
|---|---|---|
| digest_id | uuid | NOT NULL、FK digests ON DELETE CASCADE |
| article_id | uuid | NOT NULL、FK articles (削除は制限。孤立した記事は保存処理で消す) |
| position | integer | NOT NULL。Digest の中の兄弟どうしの相対的な順番 |
| is_hot | boolean | NOT NULL DEFAULT false。子は自分の値を持つ。親が HOT なら子も true で保存する (FR-016) |

- `PRIMARY KEY (digest_id, article_id)`: 同じ Digest に同じ記事は 1 回 (Edge Cases)
- `UNIQUE (digest_id, position)`
- `INDEX (article_id)`: 孤立した記事の削除と、元の掲載・初掲載の日付を導くとき、記事から掲載を引く
- 子付きの再掲載の親は掲載を持たない。子の `parent_id` から呼び出して出す (FR-012)。子のない再掲載はそれ自体を読ませるので掲載を持つ
- 再掲載かどうかは列に持たない (FR-019)

### article_links (削除)

`articles.parent_id` に吸収する。子の並びは掲載ごとの `position` で決まり、再掲載の日は元の日と別の並びを持つ。

## 導出する値 (保存しない)

| 値 | 導き方 | 使う所 |
|---|---|---|
| 元の掲載か (`is_original`) | 記事の掲載のうち、Digest の `entry_date` がいちばん古いものなら true。Digest の状態 (`draft` / `published` / `private`) は問わない | 編集画面の行のロック (FR-008)、保存時の形の制限、編集画面の「再掲載」の印 (FR-010) |
| 「〜に初掲載」の日付 (`first_published_on`) | 記事の掲載のうち、`status = 'published'` で表示中の Digest より前の `entry_date` の最小値。`draft` と `private` は数えない。元の掲載では前の掲載がないので常に NULL | 編集画面の日付 (FR-010)、再掲載できるかの判定 (FR-005)、公開ページの「再掲載」の印と細い行 (FR-010・FR-014: 親で、この値があるとき) |
| 再掲載の投稿のカテゴリ | 子があれば先頭の子の記事のカテゴリ、なければ記事のカテゴリ。呼び出した親も同じ | 表示 (FR-014) |
| 表示するか | `NOT hidden` かつ元の掲載の Digest が公開済み | 公開ページの「非公開記事」(FR-021) |

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

## 保存の手順 (Revision 3)

1. 送られた記事を確かめる (上の表)
2. この保存で元の掲載として送られた記事の `parent_id` を NULL にする。1 行ずつ upsert すると、親と子を入れ替える保存で子のままの記事を親に指して 23503 になるため
3. 元の掲載の記事を upsert する。カテゴリは今いる枠のもの、子の `parent_id` は今いる親、親の `hidden` は送られた値
4. 再掲載の記事は参照するだけ
5. 掲載を入れる。子付きの再掲載の親は入れない。隠した行も `position` を振って入れる
6. 外した記事のうち、どこにも載らないのに、どこかに載っている子がいる親があれば断る (`/problems/parent-has-children`、`hideable` 付き)
7. 外した記事のうち、どこにも載らず、載っている子もいないものを消す
8. 下書き・非公開から公開にしたときは、この Digest が元の掲載の記事の `hidden` を false に戻す

| 入力 | 結果 | Problem |
|---|---|---|
| 再掲載の子を、記事の親と違う親の下で送った (親のない記事を含む) | 断る | `/problems/validation-failed` |
| 再掲載の子が、記事がない、または前の日付の公開済み Digest に掲載がない | 断る | `/problems/repost-unavailable` |
| 親を持つ記事を、子のない再掲載として単独で送った | 保存。読むときに記事の親を呼び出す | なし |
| 外すとどこにも載らなくなる親に、ほかの日に載っている子がいる | 断る。画面はその行を隠した行として戻す | `/problems/parent-has-children` |

## 移行 (000013)

1. `digest_articles` を `parent_id` なしで作り、今の掲載を写す
2. `articles` に `parent_id` 一式と `hidden` を足し、`article_links.parent_id` を写す。今の子は親が 1 つで、親子は同じ Digest にいるので、そのまま写せる
3. `DROP TABLE article_links`、`articles` から `digest_id` / `position` / `is_hot` を消す

000013 は main に入っていないので、番号を足さずに書き換える。

down は各記事のいちばん古い掲載 (元の掲載) を `articles` に戻し、`article_links` を `articles.parent_id` から作り直す。元の掲載が親と別の日の子は親子を捨て、再掲載は捨てる (research R9)。
