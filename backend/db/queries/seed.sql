-- name: SeedDeleteDigestArticles :many
-- cmd/seed だけが使う。同じ日付を入れ直せるように、seed のユーザーの掲載を消す
DELETE FROM digest_articles
WHERE digest_id IN (SELECT id FROM digests WHERE entry_date = $1 AND created_by = $2)
RETURNING article_id;

-- name: SeedDeleteDigest :exec
-- cmd/seed だけが使う
DELETE FROM digests WHERE entry_date = $1 AND created_by = $2;
