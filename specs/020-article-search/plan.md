# 実装計画

- `GET /articles/search?q=` (`searchArticles`、bearerAuth) を足す。`q` は 1〜100 文字。
- sqlc の `SearchArticles` は公開の掲載だけを JOIN して記事ごとにまとめ、掲載日を古い順の配列で返す。先頭が初掲載日、残りが再掲載。
- 一致は `ListArticleDomains` と同じ `strpos(lower(..))`。`ILIKE` のワイルドカードをエスケープしなくてよく、記事は数千件に届かないので `pg_trgm` は使わない。
- frontend は `schemas.ts` のスキーマ + `AdminToken` で呼ぶサーバー関数 + `/admin/articles/search` (`?q=` で検索)。ルートは `_shell/_admin/` の下に置き、ガードはパスを持たない親ルート `_shell/_admin.tsx` に任せて自分では持たない (#220 で `resolveDigestEditorPage` から置き換えた)。
- テストは router テスト 1 件 (401 と 400) と e2e 1 本 (登録 → 検索)。

Constitution Check: 既存の OpenAPI、sqlc、Zod、CSS トークンを使い、新規依存や DB 接続テストを足さない。
