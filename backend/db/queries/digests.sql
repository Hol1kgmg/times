-- name: GetLatestDigest :one
-- 同じ日付が複数あれば後に登録したものを採用する (specs/002 Edge Cases)
SELECT * FROM digests ORDER BY entry_date DESC, created_at DESC LIMIT 1;

-- name: ListArticlesByDigest :many
-- position = 登録時のカテゴリ順・カテゴリ内順 (specs/002 FR-004)
SELECT * FROM articles WHERE digest_id = $1 ORDER BY position;
