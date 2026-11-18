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

-- name: ListRegisteredArticles :many
-- unique 違反は最初の 1 件しか分からないので、画面で全件に印を付けるため先にまとめて引く
SELECT a.id, a.url, a.title, a.category,
  EXISTS (SELECT 1 FROM digest_articles da WHERE da.article_id = a.id AND da.digest_id = cur.id) AS placed,
  -- 下書き・非公開も数える。前に掲載があれば、この Digest の掲載は再掲載になる (specs/018 FR-019)
  EXISTS (SELECT 1 FROM digest_articles o JOIN digests d ON d.id = o.digest_id
    WHERE o.article_id = a.id AND d.entry_date < cur.entry_date) AS has_earlier,
  -- sqlc はサブクエリの列を NULL なしと推論するので、テーブルの LEFT JOIN で NULL を許す型にする
  f.entry_date AS first_published_on,
  p.url AS parent_url
FROM articles a
JOIN digests cur ON cur.id = sqlc.arg(digest_id)
LEFT JOIN articles p ON p.id = a.parent_id
LEFT JOIN digests f ON f.id = (
  SELECT d.id FROM digest_articles o JOIN digests d ON d.id = o.digest_id
  -- 閲覧者に見えない下書き・非公開と、後の日付の掲載は再掲載の根拠にしない (specs/018 FR-005・FR-010)
  WHERE o.article_id = a.id AND d.status = 'published' AND d.entry_date < cur.entry_date
  ORDER BY d.entry_date LIMIT 1
)
WHERE a.created_by = sqlc.arg(created_by) AND a.url = ANY(sqlc.arg(urls)::text[]);

-- name: CreateDigest :one
-- 保存前の最新日付より前の日付は、公開しても通知しない (issue #112)
INSERT INTO digests (entry_date, created_by, status, published_at) VALUES ($1, $2, $3,
  CASE WHEN $3 = 'published' AND NOT EXISTS (SELECT 1 FROM digests d WHERE d.entry_date > $1) THEN now() END) RETURNING *;

-- name: LockDigestDates :exec
-- READ COMMITTED では並行する保存のまだコミットしていない日付が見えず、最新日付の比較がずれるため直列にする
SELECT pg_advisory_xact_lock(hashtext('digests.entry_date'));

-- name: ClearParents :exec
-- 1 行ずつ親を書くと、親と子を入れ替える保存で子のままの記事を親に指して FK で落ちるため、先に外す
UPDATE articles SET parent_id = NULL
WHERE created_by = sqlc.arg(created_by) AND url = ANY(sqlc.arg(urls)::text[]) AND parent_id IS NOT NULL;

-- name: UpsertArticle :one
-- 記事の行は残して更新し、id とサーバーだけが持つ列を保つ (issue #114)
INSERT INTO articles (category, title, url, created_by, parent_id, hidden) VALUES ($1, $2, $3, $4, $5, $6)
ON CONFLICT (created_by, url) DO UPDATE SET category = EXCLUDED.category, title = EXCLUDED.title,
  parent_id = EXCLUDED.parent_id, hidden = EXCLUDED.hidden
RETURNING *;

-- name: DeleteDigestArticles :many
-- 掲載は id を持たず外から参照されないので、保存のたびに入れ直してよい
DELETE FROM digest_articles WHERE digest_id = $1 RETURNING article_id;

-- name: CreateDigestArticle :exec
INSERT INTO digest_articles (digest_id, article_id, position, is_hot) VALUES ($1, $2, $3, $4);

-- name: ListStrandedParents :many
-- どこにも載らなくなるのに、どこかに載っている子がいる親。消せないので、外す代わりに隠させる
SELECT a.url, a.title, a.category FROM articles a
WHERE a.id = ANY(sqlc.arg(ids)::uuid[])
  AND NOT EXISTS (SELECT 1 FROM digest_articles da WHERE da.article_id = a.id)
  AND EXISTS (SELECT 1 FROM articles c JOIN digest_articles da ON da.article_id = c.id WHERE c.parent_id = a.id);

-- name: DeleteOrphanArticles :exec
-- どの Digest にも載らなくなった記事は消す (specs/018 FR-013)。載っていない子は同じ文で消えるので、親を残す理由にしない
DELETE FROM articles WHERE id = ANY(sqlc.arg(ids)::uuid[])
  AND NOT EXISTS (SELECT 1 FROM digest_articles da WHERE da.article_id = articles.id)
  AND NOT EXISTS (SELECT 1 FROM articles c JOIN digest_articles da ON da.article_id = c.id WHERE c.parent_id = articles.id);

-- name: UnhideOriginals :exec
-- 公開は載る記事を全部見せてよいという意味なので、この Digest が元の掲載の記事の隠したものを戻す
UPDATE articles a SET hidden = false
FROM digest_articles da JOIN digests cur ON cur.id = da.digest_id
WHERE da.digest_id = sqlc.arg(digest_id) AND da.article_id = a.id AND a.hidden
  AND NOT EXISTS (SELECT 1 FROM digest_articles o JOIN digests d ON d.id = o.digest_id
    WHERE o.article_id = a.id AND d.entry_date < cur.entry_date);

-- name: ListArticlesByDigest :many
-- 掲載と、子が載っているのにこの Digest に載っていない親 (呼び出した親) を、position の順に返す。
-- 呼び出した親は最初の子の position を持ち、同じ position の子より前に並ぶ
WITH placed AS (
  SELECT da.article_id, da.position, da.is_hot FROM digest_articles da WHERE da.digest_id = sqlc.arg(digest_id)
), rows AS (
  SELECT article_id, position, is_hot, true AS placed FROM placed
  UNION ALL
  SELECT a.parent_id, min(p.position), false, false
  FROM placed p JOIN articles a ON a.id = p.article_id
  WHERE a.parent_id IS NOT NULL AND a.parent_id NOT IN (SELECT article_id FROM placed)
  GROUP BY a.parent_id
)
SELECT a.id, a.category, a.title, a.url, a.description, a.parent_id, a.hidden,
  r.position::int AS position, r.is_hot::bool AS is_hot, r.placed::bool AS placed,
  -- 下書き・非公開も数える。編集の範囲を決めるので、閲覧者に見えるかは問わない (specs/018 FR-019)
  EXISTS (SELECT 1 FROM digest_articles o JOIN digests d ON d.id = o.digest_id
    WHERE o.article_id = a.id AND d.entry_date < cur.entry_date) AS is_repost,
  f.entry_date AS first_published_on,
  -- 公開の判定は元の掲載 (いちばん古い日付の掲載) の Digest の状態で決める
  o.status AS original_status
FROM rows r JOIN articles a ON a.id = r.article_id JOIN digests cur ON cur.id = sqlc.arg(digest_id)
-- sqlc はサブクエリの列を NULL なしと推論するので、テーブルの LEFT JOIN で NULL を許す型にする
LEFT JOIN digests f ON f.id = (
  SELECT d.id FROM digest_articles x JOIN digests d ON d.id = x.digest_id
  -- 後の日付の掲載を数えると、前の日の Digest に後から再掲載の印が付く (specs/018 FR-010)
  WHERE x.article_id = a.id AND d.status = 'published' AND d.entry_date < cur.entry_date
  ORDER BY d.entry_date LIMIT 1
)
LEFT JOIN digests o ON o.id = (
  SELECT d.id FROM digest_articles x JOIN digests d ON d.id = x.digest_id
  WHERE x.article_id = a.id ORDER BY d.entry_date, d.created_at LIMIT 1
)
ORDER BY r.position, r.placed;

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
