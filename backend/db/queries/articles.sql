-- name: ListArticleDomains :many
-- ponytail: 管理者 1 人の前提で created_by を見ない。複数になったら条件を足す
SELECT host, count(*)::int AS count
FROM (
    SELECT substring(a.url from '^https?://([^/:?#]+)')::text AS host
    FROM articles a JOIN digests d ON d.id = a.digest_id
    WHERE NOT sqlc.arg(published_only)::bool OR d.status = 'published'
) x
WHERE sqlc.narg(q)::text IS NULL OR strpos(lower(host), lower(sqlc.narg(q))) > 0
GROUP BY host ORDER BY count DESC, host LIMIT sqlc.arg(lim);
