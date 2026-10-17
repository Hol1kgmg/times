-- name: GetLatestDigest :one
-- 同じ日付が複数あれば後に登録したものを採用する (specs/002 Edge Cases)
SELECT * FROM digests ORDER BY entry_date DESC, created_at DESC LIMIT 1;

-- name: CreateDigest :one
INSERT INTO digests (entry_date) VALUES ($1) RETURNING *;

-- name: CreateArticle :one
INSERT INTO articles (digest_id, position, category, title, url) VALUES ($1, $2, $3, $4, $5) RETURNING *;

-- name: ListArticlesByDigest :many
-- position = 登録時のカテゴリ順・カテゴリ内順 (specs/002 FR-004)
SELECT * FROM articles WHERE digest_id = $1 ORDER BY position;
