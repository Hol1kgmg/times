-- name: GetLatestDigest :one
-- 同じ日付が複数あれば後に登録したものを採用する (specs/002 Edge Cases)
SELECT * FROM digests WHERE status = 'published' ORDER BY entry_date DESC, created_at DESC LIMIT 1;

-- name: ListDigests :many
SELECT id, entry_date, status FROM digests ORDER BY entry_date DESC, created_at DESC;

-- name: GetDigestByDate :one
-- ponytail: 管理者 1 人の前提で created_by を見ない。複数になったら条件を足す
SELECT * FROM digests WHERE entry_date = $1 ORDER BY created_at DESC LIMIT 1;

-- name: UpdateDigest :one
-- status を省略した更新は今のステータスを保つ
UPDATE digests SET entry_date = sqlc.arg(new_date), status = COALESCE(sqlc.narg(status), status) WHERE created_by = sqlc.arg(created_by) AND entry_date = sqlc.arg(old_date) RETURNING *;

-- name: DeleteArticlesByDigest :exec
DELETE FROM articles WHERE digest_id = $1;

-- name: ListRegisteredURLs :many
-- unique 違反は最初の 1 件しか分からないので、画面で全件に印を付けるため先にまとめて引く
SELECT url FROM articles WHERE created_by = $1 AND url = ANY(sqlc.arg(urls)::text[]);

-- name: CreateDigest :one
INSERT INTO digests (entry_date, created_by, status) VALUES ($1, $2, $3) RETURNING *;

-- name: CreateArticle :one
INSERT INTO articles (digest_id, position, category, title, url, is_hot, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *;

-- name: ListArticlesByDigest :many
-- position = 登録時のカテゴリ順・カテゴリ内順 (specs/002 FR-004)
SELECT * FROM articles WHERE digest_id = $1 ORDER BY position;

-- name: CreateArticleLink :exec
INSERT INTO article_links (parent_id, child_id, position) VALUES ($1, $2, $3);

-- name: ListArticleLinksByDigest :many
SELECT l.* FROM article_links l
JOIN articles a ON a.id = l.child_id
WHERE a.digest_id = $1 ORDER BY l.parent_id, l.position;
