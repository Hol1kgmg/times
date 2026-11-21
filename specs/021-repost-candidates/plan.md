# 実装計画

- `GET /articles/repost-candidates?q=` (`listRepostCandidates`、bearerAuth) を足す。`q` は `searchArticles` と同じ定義を `components/parameters/ArticleSearchQuery` に切り出して両方から参照する。
- レスポンスは `RepostCandidateList { articles: RepostCandidate[] }`。`RepostCandidate` は `id, title, url, category, firstPublishedOn, parent?: ArticleSearchParent { title, url }`。親を同じ応答に入れるのは、#171 で行ごとに親を取りに行く往復を増やさないため。
- sqlc の `ListRepostCandidates` は `SearchArticles` と同じ WHERE・JOIN で、掲載日は `min(d.entry_date)` だけを取る。配列と HOT は集めない。
- handler は `encodedQuery` を共有する。
- frontend は `schemas.ts` のスキーマだけ。`AdminToken` で呼ぶサーバー関数 (`articleSearchQuery` を共有) と UI は #171。
- テストは router テストに 401 と 400 を 1 件ずつ。この API を呼ぶ画面がまだないので e2e は #171 で 1 本足す。回帰は既存の `article-search` の e2e で確かめる。

Constitution Check: 既存の OpenAPI、sqlc、Zod を使い、新規依存や DB 接続テストを足さない。
