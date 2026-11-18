---
status: 'accepted'
date: 2026-11-18
decision-makers: 'Hol1kgmg'
---

# 記事 (articles) と掲載 (digest_articles) を分け、再掲載を同じ記事の 2 回目の掲載として表す

## Context and Problem Statement

`articles` は 1 行が「記事そのもの」と「ある Digest への載り方 (並び・HOT)」を兼ねていて、`digest_id` を列に持つ。親子は `article_links` に持つ。同じ利用者は同じ URL を全期間で 1 回だけ載せられる (`UNIQUE (created_by, url)`、000007)。

specs/018 で、前に公開した記事の続報 (例: ツールの新しいバージョン) を、その記事の子として当日の Digest に載せたくなった。そのためには同じ記事が 2 つ目の Digest に載る必要がある。issue #81 は URL の重複を許す案だったが、「新しい記事に出会う」体験が損なわれるので採らない。

記事が 1 つの Digest にしか属せない今の形のままでは、再掲載を表すには行を複製するしかない。

## Decision

**`articles` を記事そのもの (url, title, description, category, created_by, created_at) に絞り、Digest への載り方を `digest_articles (digest_id, article_id, parent_id, position, is_hot)` に分ける。再掲載は、同じ `article_id` の 2 つ目の掲載として表す。**

- `UNIQUE (created_by, url)` は `articles` に残す。記事は増えない
- 並び・HOT・親子は掲載ごとに持つ。同じ記事でも日によって子が違ってよい
- 親は同じ Digest の掲載に限る (`FOREIGN KEY (digest_id, parent_id) REFERENCES digest_articles (digest_id, article_id)`)。日をまたぐ関連は、同じ `article_id` の掲載どうしで表す
- `article_links` は `digest_articles.parent_id` に吸収して消す (000005 のコメントにあった「digest をまたぐ関連」は、この形で表す)
- カテゴリは記事に置く。再掲載の投稿は子があれば子のカテゴリで、なければ記事のカテゴリで出す (掲載にカテゴリを持たず、子から導く)
- 再掲載かどうかは掲載に保存せず、掲載の日付から導く。記事の掲載のうち Digest の日付がいちばん古いもの (下書き・非公開を含む) を元の掲載とし、それ以外を再掲載の掲載とする。元の掲載を外す・日付を変えても、残った掲載から導き直すので、元の掲載は記事ごとに必ず 1 つある
- 再掲載の掲載は元の記事を参照するだけにする。API では `RepostArticle { repostOf, category, children }` として URL で指し、タイトル・カテゴリを送らせない。保存しても記事の行は書き換えない。元の日の表示を後の日の保存で変えないため。再掲載の掲載は親だけで HOT を持たないことを、handler が保存のたびに確かめる
- 「再掲載」の印と「〜に初掲載」の日付は、表示中の Digest より前の日付の公開の Digest への掲載から導く。下書き・非公開の掲載は数えない。一般の閲覧者は下書き・非公開の Digest を見られず、見えない掲載を根拠に印を出すと前の記事が見当たらないため。公開を管理するのは Digest だけにする
- どの掲載もなくなった記事は保存処理で消す

**採らないもの**

- 再掲載の行を `articles` に複製し、`reposted_from` で元を指す: 一意性を部分 index に弱める必要があり、タイトルが日ごとにずれる
- 登録済みの URL を普通の親として送ったら、URL から再掲載と見なす (初版): 同じ upsert で送った title・category に記事が書き換わり、過去の日の表示が再掲載のたびに変わる。断って `repostable` を返し、画面で再掲載に切り替えてから送り直させる (specs/018 research R10・R11)
- 再掲載を掲載の `is_repost` に保存し、`UNIQUE (article_id) WHERE NOT is_repost` と `CHECK (NOT is_repost OR (parent_id IS NULL AND NOT is_hot))` で縛る (Revision 1): DB で形を守れるが、元の掲載を外す・元の Digest の日付を後ろへずらす・元の掲載を再掲載に変えると、元の掲載のない記事や元より前の日付の再掲載が残り、URL を元の掲載として戻せなくなる。防ぐには状態を変える操作ごとに再掲載を確かめる必要があり、仕様の「後から状態が変わっても再掲載を取り消さない」と合わない
- 印の根拠を元の掲載 (下書き・非公開を含む) にする: 元の Digest を非公開にすると、一般の閲覧者には前の記事が見当たらない「再掲載」が出る
- `article_links` の親を過去の Digest の記事にする: migration は要らないが、再掲載がその日の並びと HOT を持てず、子が記事に固定される
- 孫の禁止を DB で縛る (トリガー、生成列 + 複合 FK): 書き込み口は 1 か所で、API の形 (`ChildArticle` が children を持たない) が塞いでいる

## Consequences

- Good, because 記事の一意性を保ったまま、同じ記事を何度でも載せられる
- Good, because 記事単位の検索 (日付をまたいだ関連記事) が `article_id` で引ける。将来の機能の土台になる
- Good, because 掲載に id がなく外から参照されないので、保存のたびに Digest の掲載を入れ直せる。並べ替えの途中で position がぶつかる問題 (000012 の DEFERRABLE) が要らなくなる
- Good, because 元の掲載は保存した状態ではなく掲載の並びで決まるので、掲載を外す・日付を変える・非公開にするどの操作のあとも、元の掲載のない記事や元より前の再掲載が残らない
- Good, because 公開ページの「再掲載」の印は、閲覧者が見られる掲載だけを根拠にする。元の Digest を公開に戻せば印も戻る
- Bad, because 記事を読むクエリがすべて `digest_articles` との join になる。元の掲載と初掲載の日付を導くため、同じ記事のほかの掲載を引く副問い合わせも加わる (`digest_articles (article_id)` の index で引く)
- Bad, because 再掲載の掲載の形 (親だけ・HOT なし・登録済みの URL を普通の親にしない) は別の行の日付と比べないと決まらず、DB の制約で守れない。handler の判定と unit テストだけで守る
- Bad, because 日付の変更で元の掲載から再掲載に変わった行は、保存済みの HOT を持ったままになる。再掲載の掲載の HOT を読むときに false にして吸収する
- Bad, because 記事のタイトル・カテゴリの編集は、その記事が載っているすべての日に反映される (日ごとに変えられない)
- Bad, because down migration は再掲載を捨てる。各記事のいちばん古い掲載だけが戻る

## More Information

- specs/018-article-repost (spec・research・data-model)
- issue #81 (この決定で置き換える)
- 000007 (`UNIQUE (created_by, url)`)、000008 (Digest は利用者ごとに日付で一意。いちばん古い掲載が 1 つに決まる前提)、000012 (記事の id を保つ、issue #114)
- specs/006-digest-status (公開・非公開は下書きに戻せない)
