-- name: ListArticleDomains :many
-- ponytail: 管理者 1 人の前提で created_by を見ない。複数になったら条件を足す
SELECT host, count(*)::int AS count
FROM (
    SELECT substring(a.url from '^https?://([^/:?#]+)')::text AS host
    FROM articles a
    -- 再掲載で同じ記事を 2 回数えないよう、掲載ではなく記事で数える (specs/018 R8)
    WHERE NOT sqlc.arg(published_only)::bool OR EXISTS (
        SELECT 1 FROM digest_articles da JOIN digests d ON d.id = da.digest_id
        WHERE da.article_id = a.id AND d.status = 'published'
    )
) x
WHERE sqlc.narg(q)::text IS NULL OR strpos(lower(host), lower(sqlc.narg(q))) > 0
GROUP BY host ORDER BY count DESC, host LIMIT sqlc.arg(lim);

-- name: SearchArticles :many
-- ponytail: 記事は数千件に届かないので全件を strpos で見る。遅くなったら pg_trgm の索引を足す
-- 再掲載は自分の記事を upsert するので、ほかの利用者の記事は出さない
SELECT a.id, a.url, a.title, a.category, p.url AS parent_url, p.title AS parent_title,
  -- 公開の掲載だけを JOIN するので、下書き・非公開にしか載っていない記事は出ない (specs/018 FR-005)
  array_agg(d.entry_date ORDER BY d.entry_date)::date[] AS published_on,
  -- HOT は掲載ごとに付くので、同じ記事でも日付で違う
  coalesce(array_agg(d.entry_date ORDER BY d.entry_date) FILTER (WHERE da.is_hot), '{}')::date[] AS hot_on
FROM articles a
JOIN digest_articles da ON da.article_id = a.id
JOIN digests d ON d.id = da.digest_id AND d.status = 'published'
-- 隠した親は再掲載の候補に出さないので、子にも親として示さない
LEFT JOIN articles p ON p.id = a.parent_id AND NOT p.hidden
WHERE a.created_by = sqlc.arg(created_by) AND NOT a.hidden
  AND (strpos(lower(a.title), lower(sqlc.arg(q))) > 0 OR strpos(lower(a.url), lower(sqlc.arg(q))) > 0
    OR strpos(lower(a.url), lower(sqlc.arg(encoded_q))) > 0)
GROUP BY a.id, p.url, p.title
ORDER BY min(d.entry_date) DESC, a.id
LIMIT 50;

-- name: ListRepostCandidates :many
-- 候補の条件は SearchArticles と同じ。選ぶのに要らない掲載日の配列と HOT は集めない
SELECT a.id, a.url, a.title, a.category, p.id AS parent_id, p.url AS parent_url, p.title AS parent_title,
  min(d.entry_date)::date AS first_published_on
FROM articles a
JOIN digest_articles da ON da.article_id = a.id
JOIN digests d ON d.id = da.digest_id AND d.status = 'published'
LEFT JOIN articles p ON p.id = a.parent_id AND NOT p.hidden
WHERE a.created_by = sqlc.arg(created_by) AND NOT a.hidden
  AND (strpos(lower(a.title), lower(sqlc.arg(q))) > 0 OR strpos(lower(a.url), lower(sqlc.arg(q))) > 0
    OR strpos(lower(a.url), lower(sqlc.arg(encoded_q))) > 0)
GROUP BY a.id, p.id
ORDER BY min(d.entry_date) DESC, a.id
LIMIT 50;
