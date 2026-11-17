---
status: 'accepted'
date: 2026-11-17
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
- カテゴリは記事に置く。再掲載でも元のカテゴリで出す
- 再掲載か、「〜に掲載」の日付はどれかは保存せず、掲載と Digest の公開状態から導く。公開を管理するのは Digest だけにする
- どの掲載もなくなった記事は保存処理で消す

**採らないもの**

- 再掲載の行を `articles` に複製し、`reposted_from` で元を指す: 一意性を部分 index に弱める必要があり、タイトルが日ごとにずれる
- `article_links` の親を過去の Digest の記事にする: migration は要らないが、再掲載がその日の並びと HOT を持てず、子が記事に固定される
- 孫の禁止を DB で縛る (トリガー、生成列 + 複合 FK): 書き込み口は 1 か所で、API の形 (`ChildArticle` が children を持たない) が塞いでいる

## Consequences

- Good, because 記事の一意性を保ったまま、同じ記事を何度でも載せられる
- Good, because 記事単位の検索 (日付をまたいだ関連記事) が `article_id` で引ける。将来の機能の土台になる
- Good, because 掲載に id がなく外から参照されないので、保存のたびに Digest の掲載を入れ直せる。並べ替えの途中で position がぶつかる問題 (000012 の DEFERRABLE) が要らなくなる
- Bad, because 記事を読むクエリがすべて `digest_articles` との join になる
- Bad, because 記事のタイトル・カテゴリの編集は、その記事が載っているすべての日に反映される (日ごとに変えられない)
- Bad, because down migration は再掲載を捨てる。各記事のいちばん古い掲載だけが戻る

## More Information

- specs/018-article-repost (spec・research・data-model)
- issue #81 (この決定で置き換える)
- 000007 (`UNIQUE (created_by, url)`)、000012 (記事の id を保つ、issue #114)
