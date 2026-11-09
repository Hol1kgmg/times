-- name: GetLatestDigest :one
-- 同じ日付が複数あれば後に登録したものを採用する (specs/002 Edge Cases)
SELECT * FROM digests WHERE status = 'published' ORDER BY entry_date DESC, created_at DESC LIMIT 1;

-- name: ListPublishedDigests :many
-- ponytail: 管理者はユーザー名で判定する。同じ login の行が 2 つあれば混ざる (spec Assumptions)
SELECT * FROM digests
WHERE status = 'published'
  AND created_by IN (SELECT id FROM users WHERE lower(login) = lower(sqlc.arg(admin_login)))
  AND (sqlc.narg(before)::date IS NULL OR entry_date < sqlc.narg(before))
ORDER BY entry_date DESC LIMIT sqlc.arg(lim);

-- name: ListDigests :many
SELECT id, entry_date, status FROM digests ORDER BY entry_date DESC, created_at DESC;

-- name: GetDigestByDate :one
-- ponytail: 管理者 1 人の前提で created_by を見ない。複数になったら条件を足す
SELECT * FROM digests WHERE entry_date = $1 ORDER BY created_at DESC LIMIT 1;

-- name: UpdateDigest :one
-- status を省略した更新は今のステータスを保つ。右辺の status は更新前の値で、下書きからの公開だけ公開時刻を記録する (specs/010 FR-001/002)
UPDATE digests SET
  entry_date = sqlc.arg(new_date),
  status = COALESCE(sqlc.narg(status), status),
  -- 副問い合わせは更新前の行を見るので、保存前の最新日付と比べられる (issue #112)
  published_at = CASE WHEN status = 'draft' AND COALESCE(sqlc.narg(status), status) = 'published'
    AND NOT EXISTS (SELECT 1 FROM digests d WHERE d.entry_date > sqlc.arg(new_date)) THEN now() ELSE published_at END
WHERE digests.created_by = sqlc.arg(created_by) AND digests.entry_date = sqlc.arg(old_date) RETURNING *;

-- name: DeleteArticlesNotIn :exec
-- 残る記事は消さずに upsert で更新し、id とサーバーだけが持つ列を保つ (issue #114)
DELETE FROM articles WHERE digest_id = $1 AND url <> ALL(sqlc.arg(urls)::text[]);

-- name: DeleteArticleLinksByDigest :exec
DELETE FROM article_links l USING articles a WHERE a.id = l.child_id AND a.digest_id = $1;

-- name: ListRegisteredURLs :many
-- unique 違反は最初の 1 件しか分からないので、画面で全件に印を付けるため先にまとめて引く
SELECT url FROM articles WHERE created_by = $1 AND digest_id <> sqlc.arg(digest_id) AND url = ANY(sqlc.arg(urls)::text[]);

-- name: CreateDigest :one
-- 保存前の最新日付より前の日付は、公開しても通知しない (issue #112)
INSERT INTO digests (entry_date, created_by, status, published_at) VALUES ($1, $2, $3,
  CASE WHEN $3 = 'published' AND NOT EXISTS (SELECT 1 FROM digests d WHERE d.entry_date > $1) THEN now() END) RETURNING *;

-- name: LockDigestDates :exec
-- READ COMMITTED では並行する保存のまだコミットしていない日付が見えず、最新日付の比較がずれるため直列にする
SELECT pg_advisory_xact_lock(hashtext('digests.entry_date'));

-- name: UpsertArticle :one
-- 画面が送る列だけを更新する。他の Digest の URL には当たっても更新せず、行を返さない
INSERT INTO articles (digest_id, position, category, title, url, is_hot, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7)
ON CONFLICT (created_by, url) DO UPDATE SET
  position = EXCLUDED.position, category = EXCLUDED.category, title = EXCLUDED.title, is_hot = EXCLUDED.is_hot
WHERE articles.digest_id = EXCLUDED.digest_id
RETURNING *;

-- name: ListArticlesByDigest :many
-- position = 登録時のカテゴリ順・カテゴリ内順 (specs/002 FR-004)
SELECT * FROM articles WHERE digest_id = $1 ORDER BY position;

-- name: CreateArticleLink :exec
INSERT INTO article_links (parent_id, child_id, position) VALUES ($1, $2, $3);

-- name: ListArticleLinksByDigest :many
SELECT l.* FROM article_links l
JOIN articles a ON a.id = l.child_id
WHERE a.digest_id = $1 ORDER BY l.parent_id, l.position;

-- name: ListFeedDigests :many
-- 公開時刻を持つ = 下書きから公開した Digest だけが通知になる。対象は ListPublishedDigests と同じく管理者の Digest
SELECT id, entry_date, published_at::timestamptz AS published_at FROM digests
WHERE status = 'published' AND published_at IS NOT NULL
  AND created_by IN (SELECT id FROM users WHERE lower(login) = lower(sqlc.arg(admin_login)))
ORDER BY published_at DESC LIMIT 20;

-- name: GetFeedDigestByDate :one
-- フィードに載る Digest の日付にだけ画像を作る (specs/010 FR-010)
SELECT id FROM digests
WHERE status = 'published' AND published_at IS NOT NULL
  AND created_by IN (SELECT id FROM users WHERE lower(login) = lower(sqlc.arg(admin_login)))
  AND entry_date = sqlc.arg(entry_date)
LIMIT 1;
