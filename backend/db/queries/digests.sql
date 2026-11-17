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

-- name: ListRegisteredURLs :many
-- unique 違反は最初の 1 件しか分からないので、画面で全件に印を付けるため先にまとめて引く。この Digest に載っている記事は確かめ直さない (specs/018 FR-009)
SELECT a.url, EXISTS (
    SELECT 1 FROM digest_articles da JOIN digests d ON d.id = da.digest_id
    WHERE da.article_id = a.id AND d.status = 'published'
) AS published_elsewhere
FROM articles a
WHERE a.created_by = $1 AND a.url = ANY(sqlc.arg(urls)::text[])
  AND NOT EXISTS (SELECT 1 FROM digest_articles da WHERE da.article_id = a.id AND da.digest_id = sqlc.arg(digest_id));

-- name: CreateDigest :one
-- 保存前の最新日付より前の日付は、公開しても通知しない (issue #112)
INSERT INTO digests (entry_date, created_by, status, published_at) VALUES ($1, $2, $3,
  CASE WHEN $3 = 'published' AND NOT EXISTS (SELECT 1 FROM digests d WHERE d.entry_date > $1) THEN now() END) RETURNING *;

-- name: LockDigestDates :exec
-- READ COMMITTED では並行する保存のまだコミットしていない日付が見えず、最新日付の比較がずれるため直列にする
SELECT pg_advisory_xact_lock(hashtext('digests.entry_date'));

-- name: UpsertArticle :one
-- 記事の行は残して更新し、id とサーバーだけが持つ列を保つ (issue #114)
INSERT INTO articles (category, title, url, created_by) VALUES ($1, $2, $3, $4)
ON CONFLICT (created_by, url) DO UPDATE SET category = EXCLUDED.category, title = EXCLUDED.title
RETURNING *;

-- name: DeleteDigestArticles :exec
-- 掲載は id を持たず外から参照されないので、保存のたびに入れ直してよい
DELETE FROM digest_articles WHERE digest_id = $1;

-- name: CreateDigestArticle :exec
INSERT INTO digest_articles (digest_id, article_id, parent_id, position, is_hot) VALUES ($1, $2, $3, $4, $5);

-- name: DeleteOrphanArticles :exec
-- どの Digest にも載らなくなった記事は消す (specs/018 FR-013)
DELETE FROM articles WHERE created_by = $1
  AND NOT EXISTS (SELECT 1 FROM digest_articles da WHERE da.article_id = articles.id);

-- name: ListArticlesByDigest :many
-- position = 登録時のカテゴリ順・カテゴリ内順 (specs/002 FR-004)。子は親の直後に入るので、親の中の順も position の順
-- 後の日付の掲載を数えると、前の日の Digest に後から再掲載の印が付くため (specs/018 FR-010)
-- sqlc はサブクエリの列を NULL なしと推論するので、テーブルの LEFT JOIN で NULL を許す型にする
SELECT a.id, a.category, a.title, a.url, a.description, da.parent_id, da.is_hot, f.entry_date AS first_published_on
FROM digest_articles da JOIN articles a ON a.id = da.article_id JOIN digests cur ON cur.id = da.digest_id
LEFT JOIN digests f ON f.id = (
  SELECT d.id FROM digest_articles o JOIN digests d ON d.id = o.digest_id
  WHERE o.article_id = a.id AND d.status = 'published' AND d.entry_date < cur.entry_date
  ORDER BY d.entry_date LIMIT 1
)
WHERE da.digest_id = $1 ORDER BY da.position;

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
